import { createAssetViewer } from './creation-viewer.js?v=main-hd-refresh-20261011';
import { mountAssemblyCard } from './assembly-viewer.js?v=best-detail-20261011-r1';
import { materialFile } from './texture-quality.js?v=best-detail-20261011-r1';

let catalog;
const getCatalog = () => catalog ||= fetch(globalThis.meshAxiomAssetUrl("https://alaya-lab.github.io/MeshAxiom/alaya-kit/assets/kit2/library.json")).then(response => {
  if (!response.ok) throw new Error('Model library could not load');
  return response.json();
}).catch(error => { catalog = null; throw error; });

// These views inspect the published meshes. The original camera-sweep movies stay separate.
export function mountShowcaseGeometry(card) {
  const pane = document.createElement('div');
  pane.className = 'showcase-geometry';
  pane.hidden = true;
  const viewport = document.createElement('div');
  viewport.className = card.dataset.kind === 'assembly' ? 'station-viewport' : 'showcase-model-viewport';
  viewport.setAttribute('role', 'img');
  viewport.setAttribute('aria-label', `${card.querySelector('h4').textContent} interactive mesh`);
  pane.append(viewport);
  card.querySelector('.showcase-stage').append(pane);

  if (card.dataset.kind === 'assembly') {
    const status = document.createElement('span');
    status.className = 'station-status showcase-geometry-status';
    const load = document.createElement('button');
    load.type = 'button'; load.dataset.stationLoad = '';
    load.className = 'showcase-geometry-retry'; load.textContent = 'Load gray mesh';
    const hint = document.createElement('span');
    hint.className = 'station-hint showcase-geometry-hint'; hint.hidden = true;
    hint.textContent = 'Drag to rotate · Scroll to zoom';
    const internal = document.createElement('div');
    internal.hidden = true;
    for (const mode of ['material', 'gray', 'topology']) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.stationAppearance = mode;
      internal.append(button);
    }
    pane.append(status, load, hint, internal);
    mountAssemblyCard(pane, {
      layoutUrl: card.dataset.geometryLayout,
      partUrl: key => `assets/kit/${key}.glb`, noun: 'parts',
    });
    internal.querySelector('[data-station-appearance="gray"]').click();
    return {
      async show() {
        pane.hidden = false;
        internal.querySelector('[data-station-appearance="gray"]').click();
        if (!viewport.getStationState().ready) load.click();
      },
      hide() { pane.hidden = true; },
      visible() {},
      state: () => ({ kind: 'assembly', layout: card.dataset.geometryLayout,
        ...(viewport.getStationState?.() || { ready: false }) }),
    };
  }

  const status = document.createElement('span');
  status.className = 'showcase-geometry-status'; status.textContent = 'Loading mesh…';
  const retry = document.createElement('button');
  retry.type = 'button'; retry.className = 'showcase-geometry-retry'; retry.textContent = 'Reload mesh'; retry.hidden = true;
  const hint = document.createElement('span');
  hint.className = 'showcase-geometry-hint'; hint.textContent = 'Drag to rotate · Scroll to zoom'; hint.hidden = true;
  pane.append(status, retry, hint);
  let viewer, file, mode = 'gray', loading, shown = false, visible = false, failed = false;
  const rotate = () => viewer?.rotate(shown && visible && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const apply = async () => {
    status.hidden = false; retry.hidden = true; status.textContent = 'Loading mesh…';
    try {
      if (!viewer) {
        viewer = createAssetViewer(viewport, () => {}, { modelSize: 3.6, edgeLines: true,
          wireOpacity: .36, ambientIntensity: 1.2, fit: true,
          fitMargins: card.dataset.kind === 'interactive'
            ? { side: .93, top: .91, bottom: -.84 }
            : { side: .9, top: .86, bottom: -.5 } });
        viewport.getModelState = () => viewer.state();
      }
      if (!file) {
        const items = await getCatalog();
        const matches = items.filter(item => item.key === card.dataset.geometryKey);
        if (matches.length !== 1) throw new Error('Model entry is unavailable');
        const item = { ...matches[0] };
        for (const key of ['mesh', 'materialMesh']) if (item[key]) item[key] = `/alaya-kit/${item[key]}`;
        file = await materialFile(item, card);
      }
      await viewer.load(globalThis.meshAxiomAssetUrl({ file, textured: mode === 'material' }), { preserveView: true, releaseInactive: true });
      viewer.wireframe(mode === 'topology'); rotate();
      viewport.classList.add('ready'); status.hidden = true; hint.hidden = false;
    } catch {
      failed = true;
      status.textContent = 'Mesh unavailable. Try again.'; retry.hidden = false; hint.hidden = true;
    }
  };
  const update = () => failed ? Promise.resolve() : (loading ||= apply().finally(() => { loading = null; }));
  retry.addEventListener('click', () => { failed = false; update(); });
  viewport.addEventListener('viewer-released', () => {
    viewport.classList.remove('ready'); status.hidden = false;
    status.textContent = 'Mesh paused. Tap to reload.'; retry.hidden = false; hint.hidden = true;
  });
  viewport.addEventListener('viewer-restored', () => {
    viewport.classList.add('ready'); status.hidden = true; retry.hidden = true; hint.hidden = false;
    viewer.wireframe(mode === 'topology'); rotate();
  });
  viewport.addEventListener('viewer-restore-failed', () => { retry.hidden = false; });
  return {
    async show(next) {
      mode = next; shown = true; pane.hidden = false;
      await update();
      // A mode change can arrive while the one shared GLB is still loading.
      if (!failed && viewer?.state().modelFile && !viewer.state().released) {
        await viewer.load(globalThis.meshAxiomAssetUrl({ file, textured: mode === 'material' }), { preserveView: true });
        viewer.wireframe(mode === 'topology'); rotate();
      }
    },
    hide() { shown = false; pane.hidden = true; rotate(); },
    visible(value) { visible = value; rotate(); },
    state: () => ({ kind: 'model', mode, file, ready: !!viewer?.state().modelFile && !viewer.state().released,
      ...(viewer?.state() || {}) }),
  };
}
