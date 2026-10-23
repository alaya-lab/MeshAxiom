// Interactive assemblies of generated modules (the station, the carrier, the jump gate).
// Each layout instance places a published module GLB with a rigid + uniform-scale matrix;
// nothing in the meshes is edited. Cards share one markup: .station-viewport, the
// data-station-appearance / -parts / -focus buttons, a load button, a hint and a status line.
import * as THREE from 'three';
import { OrbitControls } from './assets/vendor/OrbitControls.js';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';
import { MeshoptDecoder } from './assets/vendor/meshopt_decoder.module.js';
import { fitScale, samplePoints } from './fit-frame.js';
import { enableDeepZoom } from './deep-zoom.js';
import { claimContext, canClaim, whenDwelling } from './gl-pool.js';
import { assemblyMaterialFile } from './texture-quality.js?v=best-detail-20261011-r1';

const HOME = new THREE.Vector3(3.4, 2.6, 4.9);

// layoutUrl: JSON with instances [{part, matrix, explode?}]; partUrl(key): GLB url for a part;
// explode(item, base): offset for the parts view (defaults to the layout's own explode vector);
// noun: label used while loading, e.g. "modules".
export function mountAssemblyCard(card, { layoutUrl, partUrl, explode = item => new THREE.Vector3(...(item.explode || [0, 0, 0])), noun = 'modules', home = HOME }) {
  const viewport = card.querySelector('.station-viewport');
  const poster = viewport.querySelector('img');
  const status = card.querySelector('.station-status');
  const loadButton = card.querySelector('[data-station-load]');
  const hint = card.querySelector('.station-hint');
  // Materials by default; the gray mesh always shows its topology lines.
  let started = false, appearance = 'material', exploded = false, focus = null, api = null, losses = 0;
  const wired = () => appearance === 'gray';
  const setPressed = (selector, active) => card.querySelectorAll(selector).forEach(button => button.setAttribute('aria-pressed', String(active(button))));

  async function start() {
    if (started) return;
    started = true; loadButton.hidden = true; disarm?.(); disarm = null;
    status.hidden = false; viewport.setAttribute('aria-busy', 'true');
    try {
      const layout = await fetch(globalThis.meshAxiomAssetUrl(layoutUrl)).then(response => {
        if (!response.ok) throw new Error('Layout could not load');
        return response.json();
      });
      const keys = [...new Set(layout.instances.map(item => item.part))];
      const progress = Object.fromEntries(keys.map(key => [key, 0]));
      const report = () => { status.textContent = `Loading ${keys.length} ${noun} · ${Math.round(100 * Object.values(progress).reduce((a, b) => a + b, 0) / keys.length)}%`; };
      report();
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      // A layout may name each part's GLB (parts drawn from several kits); otherwise partUrl decides.
      const url = key => assemblyMaterialFile(layout.urls?.[key] || partUrl(key));
      const parts = Object.fromEntries(await Promise.all(keys.map(async key => loader.loadAsync(globalThis.meshAxiomAssetUrl(await url(key)), event => {
        if (event.total) { progress[key] = event.loaded / event.total; report(); }
      }).then(gltf => [key, gltf]))));
      api = mount(layout, parts);
      viewport.classList.add('ready'); hint.hidden = false; status.hidden = true;
      api.appearance(appearance); api.focus(focus); api.explode(exploded);
      card.dataset.state = 'ready';
    } catch {
      started = false; loadButton.hidden = false;
      status.textContent = '3D view unavailable. Try again, or explore the modules below.'; status.hidden = false;
    } finally {
      viewport.setAttribute('aria-busy', 'false');
    }
  }

  function mount(layout, parts) {
    // Claim a context slot first: over the page budget, the viewer off screen the longest gives its context back.
    const slot = claimContext(reason => release(reason));
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (error) { slot.drop(); throw error; }
    try { return build(layout, parts, slot, renderer); } catch (error) {
      slot.drop(); const lost = renderer.getContext().isContextLost();
      renderer.dispose(); if (!lost) renderer.forceContextLoss(); renderer.domElement.remove();
      throw error;
    }
  }

  function build(layout, parts, slot, renderer) {
    let alive = true;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, .01, 100);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    // A context the browser takes away (GPU reset, too many contexts elsewhere) brings the still image back.
    renderer.domElement.addEventListener('webglcontextlost', () => { if (alive) release('lost'); });
    renderer.domElement.addEventListener('pointerdown', () => slot.touch());
    viewport.append(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .08;
    const spin = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    controls.autoRotate = spin; controls.autoRotateSpeed = .45;
    let resume;
    // Unlimited zoom toward the point under the cursor (after the view is clicked); turning stays paused while zoomed in.
    const pickables = [];
    const zoom = enableDeepZoom({ camera, controls, dom: renderer.domElement, pickables: () => pickables, home,
      onZoom: zoomedIn => { clearTimeout(resume); if (zoomedIn) controls.autoRotate = false; else resume = setTimeout(() => { controls.autoRotate = spin; }, 3000); } });
    // Always turning: a drag pauses it, and it resumes shortly after release unless the view is zoomed in.
    controls.addEventListener('start', () => { clearTimeout(resume); controls.autoRotate = false; });
    controls.addEventListener('end', () => { clearTimeout(resume); resume = setTimeout(() => { controls.autoRotate = spin && !zoom.isZoomedIn(); }, 3000); });
    scene.add(new THREE.HemisphereLight(0xe9f0ff, 0x4d4540, 2.1), new THREE.AmbientLight(0xf1f4ff, 1.2));
    for (const [color, intensity, x, y, z] of [[0xffefd9, 3, -3, 5, 6], [0xc6d7ff, 1.6, 5, 3, -4]]) {
      const light = new THREE.DirectionalLight(color, intensity); light.position.set(x, y, z); scene.add(light);
    }

    // One geometry, one source material, one gray material and one edge set per module type.
    const kinds = {};
    for (const [key, gltf] of Object.entries(parts)) {
      let source;
      gltf.scene.traverse(object => { if (object.isMesh && !source) source = object; });
      source.updateWorldMatrix(true, false);
      const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
      // The module GLBs carry no normals; the gray surface needs them (textured ones are flat-shaded by the loader).
      if (!geometry.attributes.normal) geometry.computeVertexNormals();
      const material = source.material;
      material.side = THREE.DoubleSide; material.transparent = true;
      material.polygonOffset = true; material.polygonOffsetFactor = 1; material.polygonOffsetUnits = 1;
      for (const map of ['map', 'roughnessMap', 'metalnessMap']) if (material[map]) material[map].anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const gray = new THREE.MeshStandardMaterial({ color: 0xb7bfcd, roughness: .72, metalness: .02, side: THREE.DoubleSide, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      const edges = new THREE.WireframeGeometry(geometry);
      const line = new THREE.LineBasicMaterial({ color: 0x202a39, transparent: true, opacity: .32, depthWrite: false });
      kinds[key] = { geometry, material, gray, edges, line, meshes: [] };
    }
    const assembly = new THREE.Group(); scene.add(assembly);
    for (const item of layout.instances) {
      const kind = kinds[item.part];
      const holder = new THREE.Group();
      holder.matrixAutoUpdate = false;
      const base = new THREE.Matrix4().fromArray(item.matrix);
      const offset = explode(item, base);
      const mesh = new THREE.Mesh(kind.geometry, kind.material);
      const edges = new THREE.LineSegments(kind.edges, kind.line);
      edges.renderOrder = 1; edges.visible = wired();
      holder.matrix.copy(base);
      holder.add(mesh, edges); assembly.add(holder); pickables.push(mesh);
      kind.meshes.push({ holder, base, offset, mesh, edges });
    }
    assembly.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(assembly);
    const center = bounds.getCenter(new THREE.Vector3());
    // Samples of every instance, assembled and exploded, relative to the orbit centre.
    const samples = { assembled: [], exploded: [] };
    const perInstance = Math.max(40, Math.round(6000 / layout.instances.length));
    for (const kind of Object.values(kinds)) for (const item of kind.meshes) for (const point of samplePoints(kind.geometry, item.base, perInstance)) {
      samples.assembled.push(point.clone().sub(center));
      samples.exploded.push(point.add(item.offset).sub(center));
    }
    // The largest size that stays in frame through a full turn, for each state.
    let fitted = { assembled: 1, exploded: 1 };
    const refit = () => {
      const pose = { fov: camera.fov, aspect: camera.aspect, position: home };
      fitted = { assembled: fitScale(samples.assembled, pose), exploded: fitScale(samples.exploded, pose) };
      place();
    };

    let blend = 0, target = 0, dirty = true;
    const translate = new THREE.Matrix4();
    function place() {
      const eased = blend * blend * (3 - 2 * blend);
      for (const kind of Object.values(kinds)) for (const item of kind.meshes) {
        translate.makeTranslation(item.offset.x * eased, item.offset.y * eased, item.offset.z * eased);
        item.holder.matrix.multiplyMatrices(translate, item.base);
        item.holder.matrixWorldNeedsUpdate = true;
      }
      const scale = fitted.assembled + (fitted.exploded - fitted.assembled) * eased;
      assembly.scale.setScalar(scale); assembly.position.copy(center).multiplyScalar(-scale);
    }
    function paint() {
      for (const [key, kind] of Object.entries(kinds)) {
        const dim = focus && focus !== key;
        const surface = appearance === 'material' ? kind.material : kind.gray;
        surface.opacity = dim ? .1 : 1; surface.depthWrite = !dim;
        kind.line.opacity = dim ? .04 : .32;
        for (const item of kind.meshes) { item.mesh.material = surface; item.mesh.renderOrder = dim ? 2 : 0; item.edges.visible = wired(); }
      }
      dirty = true;
    }
    function reset() {
      camera.position.copy(home); controls.target.set(0, 0, 0); controls.update(); zoom.reset(); dirty = true;
    }

    let visible = true, last = performance.now();
    // Views mount in sight (after a dwell or a click), so the still image hides at once; the observer corrects it.
    viewport.dataset.visible = 'true';
    const seen = new IntersectionObserver(entries => { visible = entries.at(-1).isIntersecting; viewport.dataset.visible = String(visible); slot.visible(visible); }, { rootMargin: '100px' });
    seen.observe(viewport);
    const sized = new ResizeObserver(() => {
      const { width, height } = viewport.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height; camera.updateProjectionMatrix();
      renderer.setSize(width, height, false); refit(); dirty = true;
    });
    sized.observe(viewport);
    controls.addEventListener('change', () => { dirty = true; });
    function frame(now) {
      if (!alive) return;
      requestAnimationFrame(frame);
      const delta = Math.min((now - last) / 1000, .08); last = now;
      if (!visible || document.hidden) return;
      if (blend !== target) {
        blend = target > blend ? Math.min(target, blend + delta / .9) : Math.max(target, blend - delta / .9);
        place(); dirty = true;
      }
      controls.update();
      if (dirty || controls.autoRotate) { renderer.render(scene, camera); dirty = false; }
    }
    const box = viewport.getBoundingClientRect();
    if (box.width && box.height) { camera.aspect = box.width / box.height; camera.updateProjectionMatrix(); }
    refit(); paint(); reset(); requestAnimationFrame(frame);

    return {
      appearance(next) { appearance = next; paint(); },
      explode(next) { target = next ? 1 : 0; dirty = true; },
      focus(next) { focus = next; paint(); },
      state: () => ({ appearance, exploded: target === 1, blend, wireframe: wired(), focus, instances: layout.instances.length, triangles: layout.triangles, viewDistance: camera.position.distanceTo(controls.target), near: camera.near, rotating: controls.autoRotate }),
      // Gives the context back and frees the GPU copies; the loaded parts are dropped too (a restart fetches again).
      dispose() {
        alive = false; slot.drop(); seen.disconnect(); sized.disconnect(); clearTimeout(resume); controls.dispose();
        for (const kind of Object.values(kinds)) {
          kind.geometry.dispose(); kind.edges.dispose(); kind.gray.dispose(); kind.line.dispose();
          for (const map of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
            const texture = kind.material[map];
            if (!texture) continue;
            texture.dispose();
            if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) texture.image.close();
          }
          kind.material.dispose();
        }
        const lost = renderer.getContext().isContextLost();
        renderer.dispose(); if (!lost) renderer.forceContextLoss(); renderer.domElement.remove();
      }
    };
  }

  // Back to the still image and the load button. A view evicted off screen comes back on its own once it is in view
  // again (where views load automatically). One released while on screen ('crowded': too many views on screen, or
  // 'lost': the browser took its context, at most twice) waits until the visitor leaves it and comes back.
  function release(reason) {
    if (!api) return;
    const old = api; api = null; started = false;
    old.dispose();
    viewport.classList.remove('ready'); card.dataset.state = 'released';
    hint.hidden = true; status.hidden = true; loadButton.hidden = false;
    if (reason === 'lost') losses++;
    if (reason === 'evicted') armAutoload(false);
    else if (reason === 'crowded' || losses <= 2) armAutoload(true);
  }

  card.querySelectorAll('[data-station-appearance]').forEach(button => button.addEventListener('click', () => {
    appearance = button.dataset.stationAppearance; card.dataset.appearance = appearance;
    setPressed('[data-station-appearance]', b => b.dataset.stationAppearance === appearance);
    if (poster) poster.src = globalThis.meshAxiomAssetUrl(appearance === 'material' ? poster.dataset.material : poster.dataset.gray);
    api?.appearance(appearance);
  }));
  card.querySelectorAll('[data-station-parts]').forEach(button => button.addEventListener('click', () => {
    exploded = button.dataset.stationParts === 'exploded';
    setPressed('[data-station-parts]', b => (b.dataset.stationParts === 'exploded') === exploded);
    start(); api?.explode(exploded);
  }));
  card.querySelectorAll('[data-station-focus]').forEach(button => button.addEventListener('click', () => {
    focus = focus === button.dataset.stationFocus ? null : button.dataset.stationFocus;
    setPressed('[data-station-focus]', b => b.dataset.stationFocus === focus);
    start(); api?.focus(focus);
  }));
  loadButton.addEventListener('click', start);
  viewport.getStationState = () => ({ ready: card.dataset.state === 'ready', ...(api?.state() || {}) });

  // Assemblies are tens of MB; load automatically only on wide screens without data saving, and only once the
  // view has stayed in sight for a moment (a nav jump that smooth-scrolls past all of them loads none).
  const autoload = !navigator.connection?.saveData && matchMedia('(min-width: 801px)').matches;
  let disarm = null;
  // An automatic (re)load never takes a context from another view that is on screen; it waits for the next visit.
  function armAutoload(afterLeaving) {
    if (!autoload || disarm) return;
    disarm = whenDwelling(viewport, () => { disarm = null; if (canClaim()) start(); else armAutoload(true); }, { afterLeaving });
  }
  armAutoload(false);
}
