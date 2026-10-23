// Static previews show every real mesh; a 3D context is created on request.
// Each card names its metadata file (data-models); cards marked data-autoload open in 3D on their own.
import { materialFile, textureMetadata, geometryFile } from './texture-quality.js?v=kit-hover-v56-r1-20261012';
const catalogs = new Map();
const catalog = url => {
  if (!catalogs.has(url)) catalogs.set(url, fetch(globalThis.meshAxiomAssetUrl(url)).then(response => {
    if (!response.ok) throw new Error('Model information could not load');
    return response.json();
  }).catch(error => { catalogs.delete(url); throw error; }));
  return catalogs.get(url);
};

for (const card of document.querySelectorAll('.space-model-card')) {
  const libraryCard = Boolean(card.closest('#library-grid'));
  const viewport = card.querySelector('.space-model-viewport');
  const image = viewport.querySelector('img');
  const inspect = card.querySelector('[data-model-inspect]');
  const hint = card.querySelector('.space-model-hint');
  const status = card.querySelector('.space-model-status');
  // The library separates its gray surface from the actual triangle overlay.
  let mode = 'material', viewer, viewerPromise, revision = 0;
  const topologyButton = card.querySelector('[data-model-mode="topology"]');
  const wired = selected => selected === 'topology' || (!topologyButton && selected === 'gray');
  const modelFile = async (item, selected) => {
    // Library inspection and Download use the same highest-quality published GLB.
    const download = libraryCard && card.querySelector('.hd-model-download');
    if (download) return download.href;
    return topologyButton || selected === 'material' ? materialFile(item, card) : geometryFile(item);
  };
  const getAsset = async () => {
    const items = await catalog(card.dataset.models || 'assets/space/models.json');
    const item = items.find(item => item.key === card.dataset.modelKey);
    if (!item) throw new Error('Model binding could not load');
    return item;
  };
  const asset = libraryCard ? null : getAsset();
  // Keep a missing metadata file from becoming an unhandled rejection before
  // the user requests an interactive view; the checked static images still work.
  asset?.catch(() => {});

  const materialButton = card.querySelector('[data-model-mode="material"]');
  materialButton.textContent = 'Texture';
  asset?.then(textureMetadata).then(row => {
    if (!row) return;
    const badge = document.createElement('span'); badge.className = 'texture-badge';
    badge.textContent = `${row.hdResolution / 1024}K HD`;
    card.querySelector('header').append(badge);
  }).catch(() => {});

  async function getViewer() {
    if (!viewerPromise) viewerPromise = import('./creation-viewer.js?v=main-hd-refresh-20261011').then(module => {
      viewer = module.createAssetViewer(viewport, () => {}, { modelSize: 3.6, wireOpacity: .3, edgeLines: true, ambientIntensity: 1.2, fit: true, fitMargins: { side: .9, top: .86, bottom: -.5 } });
      // Spacecraft turn continuously, whatever appearance is selected.
      viewer.rotate(!matchMedia('(prefers-reduced-motion: reduce)').matches);
      return viewer;
    }).catch(error => { viewerPromise = null; throw error; });
    return viewerPromise;
  }
  async function loadSelection(preserveView = true) {
    const token = ++revision, selected = mode;
    if (selected === 'input') return;
    if (inspect) inspect.disabled = true;
    viewport.setAttribute('aria-busy', 'true');
    status.textContent = selected === 'topology' ? 'Loading the mesh topology…' : 'Loading the interactive mesh…'; status.hidden = false;
    try {
      const item = await (libraryCard ? getAsset() : asset), v = await getViewer();
      if (token !== revision || selected !== mode) return;
      const file = await modelFile(item, selected);
      if (token !== revision || selected !== mode) return;
      await v.load(globalThis.meshAxiomAssetUrl({ file, textured: selected === 'material' }), { preserveView, releaseInactive: true });
      if (token !== revision || selected !== mode) return;
      v.wireframe(wired(selected)); viewport.classList.add('ready'); hint.hidden = false;
      if (inspect) inspect.hidden = true;
      status.hidden = true; card.dataset.modelState = 'ready';
    } catch {
      if (token !== revision) return;
      viewport.classList.remove('ready'); hint.hidden = true;
      if (inspect) inspect.hidden = false;
      card.dataset.modelState = 'unavailable';
      status.textContent = libraryCard ? '3D view unavailable. Hover or tap to retry.' : '3D view unavailable. Select Inspect in 3D to retry.'; status.hidden = false;
    } finally {
      if (token === revision) { if (inspect) inspect.disabled = mode === 'input'; viewport.setAttribute('aria-busy', 'false'); }
    }
  }
  function show(next) {
    ++revision; mode = next; card.dataset.mode = next;
    card.querySelectorAll('[data-model-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.modelMode === next)));
    const preview = card.querySelector(`[data-model-mode="${next}"]`).dataset.preview;
    if (preview) image.src = globalThis.meshAxiomAssetUrl(preview);
    image.alt = `${card.dataset.modelName} — ${next === 'input' ? 'original input image' : next === 'topology' ? 'generated mesh topology' : next === 'gray' ? 'generated gray mesh' : 'mesh with texture'}`;
    if (inspect) inspect.disabled = next === 'input';
    status.hidden = true; viewport.setAttribute('aria-busy', 'false');
    if (next === 'input') return;
    // An explicit gray/topology click opens the real mesh; a poster is not used as topology evidence.
    if (libraryCard || viewerPromise || (topologyButton && (next === 'gray' || next === 'topology'))) {
      viewport.classList.remove('ready'); loadSelection(true);
    }
  }
  card.querySelectorAll('[data-model-mode]').forEach(button => button.addEventListener('click', () => show(button.dataset.modelMode)));
  inspect?.addEventListener('click', () => loadSelection(Boolean(viewer)));
  if (libraryCard) {
    const open = () => {
      if (mode !== 'input' && !viewport.classList.contains('ready') && viewport.getAttribute('aria-busy') !== 'true') loadSelection(Boolean(viewer));
    };
    viewport.loadModelSelection = open;
    card.addEventListener('pointerenter', open);
    card.addEventListener('focusin', open);
    viewport.addEventListener('pointerdown', open);

  }
  // The page keeps a budget of live 3D views (gl-pool.js): a released card shows its still image and its Inspect
  // button again until the viewer comes back.
  viewport.addEventListener('viewer-released', () => {
    viewport.classList.remove('ready'); hint.hidden = true;
    if (inspect) { inspect.hidden = false; inspect.disabled = mode === 'input'; }
    card.dataset.modelState = 'released';
    if (topologyButton && mode === 'topology') { status.textContent = libraryCard ? 'Hover or tap to view topology.' : 'Select Inspect in 3D to view topology.'; status.hidden = false; }
  });
  viewport.addEventListener('viewer-restored', () => {
    if (mode === 'input') return;
    viewer?.wireframe(wired(mode)); viewport.classList.add('ready'); hint.hidden = false;
    if (inspect) inspect.hidden = true;
    status.hidden = true; card.dataset.modelState = 'ready';
  });
  viewport.getModelState = () => ({ mode, wireframe: wired(mode), ready: card.dataset.modelState === 'ready', viewer: viewer?.state() || null });
  // The two spacecraft are small (≤1 MB), so they open in 3D as soon as they come near the viewport.
  if ('autoload' in card.dataset) new IntersectionObserver((entries, observer) => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();
    if (mode !== 'input' && !viewer) loadSelection(false);
  }, { rootMargin: '200px' }).observe(viewport);
  new IntersectionObserver(entries => {
    // Keep the matching still visible after an offscreen resize clears a WebGL
    // buffer. Interactive rendering resumes when the card enters the viewport.
    viewport.dataset.visible = String(entries[0].isIntersecting);
  }).observe(viewport);
}

// Cross-origin mirrors need a Blob download; same-origin links keep native downloads.
// This also preserves the assembly part links when the page uses an external asset base.
document.addEventListener('click', async event => {
  const download = event.target.closest?.('a[download]');
  if (!download || new URL(download.href).origin === location.origin) return;
  event.preventDefault();
  if (download.getAttribute('aria-busy') === 'true') return;
  download.setAttribute('aria-busy', 'true');
  const status = download.closest('.space-model-card, .kit-assembly-card')?.querySelector('.space-model-status, .station-status');
  try {
    const response = await fetch(globalThis.meshAxiomAssetUrl(download.href), { credentials: 'omit' });
    if (!response.ok) throw new Error('Download unavailable');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a'); link.href = globalThis.meshAxiomAssetUrl(url); link.download = download.download;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    if (status) { status.textContent = 'Download unavailable. Try again.'; status.hidden = false; }
  } finally { download.setAttribute('aria-busy', 'false'); }
});

// Project film preview: loops muted while on screen; the sound switch unmutes it.
const film = document.querySelector('.project-film-video');
if (film) {
  const sound = document.querySelector('.project-film-sound');
  let onScreen = false;
  const sync = () => { if (onScreen && !document.hidden) film.play().catch(() => {}); else film.pause(); };
  new IntersectionObserver(entries => { onScreen = entries[0].isIntersecting; sync(); }, { threshold: .2 }).observe(film);
  document.addEventListener('visibilitychange', sync);
  sound.addEventListener('click', () => {
    film.muted = !film.muted;
    sound.setAttribute('aria-pressed', String(!film.muted));
    sound.setAttribute('aria-label', film.muted ? 'Turn on sound' : 'Turn off sound');
    sound.textContent = film.muted ? 'SOUND OFF' : 'SOUND ON';
    if (!film.muted) film.play().catch(() => {});
  });
}
