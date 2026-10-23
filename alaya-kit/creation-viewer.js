import * as THREE from 'three';
import { OrbitControls } from './assets/vendor/OrbitControls.js';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';
import { MeshoptDecoder } from './assets/vendor/meshopt_decoder.module.js';
import { fitScale, samplePoints } from './fit-frame.js';
import { enableDeepZoom } from './deep-zoom.js';
import { claimContext, canClaim, whenDwelling } from './gl-pool.js';

// fit: size the model to the largest scale that stays in frame through a full turn (instead of modelSize).
export function createAssetViewer(container, onAnimation, { modelSize = 2.8, wireOpacity = .32, edgeLines = false, ambientIntensity = 0, fit = false, fitMargins } = {}) {
  const HOME = new THREE.Vector3(3.9, 1.9, 5.4);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .01, 100);
  // The renderer, its controls and the deep zoom exist only while this view holds a WebGL context (see attach()).
  let renderer = null, controls = null, zoom = null, slot = null, wantRotate = false, losses = 0, disarm = null, anisotropy = 4;
  let inflight = 0, pendingPlay = false, restoring = false;
  const target = new THREE.Vector3();
  scene.add(new THREE.HemisphereLight(0xe9f0ff, 0x4d4540, 2.1));
  if (ambientIntensity) scene.add(new THREE.AmbientLight(0xf1f4ff, ambientIntensity));
  for (const [color, intensity, x, y, z] of [[0xffefd9, 3, -3, 5, 6], [0xc6d7ff, 1.6, 5, 3, -4]]) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(x, y, z); scene.add(light);
  }
  const display = new THREE.Group(); scene.add(display);
  const grid = new THREE.GridHelper(6, 24, 0x363a44, 0x1d2028);
  grid.material.transparent = true; grid.material.opacity = .32; scene.add(grid);
  const gray = new THREE.MeshStandardMaterial({ color: 0xb7bfcd, roughness: .72, metalness: .02, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  // Kit GLBs are meshopt-compressed with WebP textures; older GLBs load unchanged.
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const cache = new Map(), loaded = new Set();
  let active, activeUrl, activeSpec, loadId = 0, wireEnabled = true, playing = false, visible = false, loop = 0;
  let scale = 1, center = new THREE.Vector3(), motionStart = new THREE.Vector3();
  const clock = new THREE.Clock();

  async function read(spec) {
    if (!cache.has(spec.file)) cache.set(spec.file, (async () => {
      let root, clips = [];
      if (spec.file.endsWith('.glb')) {
        const gltf = await loader.loadAsync(globalThis.meshAxiomAssetUrl(spec.file));
        root = gltf.scene; clips = gltf.animations;
      } else {
        const response = await fetch(globalThis.meshAxiomAssetUrl(spec.file));
        if (!response.ok) throw new Error('Mesh could not load');
        const mesh = await response.json();
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices.flat(), 3));
        geometry.setIndex(mesh.faces.flat()); geometry.computeVertexNormals();
        const axis = new THREE.Group(); axis.add(new THREE.Mesh(geometry, gray));
        if (mesh.up_axis === 'z') axis.rotation.x = -Math.PI / 2;
        root = new THREE.Group(); root.rotation.y = THREE.MathUtils.degToRad(mesh.display_yaw_degrees || 0); root.add(axis);
      }
      const surfaces = [], wires = [];
      let faces = 0;
      root.traverse(object => {
        if (!object.isMesh) return;
        if (!object.geometry.attributes.normal) object.geometry.computeVertexNormals();
        surfaces.push(object);
        object.userData.sourceMaterials = object.material;
        faces += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
        for (const material of [object.material].flat()) {
          material.side = THREE.DoubleSide;
          material.polygonOffset = true; material.polygonOffsetFactor = 1; material.polygonOffsetUnits = 1;
          for (const map of ['map', 'roughnessMap', 'metalnessMap']) if (material[map]) material[map].anisotropy = anisotropy;
        }
      });
      // Skinned overlays use the same weights and skeleton, so their edges follow the pose.
      for (const object of surfaces) {
        const useLines = edgeLines && !object.isSkinnedMesh;
        const material = useLines
          ? new THREE.LineBasicMaterial({ color: 0x202a39, transparent: true, opacity: wireOpacity, depthWrite: false })
          : new THREE.MeshBasicMaterial({ color: 0x202a39, wireframe: true, transparent: true, opacity: wireOpacity, depthWrite: false, side: THREE.DoubleSide });
        const wire = useLines ? new THREE.LineSegments(new THREE.WireframeGeometry(object.geometry), material)
          : object.isSkinnedMesh ? new THREE.SkinnedMesh(object.geometry, material) : new THREE.Mesh(object.geometry, material);
        if (object.isSkinnedMesh) wire.bind(object.skeleton, object.bindMatrix);
        wire.position.copy(object.position); wire.quaternion.copy(object.quaternion); wire.scale.copy(object.scale);
        wire.frustumCulled = false; wire.renderOrder = 1; object.parent.add(wire); wires.push({ wire, surface: object });
      }
      const mixer = clips.length ? new THREE.AnimationMixer(root) : null;
      const action = mixer ? mixer.clipAction(clips[0]) : null;
      if (action) {
        action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play(); mixer.setTime(0);
      }
      const motion = root.getObjectByName('HydraFlight');
      const data = { root, surfaces, wires, mixer, action, motion, faces, duration: clips[0]?.duration || 0 };
      loaded.add(data);
      return data;
    })().catch(error => { cache.delete(spec.file); throw error; }));
    return cache.get(spec.file);
  }

  function followMotion() {
    display.position.copy(center).multiplyScalar(-scale);
    if (active?.motion) display.position.addScaledVector(active.motion.position.clone().sub(motionStart), -scale);
    for (const { wire, surface } of active?.wires || []) {
      wire.position.copy(surface.position); wire.quaternion.copy(surface.quaternion); wire.scale.copy(surface.scale);
      wire.visible = wireEnabled;
    }
  }
  const draw = () => { if (renderer) renderer.render(scene, camera); };
  function reset() {
    camera.position.copy(HOME); target.set(0, 0, 0);
    if (!controls) return;
    const damping = controls.enableDamping, rotating = controls.autoRotate;
    controls.enableDamping = false; controls.autoRotate = false;
    controls.update();
    camera.position.copy(HOME); controls.target.set(0, 0, 0); controls.update(); zoom.reset();
    controls.enableDamping = damping; controls.autoRotate = rotating;
    draw();
  }
  function frame(run) {
    if (run !== loop) return;
    requestAnimationFrame(() => frame(run));
    const delta = Math.min(clock.getDelta(), .08);
    if (!visible || document.hidden) return;
    if (playing && active?.mixer) {
      active.mixer.update(delta);
      if (active.action.time >= active.duration) playing = false;
      onAnimation({ time: active.action.time, duration: active.duration, playing });
    }
    followMotion(); controls.update(); renderer.render(scene, camera);
  }
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer?.setSize(width, height, false);
    if (fit && active?.fitPoints) {
      const bottom = (grid.position.y + .03) / scale;
      scale = fitScale(active.fitPoints, { fov: camera.fov, aspect: camera.aspect, position: HOME }, fitMargins);
      display.scale.setScalar(scale); grid.position.y = bottom * scale - .03; followMotion();
    }
  }

  // Take a WebGL context (over the page budget, the viewer off screen the longest gives one back) and the controls.
  function attach() {
    disarm?.(); disarm = null;
    slot = claimContext(reason => detach(reason), visible);
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (error) { slot.drop(); slot = null; throw error; }
    anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setClearColor(0x0d0d10, 0);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    const own = renderer;
    // A context the browser takes away (GPU reset, too many contexts elsewhere) brings the still image back.
    own.domElement.addEventListener('webglcontextlost', () => { if (renderer === own) detach('lost'); });
    own.domElement.addEventListener('pointerdown', () => slot?.touch());
    container.append(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .08;
    controls.autoRotateSpeed = .65;
    // Unlimited zoom toward the point under the cursor (after the view is clicked); auto-rotation waits while zoomed in.
    zoom = enableDeepZoom({ camera, controls, dom: renderer.domElement, home: HOME,
      pickables: () => (active?.surfaces || []).filter(mesh => mesh.visible),
      onZoom: zoomedIn => { controls.autoRotate = wantRotate && !zoomedIn; } });
    controls.target.copy(target); controls.update();
    controls.autoRotate = wantRotate && !zoom.isZoomedIn();
    resize(); frame(++loop);
  }
  // Free a loaded model's GPU copies and decoded images (it is loaded again, usually from the browser cache, on return).
  function drop(data) {
    data.root.traverse(object => {
      if (!object.geometry) return;
      object.geometry.dispose();
      for (const material of [object.material, object.userData.sourceMaterials].flat()) {
        if (!material || material === gray) continue;
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
          const texture = material[key];
          if (!texture) continue;
          texture.dispose();
          if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) texture.image.close();
        }
        material.dispose();
      }
    });
  }
  // Give the context back and free the loaded models (loads still in flight finish and take a context again).
  // A view evicted off screen returns once it has been in view for a moment. One released while on screen ('crowded',
  // or 'lost' to the browser, at most twice) waits until the visitor leaves it and comes back; a click on it, a mode
  // switch or Play brings it back at once. Callers hear 'viewer-released' / 'viewer-restored' on the container.
  function detach(reason) {
    if (!renderer) return;
    const old = renderer, lost = old.getContext().isContextLost();
    target.copy(controls.target); loop++; slot?.drop(); slot = null;
    controls.dispose(); controls = null; zoom = null; renderer = null;
    if (active) onAnimation({ time: 0, duration: active.duration, playing: false });
    playing = false; display.clear(); active = null; activeUrl = null;
    for (const data of loaded) drop(data);
    loaded.clear(); cache.clear();
    // the grid and the gray material live as long as the viewer: dispose them too, so the old renderer lets go of them
    grid.geometry.dispose(); grid.material.dispose(); gray.dispose();
    old.dispose(); if (!lost) old.forceContextLoss(); old.domElement.remove();
    container.classList.remove('ready');
    container.dispatchEvent(new CustomEvent('viewer-released', { detail: { reason } }));
    if (reason === 'lost') losses++;
    if (inflight) return;                              // a load still running takes a context again when it ends
    if (reason === 'evicted') arm(false);
    else if (reason === 'crowded' || losses <= 2) arm(true);
  }
  function arm(afterLeaving) {
    disarm?.();
    disarm = activeSpec ? whenDwelling(container, () => restore(false), { afterLeaving }) : null;
  }
  // force: the visitor asked for it (click, mode, Play), so it may take a context from another view on screen.
  async function restore(force) {
    disarm?.(); disarm = null;
    if (renderer || !activeSpec || restoring) return;
    if (!force && !canClaim()) { arm(true); return; }
    restoring = true;
    try {
      const result = await api.load(globalThis.meshAxiomAssetUrl(activeSpec), { preserveView: true });
      if (!result || !renderer) return;
      container.classList.add('ready');
      container.dispatchEvent(new CustomEvent('viewer-restored', { detail: result }));
      if (pendingPlay) { pendingPlay = false; api.play(true); }
    } catch (error) {
      console.warn('Asset viewer could not come back:', error.message);
      container.dispatchEvent(new CustomEvent('viewer-restore-failed', { detail: { message: error.message } }));
      arm(true);
    } finally { restoring = false; }
  }
  container.addEventListener('click', () => { if (!renderer && activeSpec) restore(true); });

  new IntersectionObserver(entries => { visible = entries.at(-1).isIntersecting; slot?.visible(visible); }, { rootMargin: '100px' }).observe(container);
  new ResizeObserver(resize).observe(container);
  attach(); reset();

  const api = {
    async load(spec, { preserveView = false, releaseInactive = false } = {}) {
      const id = ++loadId;
      disarm?.(); disarm = null;
      if (!renderer) attach();
      let data;
      inflight++;
      try { data = await read(spec); } finally { inflight--; }
      if (id !== loadId) {
        if (releaseInactive && data !== active) { drop(data); loaded.delete(data); cache.delete(spec.file); }
        return null;
      }
      if (!renderer) attach();   // released while the mesh was loading
      activeSpec = spec;
      const same = activeUrl === spec.file;
      if (!same) {
        playing = false;
        display.clear(); display.add(data.root); active = data; activeUrl = spec.file;
        if (data.action && !preserveView) { data.action.reset().play(); data.mixer.setTime(0); }
        display.position.set(0, 0, 0); display.scale.setScalar(1); display.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(data.root);
        center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3()); scale = modelSize / Math.max(size.x, size.y, size.z);
        if (fit) {
          if (!data.fitPoints) data.fitPoints = data.surfaces.flatMap(mesh => samplePoints(mesh.geometry, mesh.matrixWorld, 800)).map(point => point.sub(center));
          scale = fitScale(data.fitPoints, { fov: camera.fov, aspect: camera.aspect, position: HOME }, fitMargins);
        }
        display.scale.setScalar(scale);
        motionStart.copy(data.motion?.position || new THREE.Vector3());
        grid.position.y = (bounds.min.y - center.y) * scale - .03;
      }
      for (const mesh of data.surfaces) mesh.material = spec.textured ? mesh.userData.sourceMaterials : gray;
      followMotion();
      if (!preserveView) reset();
      draw();
      if (releaseInactive) {
        for (const old of loaded) if (old !== active) { drop(old); loaded.delete(old); }
        for (const file of cache.keys()) if (file !== activeUrl) cache.delete(file);
      }
      onAnimation({ time: data.action?.time || 0, duration: data.duration, playing });
      return { faces: data.faces, duration: data.duration };
    },
    wireframe(value) { wireEnabled = value; followMotion(); draw(); },
    rotate(value) { wantRotate = value; if (controls) controls.autoRotate = value && !zoom.isZoomedIn(); },
    play(value) {
      if (!renderer && activeSpec) { pendingPlay = value; restore(true); return false; }
      if (!active?.action) return false;
      if (value && active.action.time >= active.duration) { active.action.reset().play(); active.mixer.setTime(0); }
      playing = value;
      onAnimation({ time: active.action.time, duration: active.duration, playing });
      return true;
    },
    seek(time) {
      if (!active?.action) return;
      playing = false; active.action.reset().play(); active.mixer.setTime(Math.min(time, active.duration));
      followMotion(); draw();
      onAnimation({ time: active.action.time, duration: active.duration, playing });
    },
    reset,
    state() { return { camera: camera.position.toArray(), viewDistance: camera.position.distanceTo(controls?.target || target), near: camera.near, rotating: !!controls?.autoRotate, time: active?.action?.time || 0, playing, wireframe: wireEnabled, faces: active?.faces || 0, released: !renderer, modelFile: activeUrl, loadedModels: loaded.size, textureCount: renderer?.info.memory.textures || 0, maxTextureDimension: Math.max(0,...(active?.surfaces || []).flatMap(mesh => [mesh.userData.sourceMaterials].flat().map(material => Math.max(material?.map?.image?.width || 0,material?.map?.image?.height || 0)))) }; }
  };
  return api;
}
