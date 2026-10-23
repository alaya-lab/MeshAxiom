// The space-game kit: the carrier and the jump-gate outpost, assembled from generated assets.
import { mountAssemblyCard } from './assembly-viewer.js?v=main-hd-refresh-20261011';

for (const [id, layout] of [['kit-carrier', 'carrier'], ['kit-gate', 'gate']]) {
  mountAssemblyCard(document.getElementById(id), {
    layoutUrl: `assets/kit/${layout}.json`,
    partUrl: key => `/alaya-kit/assets/kit/${key}.glb`,
    noun: 'assets'
  });
}
