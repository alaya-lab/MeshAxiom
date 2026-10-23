const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const root = 'assets/workbench/';
const hydraSource = 'https://alaya-lab.github.io/MeshAxiom/alaya-kit/source-assets/hydra/';
const sceneSource = 'https://alaya-lab.github.io/MeshAxiom/alaya-kit/source-assets/scenes/';
const carSource = 'https://alaya-lab.github.io/MeshAxiom/alaya-kit/source-assets/car/';
const assets = {
  hydra: {
    name: 'Three-headed dragon', title: 'Three heads. One animated mesh.', label: 'GEOMETRY → MATERIALS → ANIMATION',
    copy: 'A single-image mesh receives Pixal3D materials and an authored 34-bone rig. The geometry stays the same as it takes flight.',
    input: 'hydra-input.webp', preview: 'hydra-preview.webp', scene: 'dragon', defaultView: 'textured',
    modes: {
      textured: { button: 'Textured', file: 'hydra-flight.glb', textured: true, label: 'MESHAXIOM + PIXAL3D', note: 'Textures on unseen surfaces are inferred. Explore the same animation with or without materials.', source: hydraSource + '#library', download: hydraSource + 'flight-pixal3d-v2/hydra_flight_rigged.glb' },
      geometry: { button: 'Geometry', file: 'hydra-flight.glb', textured: false, label: 'MESHAXIOM · GENERATED GEOMETRY', note: 'The same 4,459 faces and authored animation, with neutral materials.', source: hydraSource + '#library', download: hydraSource + 'geometry/mesh.obj' },
      meshy: { button: 'Meshy comparison', file: 'meshy-hydra.json', textured: false, label: 'MESHY SMARTTOPOLOGY · INDEPENDENT BASELINE', note: 'Meshy generates this mesh independently from the same image and 4K requested budget. It is not a remesh of MeshAxiom output; actual face counts differ.', source: hydraSource + '#meshy-smart-topology', download: hydraSource + 'meshy-smart-v1/model.glb' }
    }
  },
  car: {
    name: 'Open-window car', title: 'Open the windows. Keep the structure.', label: 'GENERATED MESH → LOCAL EDIT',
    copy: 'A localized edit removes unwanted window faces while keeping every original vertex position. Compare the generated mesh with the edited result from the same camera.',
    input: 'car-input.webp', preview: 'car-preview.webp', defaultView: 'edited',
    modes: {
      edited: { button: 'Open-window edit', file: 'car-open-windows.json', textured: false, label: 'MESHAXIOM · LOCAL MESH EDIT', note: '22 faces removed; roof, pillars, mirrors and wheels retain their positions. Open windows are the requested edit; unfinished cabin surfaces remain.', source: carSource, download: carSource + 'new/current/mesh.obj' },
      original: { button: 'Original mesh', file: 'car-original.json', textured: false, label: 'MESHAXIOM · ORIGINAL MESH', note: 'The original 3,961-face output is preserved. Switch views to inspect the localized edit; no vertices were moved.', source: carSource, download: carSource + 'old/current/mesh.obj' }
    }
  },
  house: {
    name: 'Watermill house', title: 'Whole modules. An assembled house.', label: 'GENERATED PARTS → ASSEMBLY → MATERIALS',
    copy: 'Generated wall, frame, roof and chimney components become one watermill house. Pixal3D materials bring the assembled geometry into the lakeside scene.',
    preview: 'house-preview.webp', scene: 'lakeside', defaultView: 'textured',
    modes: {
      textured: { button: 'Textured', file: 'watermill-house.glb', textured: true, label: 'MESHAXIOM + PIXAL3D', note: 'Modules and placement are authored. Small seams and openings remain; this demonstration does not include a traversable interior.', source: sceneSource + 'lakeside.html#world-stillwater-complete-v5', download: sceneSource + 'world_stillwater_complete_v5_house_glb.glb' },
      geometry: { button: 'Geometry', file: 'watermill-house.glb', textured: false, label: 'ASSEMBLED GENERATED GEOMETRY', note: 'The same 69,423 triangles, without texture maps. The semantic modules retain their original geometry.', source: sceneSource + 'lakeside.html#world-stillwater-complete-v5', download: sceneSource + 'world_stillwater_complete_v5_house_glb.glb' }
    }
  },
  wheel: {
    name: 'Waterwheel', title: 'Parts that turn together.', label: 'GENERATED PARTS → ASSEMBLY → MATERIALS',
    copy: 'Generated rim, axle and thick paddle modules form a waterwheel. Inspect the textured assembly here, then watch it turn in the lakeside scene.',
    preview: 'wheel-preview.webp', scene: 'lakeside', defaultView: 'textured',
    modes: {
      textured: { button: 'Textured', file: 'waterwheel.glb', textured: true, label: 'MESHAXIOM + PIXAL3D', note: 'Pixal3D materials are applied to the generated parts; the assembly and scene animation are authored.', source: sceneSource + 'lakeside.html#world-stillwater-complete-v5', download: sceneSource + 'world_stillwater_complete_v5_wheel_glb.glb' },
      geometry: { button: 'Geometry', file: 'waterwheel.glb', textured: false, label: 'ASSEMBLED GENERATED GEOMETRY', note: 'The same 41,140 triangles, without texture maps. Small seams in the assembly remain visible.', source: sceneSource + 'lakeside.html#world-stillwater-complete-v5', download: sceneSource + 'world_stillwater_complete_v5_wheel_glb.glb' }
    }
  }
};
let activeAsset = 'hydra', activeView = 'textured', request = 0, viewer, viewerPromise;
const viewport = $('#creation-viewport');
function animationState({ time, duration, playing }) {
  $('#creation-play').hidden = !duration;
  $('#creation-animation').hidden = !duration;
  $('#creation-play').setAttribute('aria-pressed', String(playing));
  $('#creation-play').textContent = playing ? 'Pause animation' : 'Play animation';
  $('#creation-time').max = duration || 12; $('#creation-time').value = time;
  $('#creation-time-label').value = `${time.toFixed(1)} / ${(duration || 12).toFixed(1)} s`;
  viewport.dataset.animationTime = String(time);
}
async function getViewer() {
  if (!viewerPromise) viewerPromise = import('./creation-viewer.js').then(({ createAssetViewer }) => {
    viewer = createAssetViewer(viewport, animationState); return viewer;
  });
  return viewerPromise;
}
async function chooseView(view, { preserveView = true } = {}) {
  activeView = view;
  const asset = assets[activeAsset], mode = asset.modes[view], id = ++request;
  $('#creation-mode-label').textContent = mode.label;
  $('#creation-note').textContent = mode.note;
  $('#creation-source').href = globalThis.meshAxiomAssetUrl(mode.source); $('#creation-download').href = globalThis.meshAxiomAssetUrl(mode.download);
  $$('#creation-modes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  $('#creation-loading').hidden = false;
  viewport.setAttribute('aria-busy', 'true');
  try {
    const v = await getViewer();
    if (id !== request) return;
    const result = await v.load(globalThis.meshAxiomAssetUrl({ ...mode, file: root + mode.file }), { preserveView });
    if (id !== request || !result) return;
    $('#creation-face-count').textContent = `${result.faces.toLocaleString()} faces`;
    viewport.classList.add('ready'); viewport.dataset.asset = activeAsset; viewport.dataset.view = view;
    viewport.setAttribute('aria-label', `Interactive ${asset.name}: ${mode.button}. Drag to rotate and scroll to zoom.`);
    viewport.setAttribute('aria-busy', 'false'); $('#creation-loading').hidden = true;
    document.dispatchEvent(new CustomEvent('creation-ready', { detail: { asset: activeAsset, view, faces: result.faces } }));
  } catch (error) {
    if (id !== request) return;
    viewport.setAttribute('aria-busy', 'false'); $('#creation-loading').hidden = true;
    $('#creation-note').textContent = 'The interactive view is unavailable. Explore the original model at the source.';
    console.warn('Asset viewer fallback:', error.message);
  }
}
function chooseAsset(key) {
  activeAsset = key;
  const asset = assets[key];
  $('#creation-model-title').textContent = asset.name;
  $('#creation-story-title').textContent = asset.title; $('#creation-story-label').textContent = asset.label;
  $('#creation-copy').textContent = asset.copy;
  $('#creation-reference').hidden = !asset.input;
  if (asset.input) { $('#creation-input').src = globalThis.meshAxiomAssetUrl(root + asset.input); $('#creation-input').alt = `Input image used to generate ${asset.name}`; }
  $('#creation-fallback').src = globalThis.meshAxiomAssetUrl(root + asset.preview); $('#creation-fallback').alt = asset.name;
  $('#creation-watch').hidden = !asset.scene; $('#creation-watch').dataset.scene = asset.scene || '';
  $('#creation-modes').replaceChildren(...Object.entries(asset.modes).map(([view, mode]) => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.view = view; button.textContent = mode.button; return button;
  }));
  $$('.creation-selector button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.asset === key)));
  chooseView(asset.defaultView, { preserveView: false });
}
$('#creation-modes').addEventListener('click', event => {
  const button = event.target.closest('button[data-view]');
  if (button && button.dataset.view !== activeView) chooseView(button.dataset.view);
});
$$('.creation-selector button').forEach(b => b.addEventListener('click', () => chooseAsset(b.dataset.asset)));
$('#creation-wire').addEventListener('click', async () => {
  const enabled = $('#creation-wire').getAttribute('aria-pressed') !== 'true';
  (await getViewer()).wireframe(enabled); $('#creation-wire').setAttribute('aria-pressed', String(enabled));
});
$('#creation-rotate').addEventListener('click', async () => {
  const enabled = $('#creation-rotate').getAttribute('aria-pressed') !== 'true';
  (await getViewer()).rotate(enabled); $('#creation-rotate').setAttribute('aria-pressed', String(enabled));
});
$('#creation-play').addEventListener('click', async () => (await getViewer()).play($('#creation-play').getAttribute('aria-pressed') !== 'true'));
$('#creation-reset').addEventListener('click', async () => (await getViewer()).reset());
$('#creation-time').addEventListener('input', async event => (await getViewer()).seek(Number(event.target.value)));
$('#creation-watch').addEventListener('click', () => document.querySelector(`#workflow-tab-${$('#creation-watch').dataset.scene}`)?.click());
const observer = new IntersectionObserver(entries => {
  if (entries.some(e => e.isIntersecting)) { chooseAsset('hydra'); observer.disconnect(); }
}, { rootMargin: '200px' });
observer.observe(viewport);
// State is also useful to client integrations inspecting the live asset preview.
viewport.getAssetState = () => viewer?.state();
