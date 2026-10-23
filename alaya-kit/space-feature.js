// Static previews show every real mesh; a 3D context is created on request.
// Each card names its metadata file (data-models); cards marked data-autoload open in 3D on their own.
import { materialFile, textureMetadata, geometryFile } from './texture-quality.js?v=best-detail-20261011-r1';
const catalogs = new Map();
const catalog = url => {
  if (!catalogs.has(url)) catalogs.set(url, fetch(globalThis.meshAxiomAssetUrl(url)).then(response => {
    if (!response.ok) throw new Error('Model information could not load');
    return response.json();
  }));
  return catalogs.get(url);
};

for (const card of document.querySelectorAll('.space-model-card')) {
  const assets = catalog(card.dataset.models || 'assets/space/models.json');
  const viewport = card.querySelector('.space-model-viewport');
  const image = viewport.querySelector('img');
  const inspect = card.querySelector('[data-model-inspect]');
  const hint = card.querySelector('.space-model-hint');
  const status = card.querySelector('.space-model-status');
  // Materials by default; the gray mesh always shows its topology lines.
  let mode = 'material', viewer, viewerPromise, revision = 0;
  const asset = assets.then(items => {
    const item = items.find(item => item.key === card.dataset.modelKey);
    if (!item) throw new Error('Model binding could not load');
    return item;
  });
  // Keep a missing metadata file from becoming an unhandled rejection before
  // the user requests an interactive view; the checked static images still work.
  asset.catch(() => {});

  const materialButton = card.querySelector('[data-model-mode="material"]');
  materialButton.textContent = 'Texture';
  asset.then(textureMetadata).then(row => {
    if (!row) return;
    const badge = document.createElement('span'); badge.className = 'texture-badge';
    badge.textContent = `${row.hdResolution / 1024}K HD`;
    card.querySelector('header').append(badge);
  }).catch(() => {});

  async function getViewer() {
    if (!viewerPromise) viewerPromise = import('./creation-viewer.js?v=tiled-ai-sr-20261011').then(module => {
      viewer = module.createAssetViewer(viewport, () => {}, { modelSize: 3.6, wireOpacity: .3, edgeLines: true, ambientIntensity: 1.2, fit: true, fitMargins: { side: .9, top: .86, bottom: -.5 } });
      // Spacecraft turn continuously, whatever appearance is selected.
      viewer.rotate(!matchMedia('(prefers-reduced-motion: reduce)').matches);
      return viewer;
    }).catch(error => { viewerPromise = null; throw error; });
    return viewerPromise;
  }
  async function show(next) {
    const token = ++revision;
    mode = next; card.dataset.mode = next;
    card.querySelectorAll('[data-model-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.modelMode === next)));
    image.src = globalThis.meshAxiomAssetUrl(card.querySelector(`[data-model-mode="${next}"]`).dataset.preview);
    image.alt = `${card.dataset.modelName} — ${next === 'input' ? 'original input image' : next === 'gray' ? 'generated mesh with wireframe' : 'mesh with texture'}`;
    inspect.disabled = next === 'input';
    status.hidden = true;
    if (!viewer || next === 'input') return;
    viewport.classList.remove('ready');
    try {
      const item = await asset;
      const textured = next !== 'gray';
      const file = textured ? await materialFile(item, card) : await geometryFile(item);
      await viewer.load(globalThis.meshAxiomAssetUrl({ file, textured }), { preserveView: true, releaseInactive: true });
      if (token !== revision) return;
      viewer.wireframe(next === 'gray');
      viewport.classList.add('ready'); hint.hidden = false;
      inspect.hidden = true; card.dataset.modelState = 'ready';
    } catch {
      viewport.classList.remove('ready'); hint.hidden = true;
      status.textContent = '3D view unavailable. Explore the rendered mesh preview.'; status.hidden = false;
    }
  }
  card.querySelectorAll('[data-model-mode]').forEach(button => button.addEventListener('click', () => show(button.dataset.modelMode)));
  inspect.addEventListener('click', async () => {
    inspect.disabled = true; viewport.setAttribute('aria-busy', 'true');
    status.textContent = 'Loading the interactive mesh…'; status.hidden = false;
    const token = ++revision;
    try {
      const item = await asset, v = await getViewer();
      const textured = mode !== 'gray';
      const file = textured ? await materialFile(item, card) : await geometryFile(item);
      await v.load(globalThis.meshAxiomAssetUrl({ file, textured }), { releaseInactive: true });
      if (token !== revision || mode === 'input') return;
      v.wireframe(mode === 'gray'); viewport.classList.add('ready'); hint.hidden = false;
      inspect.hidden = true; status.hidden = true;
      card.dataset.modelState = 'ready';
    } catch {
      status.textContent = '3D view unavailable. Explore the rendered mesh preview.'; status.hidden = false;
    } finally {
      inspect.disabled = mode === 'input'; viewport.setAttribute('aria-busy', 'false');
    }
  });
  // The page keeps a budget of live 3D views (gl-pool.js): a released card shows its still image and its Inspect
  // button again until the viewer comes back.
  viewport.addEventListener('viewer-released', () => {
    viewport.classList.remove('ready'); hint.hidden = true;
    inspect.hidden = false; inspect.disabled = mode === 'input'; card.dataset.modelState = 'released';
  });
  viewport.addEventListener('viewer-restored', () => {
    if (mode === 'input') return;
    viewport.classList.add('ready'); hint.hidden = false; inspect.hidden = true; card.dataset.modelState = 'ready';
  });
  viewport.getModelState = () => ({ mode, wireframe: mode === 'gray', ready: card.dataset.modelState === 'ready', viewer: viewer?.state() || null });
  // The two spacecraft are small (≤1 MB), so they open in 3D as soon as they come near the viewport.
  if ('autoload' in card.dataset) new IntersectionObserver((entries, observer) => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();
    if (mode !== 'input' && !viewer) inspect.click();
  }, { rootMargin: '200px' }).observe(viewport);
  new IntersectionObserver(entries => {
    // Keep the matching still visible after an offscreen resize clears a WebGL
    // buffer. Interactive rendering resumes when the card enters the viewport.
    viewport.dataset.visible = String(entries[0].isIntersecting);
  }).observe(viewport);
}

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
