import { mountWorkflow } from './workflow.js';
const $ = (query, root = document) => root.querySelector(query);
const $$ = (query, root = document) => [...root.querySelectorAll(query)];
const mediaRoot = 'assets/';
let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2600);
}

const menu = $('.menu-toggle');
menu.addEventListener('click', () => {
  const expanded = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(expanded));
  menu.setAttribute('aria-label', expanded ? 'Close navigation' : 'Open navigation');
  $('#nav-links').classList.toggle('open', expanded);
  document.body.classList.toggle('menu-open', expanded);
});
function closeMenu() {
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Open navigation');
  $('#nav-links').classList.remove('open');
  document.body.classList.remove('menu-open');
}
$$('#nav-links a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  $$('.nav-links a').forEach(link => link.classList.toggle('active', link.hash === `#${entry.target.id}`));
}), { rootMargin: '-15% 0px -60% 0px' }).observe($('#assets'));
const navObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) $$('.nav-links a').forEach(link => link.classList.toggle('active', link.hash === `#${entry.target.id}`));
  });
}, { rootMargin: '-15% 0px -60% 0px' });
['space', 'kit', 'transform', 'materials', 'workflow', 'method', 'resources'].forEach(id => navObserver.observe(document.getElementById(id)));

// The scene comparison shares one timeline across all three rendering stages.
mountWorkflow();
mountWorkflow({ root: document.getElementById('space'), prefix: 'space', initialScene: 'space', autoLoop: true });
mountWorkflow({ root: document.getElementById('breakup'), prefix: 'breakup', initialScene: 'breakup', autoLoop: true });

$('#copy-citation').addEventListener('click', async () => {
  const text = $('#bibtex').textContent;
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else {
      const field = document.createElement('textarea');
      field.value = text; field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.append(field); field.select();
      const copied = document.execCommand('copy'); field.remove();
      if (!copied) throw new Error('Copy unavailable');
    }
    $('#copy-citation span').textContent = 'Copied';
    toast('BibTeX copied to clipboard');
    setTimeout(() => { $('#copy-citation span').textContent = 'Copy BibTeX'; }, 2400);
  } catch {
    const range = document.createRange(); range.selectNodeContents($('#bibtex'));
    window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
    toast('Citation selected — copy it with your keyboard');
  }
});

let gallery = [];
let selectedAsset;
let viewer;
let viewerPromise;
let pendingSelection = 0;
const shortNames = { UE01: 'Scooter', UE04: 'Horse', UE05: 'Monkey', UE16: 'Fire hydrant', UE21: 'Gargoyle', UE23: 'Rearing horse', UE28: 'Rifle', UE29: 'Armchair' };
async function getViewer() {
  if (viewer) return viewer;
  if (!viewerPromise) viewerPromise = import('./viewer.js').then(module => {
    viewer = module.createViewer($('#mesh-viewport'));
    return viewer;
  });
  return viewerPromise;
}
async function chooseAsset(item, loadMesh = true) {
  selectedAsset = item;
  const selectionId = ++pendingSelection;
  $('#asset-title').textContent = item.label;
  $('#mesh-count').textContent = `${item.faceCount.toLocaleString()} faces`;
  $('#asset-description').textContent = item.description.replace(/^[^:]+:\s*/, '');
  $('#asset-input').src = globalThis.meshAxiomAssetUrl(`assets/gallery/${item.input}`);
  $('#asset-input').alt = `Single input image: ${item.label}`;
  $('#asset-reference').src = globalThis.meshAxiomAssetUrl(`assets/gallery/${item.gt}`);
  $('#asset-reference').alt = `Artist-created reference mesh: ${item.label}`;
  $('#mesh-fallback').src = globalThis.meshAxiomAssetUrl(`assets/gallery/${item.ours}`);
  $('#mesh-fallback').alt = `Generated mesh: ${item.label}`;
  $('#mesh-viewport').setAttribute('aria-label', `Interactive 3D view of ${item.label}. Drag to rotate and scroll to zoom.`);
  $$('.asset-choice').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.code === item.code)));
  if (!loadMesh) return;
  $('#viewer-loading').hidden = false;
  try {
    const v = await getViewer();
    if (selectionId !== pendingSelection) return;
    const response = await fetch(globalThis.meshAxiomAssetUrl(`assets/gallery/${item.mesh}`));
    if (!response.ok) throw new Error('Mesh unavailable');
    const mesh = await response.json();
    if (selectionId !== pendingSelection) return;
    v.setMesh(mesh, item);
    $('#mesh-viewport').classList.add('ready');
    $('#viewer-loading').hidden = true;
    document.dispatchEvent(new CustomEvent('mesh-ready', { detail: { code: item.code, faceCount: item.faceCount } }));
  } catch (error) {
    $('#viewer-loading').hidden = true;
    $('#mesh-viewport').classList.remove('ready');
    $('#viewer-hint').textContent = 'Rendered mesh preview · 3D view unavailable';
    console.warn('3D viewer fallback:', error.message);
  }
}
fetch(globalThis.meshAxiomAssetUrl('assets/gallery/gallery.json')).then(response => {
  if (!response.ok) throw new Error('Gallery metadata unavailable');
  return response.json();
}).then(items => {
  gallery = items;
  gallery.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'asset-choice'; button.dataset.code = item.code;
    button.setAttribute('aria-label', `Explore ${item.label}, ${item.faceCount.toLocaleString()} faces`);
    button.setAttribute('aria-pressed', 'false');
    const code = document.createElement('span'); code.className = 'asset-choice-code'; code.textContent = item.code;
    const image = document.createElement('img'); image.src = globalThis.meshAxiomAssetUrl(`assets/gallery/${item.ours}`); image.alt = ''; image.loading = 'lazy'; image.width = 140; image.height = 110;
    const name = document.createElement('span'); name.className = 'asset-choice-name'; name.textContent = shortNames[item.code] || item.label;
    button.append(code, image, name);
    button.addEventListener('click', () => chooseAsset(item));
    $('#asset-selector').append(button);
  });
  chooseAsset(items[0], false);
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      chooseAsset(selectedAsset); observer.disconnect();
    }
  }, { rootMargin: '300px' });
  observer.observe($('#mesh-viewport'));
}).catch(error => {
  $('#viewer-loading').hidden = true;
  $('#viewer-hint').textContent = 'Rendered mesh preview';
  console.error(error);
});
$('#wireframe-toggle').addEventListener('click', async event => {
  const button = event.currentTarget;
  const enabled = button.getAttribute('aria-pressed') !== 'true';
  try { (await getViewer()).setWireframe(enabled); button.setAttribute('aria-pressed', String(enabled)); }
  catch { toast('Interactive 3D is unavailable in this browser'); }
});
$('#rotate-toggle').addEventListener('click', async event => {
  const button = event.currentTarget;
  const enabled = button.getAttribute('aria-pressed') !== 'true';
  try { (await getViewer()).setRotate(enabled); button.setAttribute('aria-pressed', String(enabled)); }
  catch { toast('Interactive 3D is unavailable in this browser'); }
});
$('#reset-view').addEventListener('click', async () => {
  try { (await getViewer()).reset(); } catch { toast('Interactive 3D is unavailable in this browser'); }
});
