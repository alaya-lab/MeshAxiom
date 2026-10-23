const viewport = document.querySelector('#budget-viewport');
const slider = document.querySelector('#budget-slider');
const root = 'assets/budgets/';
const loading = document.querySelector('#budget-loading');
const wireButton = document.querySelector('#budget-wireframe');
const rotateButton = document.querySelector('#budget-rotate');
const ticks = [...document.querySelectorAll('[data-budget-index]')];
const meshCache = new Map();
let currentIndex = Number(slider.value), revision = 0, hasMesh = false, viewerPromise;
const levelsPromise = fetch(globalThis.meshAxiomAssetUrl(root + 'levels.json')).then(response => {
  if (!response.ok) throw new Error('Face-budget metadata unavailable');
  return response.json();
});

function getViewer() {
  if (!viewerPromise) viewerPromise = import('./viewer.js').then(({ createViewer }) => createViewer(viewport));
  return viewerPromise;
}

function getMesh(level) {
  if (!meshCache.has(level.mesh)) meshCache.set(level.mesh, fetch(globalThis.meshAxiomAssetUrl(root + level.mesh)).then(response => {
    if (!response.ok) throw new Error('Face-budget mesh unavailable');
    return response.json();
  }).catch(error => { meshCache.delete(level.mesh); throw error; }));
  return meshCache.get(level.mesh);
}

async function selectLevel(index, loadMesh = true) {
  currentIndex = Math.max(0, Math.min(5, index));
  slider.value = currentIndex;
  const selectionId = ++revision;
  try {
    const levels = await levelsPromise;
    if (selectionId !== revision) return;
    const level = levels[currentIndex];
    const target = level.targetFaceCount < 1000 ? String(level.targetFaceCount) : `${level.targetFaceCount / 1000}K`;
    document.querySelector('#budget-target').textContent = target;
    document.querySelector('#budget-face-count').textContent = `${level.faceCount.toLocaleString()} faces`;
    slider.setAttribute('aria-valuetext', `${level.targetFaceCount.toLocaleString()} target faces, ${level.faceCount.toLocaleString()} generated faces`);
    slider.style.setProperty('--budget-progress', `${currentIndex * 20}%`);
    ticks.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.budgetIndex) === currentIndex)));
    const fallback = document.querySelector('#budget-fallback');
    fallback.src = globalThis.meshAxiomAssetUrl(root + level.preview);
    fallback.alt = `Dragon mesh with ${level.faceCount.toLocaleString()} faces`;
    viewport.setAttribute('aria-label', `Interactive dragon mesh with ${level.faceCount.toLocaleString()} faces at a target budget of ${level.targetFaceCount.toLocaleString()}. Drag to rotate and scroll to zoom.`);
    if (!loadMesh) return;
    loading.hidden = false;
    viewport.setAttribute('aria-busy', 'true');
    const [viewer, data] = await Promise.all([getViewer(), getMesh(level)]);
    if (selectionId !== revision) return;
    viewer.setMesh(data, level, { preserveView: hasMesh });
    hasMesh = true;
    viewport.classList.add('ready');
    viewport.dataset.targetFaces = level.targetFaceCount;
    loading.hidden = true;
    viewport.setAttribute('aria-busy', 'false');
    document.dispatchEvent(new CustomEvent('budget-mesh-ready', { detail: { targetFaceCount: level.targetFaceCount, faceCount: level.faceCount } }));
  } catch (error) {
    if (selectionId !== revision) return;
    loading.hidden = true;
    viewport.setAttribute('aria-busy', 'false');
    viewport.classList.remove('ready');
    document.querySelector('#budget-hint').textContent = 'Rendered mesh preview';
    console.warn('Face-budget viewer fallback:', error.message);
  }
}

slider.addEventListener('input', () => selectLevel(Number(slider.value)));
ticks.forEach(button => button.addEventListener('click', () => selectLevel(Number(button.dataset.budgetIndex))));
wireButton.addEventListener('click', async () => {
  try {
    const enabled = wireButton.getAttribute('aria-pressed') !== 'true';
    (await getViewer()).setWireframe(enabled);
    wireButton.setAttribute('aria-pressed', String(enabled));
  } catch { /* The existing rendered preview remains available. */ }
});
rotateButton.addEventListener('click', async () => {
  try {
    const enabled = rotateButton.getAttribute('aria-pressed') !== 'true';
    (await getViewer()).setRotate(enabled);
    rotateButton.setAttribute('aria-pressed', String(enabled));
  } catch { /* The existing rendered preview remains available. */ }
});
document.querySelector('#budget-reset').addEventListener('click', async () => {
  try { (await getViewer()).reset(); } catch { /* Keep the rendered preview. */ }
});
selectLevel(currentIndex, false);
const observer = new IntersectionObserver(entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  observer.disconnect();
  selectLevel(currentIndex);
}, { rootMargin: '250px' });
observer.observe(viewport);
