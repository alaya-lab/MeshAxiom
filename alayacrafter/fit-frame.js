import * as THREE from 'three';

// Largest uniform scale at which a model, turning a full circle about the
// vertical axis, stays inside the frame seen from the default camera pose.
// `points` are model-space samples relative to the orbit target.
// Margins are normalized device coordinates; the bottom leaves room for the hint.
export function fitScale(points, { fov, aspect, position, target = new THREE.Vector3() }, { side = .9, top = .88, bottom = -.72, steps = 24 } = {}) {
  const camera = new THREE.PerspectiveCamera(fov, aspect, .01, 1000);
  camera.position.copy(position); camera.lookAt(target);
  camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const view = camera.matrixWorldInverse, projection = camera.projectionMatrix;
  const turns = Array.from({ length: steps }, (_, index) => {
    const angle = index / steps * Math.PI * 2;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const probe = new THREE.Vector3();
  const fits = scale => {
    for (const [cos, sin] of turns) for (const point of points) {
      probe.set((point.x * cos + point.z * sin) * scale, point.y * scale, (point.z * cos - point.x * sin) * scale).add(target);
      probe.applyMatrix4(view);
      if (probe.z > -.05) return false; // must stay in front of the camera
      probe.applyMatrix4(projection);
      if (Math.abs(probe.x) > side || probe.y > top || probe.y < bottom) return false;
    }
    return true;
  };
  let low = 0, high = 1;
  while (fits(high) && high < 1e6) { low = high; high *= 2; }
  for (let step = 0; step < 18; step++) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle; else high = middle;
  }
  return low;
}

// An evenly strided sample of a geometry's vertices, transformed by `matrix`.
export function samplePoints(geometry, matrix, count = 500) {
  const position = geometry.attributes.position, stride = Math.max(1, Math.floor(position.count / count));
  const points = [];
  for (let index = 0; index < position.count; index += stride) points.push(new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(matrix));
  // The extreme vertex along each axis keeps thin protrusions from being missed by the stride.
  for (let axis = 0; axis < 3; axis++) {
    let low = 0, high = 0;
    for (let index = 1; index < position.count; index++) {
      const value = position.getComponent(index, axis);
      if (value < position.getComponent(low, axis)) low = index;
      if (value > position.getComponent(high, axis)) high = index;
    }
    for (const index of [low, high]) points.push(new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(matrix));
  }
  return points;
}
