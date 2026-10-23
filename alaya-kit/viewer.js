import * as THREE from 'three';
import { OrbitControls } from './assets/vendor/OrbitControls.js';

export function createViewer(container) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .01, 100);
  camera.up.set(0, 0, 1);
  camera.position.set(3.7, .93, 2.3);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0d0d10, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .07;
  controls.minDistance = 1.6; controls.maxDistance = 9;
  controls.autoRotateSpeed = .7;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  scene.add(new THREE.HemisphereLight(0xe4e8ff, 0x373542, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, -4, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbbc9ef, 1); rim.position.set(-3, 2, 3); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, .6); fill.position.set(3, 4, 1); scene.add(fill);
  const group = new THREE.Group(); scene.add(group);
  const grid = new THREE.GridHelper(5, 20, 0x373943, 0x1c1e25);
  grid.rotation.x = Math.PI / 2; grid.position.z = -.925;
  grid.material.transparent = true; grid.material.opacity = .36;
  scene.add(grid);
  let mesh, wire, item, visible = true, wireEnabled = true;
  let frame;
  function render() {
    frame = requestAnimationFrame(render);
    if (!visible || document.hidden) return;
    controls.update(); renderer.render(scene, camera);
  }
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { rootMargin: '80px' }).observe(container);
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  new ResizeObserver(resize).observe(container);
  resize(); render();
  function reset() {
    if (!item) return;
    const p = item.camera?.position || [3.7, .93, 2.3];
    camera.position.fromArray(p);
    camera.fov = item.camera?.fov || 32;
    // The reference fit uses a square frame; use a wider field of view on narrow screens.
    if (camera.aspect < 1) camera.fov = Math.min(48, camera.fov / camera.aspect);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
  }
  return {
    setMesh(data, metadata, { preserveView = false } = {}) {
      item = metadata;
      while (group.children.length) {
        const child = group.children[0]; group.remove(child);
        child.geometry.dispose(); child.material.dispose();
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      geometry.setIndex(data.indices);
      geometry.computeVertexNormals(); geometry.computeBoundingBox();
      const center = geometry.boundingBox.getCenter(new THREE.Vector3());
      const size = geometry.boundingBox.getSize(new THREE.Vector3());
      const scale = 1.8 / Math.max(size.x, size.y, size.z);
      const material = new THREE.MeshStandardMaterial({ color: 0x9ea8bc, roughness: .7, metalness: .04, side: THREE.DoubleSide, flatShading: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(center).multiplyScalar(-scale); mesh.scale.setScalar(scale);
      group.add(mesh);
      wire = new THREE.LineSegments(new THREE.WireframeGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x343b49, transparent: true, opacity: .55 }));
      wire.position.copy(mesh.position); wire.scale.copy(mesh.scale); wire.visible = wireEnabled;
      group.add(wire);
      grid.position.z = (geometry.boundingBox.min.z - center.z) * scale - .035;
      if (!preserveView) reset();
      renderer.render(scene, camera);
    },
    setWireframe(value) { wireEnabled = value; if (wire) wire.visible = value; },
    setRotate(value) { controls.autoRotate = value; },
    reset,
    dispose() { cancelAnimationFrame(frame); controls.dispose(); renderer.dispose(); }
  };
}
