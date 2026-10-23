import * as THREE from 'three';

// Unlimited zoom toward the surface point under the cursor, shared by the 3D viewers.
// Each wheel step scales the camera position and the orbit target about the picked point (a homothety): the point
// stays under the cursor, the view direction is kept, and the point can be approached without limit; afterwards the
// view orbits around it. Near/far planes follow the distance so close-ups are not clipped.
// The wheel only zooms after the view has been clicked or dragged, so it still scrolls the page otherwise.
// Touch pinch stays with OrbitControls (zoom to the pinch centre, no practical minimum distance).
export function enableDeepZoom({ camera, controls, dom, pickables, home, maxFactor = 6, onZoom = () => {} }) {
  const homeDistance = home.length();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(), center = new THREE.Vector3();
  let armed = false, zoomedIn = false;
  dom.addEventListener('pointerdown', () => { armed = true; });
  dom.addEventListener('pointerleave', () => { armed = false; });
  controls.enableZoom = true; controls.zoomToCursor = true;
  controls.minDistance = 1e-6; controls.maxDistance = homeDistance * maxFactor;

  function clip() {
    const d = camera.position.distanceTo(controls.target);
    const near = Math.min(.01, Math.max(d * .004, 1e-7)), far = Math.max(200, d * 4000);
    if (near !== camera.near || far !== camera.far) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
    const now = d < homeDistance * .8;
    if (now !== zoomedIn) { zoomedIn = now; onZoom(zoomedIn); }
  }
  controls.addEventListener('change', clip);

  function pick(event) {
    const rect = dom.getBoundingClientRect();
    ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(pickables(), false).find(h => {
      const m = h.object.material;
      return h.object.visible && !(Array.isArray(m) ? m : [m]).some(x => x.transparent && x.opacity < .3);
    });
    return hit ? center.copy(hit.point) : raycaster.ray.at(camera.position.distanceTo(controls.target), center);
  }

  // Capture phase: runs before OrbitControls' own wheel listener, which never sees the event.
  dom.addEventListener('wheel', event => {
    event.stopImmediatePropagation();
    if (!armed) return;
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 33 : event.deltaMode === 2 ? 400 : 1);
    let factor = Math.exp(Math.max(-400, Math.min(400, pixels)) * .0016);
    const distance = camera.position.distanceTo(controls.target);
    if (factor > 1) factor = Math.min(factor, homeDistance * maxFactor / Math.max(distance, 1e-9));
    if (Math.abs(factor - 1) < 1e-6) return;
    const p = pick(event);
    camera.position.sub(p).multiplyScalar(factor).add(p);
    controls.target.sub(p).multiplyScalar(factor).add(p);
    controls.update(); clip();
  }, { capture: true, passive: false });

  return {
    isZoomedIn: () => zoomedIn,
    // After the viewer puts the camera back home: default planes, and leave the zoomed-in state.
    reset() {
      camera.near = .01; camera.far = 200; camera.updateProjectionMatrix();
      if (zoomedIn) { zoomedIn = false; onZoom(false); }
    }
  };
}
