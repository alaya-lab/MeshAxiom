// The featured station: four generated module types placed as seventeen
// instances. Each matrix in station.json places the published module GLB
// exactly where the V6/V9 film assembly placed it (rigid + uniform scale only).
import * as THREE from 'three';
import { mountAssemblyCard } from './assembly-viewer.js';

// Exploded offsets in assembly units: outward along each module's own bearing, plus a vertical lift.
const EXPLODE = { central_core: [0, 0], radial_spoke: [5, 13], ring_segment: [15, 0], docking_port: [31, -9] };

mountAssemblyCard(document.getElementById('space-station'), {
  layoutUrl: 'assets/space/station.json',
  partUrl: key => `assets/space/${key}.glb`,
  explode(item, base) {
    const position = new THREE.Vector3().setFromMatrixPosition(base);
    const bearing = new THREE.Vector3(position.x, 0, position.z);
    if (bearing.lengthSq() > 1e-6) bearing.normalize();
    const [out, lift] = EXPLODE[item.part];
    return bearing.multiplyScalar(out).add(new THREE.Vector3(0, lift, 0));
  }
});
