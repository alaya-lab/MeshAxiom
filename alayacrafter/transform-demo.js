const section = document.querySelector('#transform');
const video = document.querySelector('#transform-video');
const status = document.querySelector('#transform-film-status');
const filmButtons = [...section.querySelectorAll('[data-film-mode]')];
const sources = {
  animation: { file: 'assets/video/transform-v53-material.mp4', poster: 'assets/images/transform-v53-material-poster.webp', label: 'Authored vehicle-to-robot transformation in the V53 material 3D view' },
  h3: { file: 'assets/video/transform-v55.mp4', poster: 'assets/images/transform-v55-poster.webp', label: 'Reviewed 30-second H3 film of a vehicle transforming into a robot and back' }
};
let mode = 'h3', resume = null, visible = false, revision = 0;

section.querySelectorAll('.transform-mesh').forEach(card => {
  const form = card.dataset.form;
  const image = card.querySelector('img');
  const label = card.querySelector('.transform-mesh-mode');
  const buttons = [...card.querySelectorAll('[data-mesh-mode]')];
  buttons.forEach(button => button.addEventListener('click', () => {
    const appearance = button.dataset.meshMode;
    card.dataset.mode = appearance;
    image.src = globalThis.meshAxiomAssetUrl(`assets/transform/${form}-${appearance}.webp`);
    image.alt = form === 'car'
      ? `Vehicle mesh ${appearance === 'gray' ? 'with neutral gray materials' : 'with materials'}`
      : `Robot pose of the generated vehicle mesh ${appearance === 'gray' ? 'with neutral gray materials' : 'with materials'}`;
    label.textContent = appearance === 'gray' ? 'GRAY MESH' : 'WITH MATERIALS';
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
});

function showStatus(text) { status.textContent = text; status.hidden = !text; }
function play() {
  const requestedRevision = revision;
  video.play().catch(error => {
    if (error.name === 'AbortError' || requestedRevision !== revision) return;
    showStatus('Press play to start the film.');
  });
}
function loaded() {
  if (!resume || resume.revision !== revision) return;
  const pending = resume;
  resume = null;
  video.currentTime = Math.max(0, Math.min(pending.time, video.duration || 30));
  showStatus('');
  if (pending.playing && visible && !document.hidden) play();
}
function switchFilm(next) {
  if (next === mode) return;
  const previous = resume || { time: video.currentTime || 0, playing: !video.paused };
  resume = { ...previous, revision: ++revision };
  mode = next;
  video.pause();
  video.src = globalThis.meshAxiomAssetUrl(sources[mode].file);
  video.poster = globalThis.meshAxiomAssetUrl(sources[mode].poster);
  video.setAttribute('aria-label', sources[mode].label);
  filmButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filmMode === mode)));
  showStatus('Loading the film…');
  video.load();
}
filmButtons.forEach(button => button.addEventListener('click', () => switchFilm(button.dataset.filmMode)));
video.addEventListener('loadedmetadata', loaded);
video.addEventListener('canplay', () => { if (!resume) showStatus(''); });
video.addEventListener('playing', () => showStatus(''));
video.addEventListener('pause', () => { if (!resume) showStatus(''); });
video.addEventListener('waiting', () => { if (!video.paused) showStatus('Loading the film…'); });
video.addEventListener('error', () => { resume = null; showStatus('The film could not load. Try switching the view.'); });
section.querySelectorAll('[data-moment]').forEach(button => button.addEventListener('click', () => {
  const time = Number(button.dataset.moment);
  if (video.readyState >= 1 && !resume) { video.currentTime = time; play(); }
  else { resume = { time, playing: true, revision: ++revision }; video.preload = 'metadata'; video.load(); showStatus('Loading the film…'); }
}));
document.querySelector('#transform-compare').addEventListener('click', () => {
  document.querySelector('#workflow-tab-transform').click();
});
new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  if (!visible) { video.pause(); if (resume) resume.playing = false; }
  else if (video.preload === 'none') video.preload = 'metadata';
}, { rootMargin: '150px' }).observe(video);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { video.pause(); if (resume) resume.playing = false; }
});
document.addEventListener('play', event => {
  if (event.target !== video) { video.pause(); if (resume) resume.playing = false; }
}, true);
section.getDemoState = () => ({ mode, time: video.currentTime, paused: video.paused, pending: !!resume, meshes: Object.fromEntries([...section.querySelectorAll('.transform-mesh')].map(card => [card.dataset.form, card.dataset.mode])) });
