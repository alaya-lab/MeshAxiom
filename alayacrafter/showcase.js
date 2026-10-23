import { mountShowcaseGeometry } from './showcase-geometry.js?v=geometry-v52-r1-20261011';

const cards = [...document.querySelectorAll('.showcase-card')];
const controllers = new Map();
const scenePlayback = new Map();

function sceneState(card) {
  if (!scenePlayback.has(card)) scenePlayback.set(card, { wanted: true, time: 0, pending: null });
  return scenePlayback.get(card);
}

function scenePosition(card, video) {
  const state = sceneState(card);
  if (state.pending?.mode === video.dataset.mode) {
    if (video.readyState < 1) return false;
    const target = Math.min(state.pending.time, Math.max(0, video.duration - 1 / 24));
    state.pending = null;
    if (Math.abs(video.currentTime - target) > .015) {
      video.pause(); video.currentTime = target; return false;
    }
  }
  return !video.seeking;
}

function geometry(card) {
  if (!controllers.has(card)) controllers.set(card, mountShowcaseGeometry(card));
  return controllers.get(card);
}

function update(card) {
  const mode = card.dataset.mode;
  const visible = card.dataset.visible === 'true' && !document.hidden;
  const interactive = (mode === 'gray' && card.dataset.kind !== 'scene') || card.dataset.kind === 'interactive';
  for (const video of card.querySelectorAll('video')) {
    const selected = !interactive && video.dataset.mode === mode;
    if (!selected || !visible) { video.pause(); continue; }
    if (!video.getAttribute('src')) { video.src = globalThis.meshAxiomAssetUrl(video.dataset.src); video.load(); }
    if (card.dataset.kind === 'scene' && (!scenePosition(card, video) || !sceneState(card).wanted)) {
      video.pause(); continue;
    }
    const promise = video.play();
    promise?.then(() => {
      if (card.dataset.mode !== video.dataset.mode || card.dataset.visible !== 'true' || document.hidden ||
          (card.dataset.kind === 'scene' && !sceneState(card).wanted)) video.pause();
    }).catch(() => {});
  }
  if (interactive && visible) {
    const view = geometry(card); view.visible(true); view.show(mode);
  } else {
    const view = controllers.get(card);
    view?.visible(false);
    if (!interactive) view?.hide();
  }
}

const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    entry.target.dataset.visible = String(entry.isIntersecting && entry.intersectionRatio >= .34);
    update(entry.target);
  }
}, { threshold: [0, .34, .7] });

for (const card of cards) {
  observer.observe(card);
  if (card.dataset.kind === 'scene') {
    for (const video of card.querySelectorAll('video')) {
      for (const event of ['loadedmetadata', 'canplay', 'seeked']) video.addEventListener(event, () => update(card));
    }
  }
  card.querySelectorAll('[data-showcase-mode]').forEach(button => button.addEventListener('click', () => {
    if (card.dataset.kind === 'scene' && button.dataset.showcaseMode !== card.dataset.mode) {
      const previous = card.querySelector(`video[data-mode="${card.dataset.mode}"]`), state = sceneState(card);
      // A mode change may pause the old movie while its seek/metadata is pending.
      // Capture a visitor pause only from a stable view.
      if (previous?.readyState >= 1 && !previous.seeking && !state.pending) { state.time = previous.currentTime; state.wanted = !previous.paused; }
      state.pending = { mode: button.dataset.showcaseMode, time: state.time };
    }
    card.dataset.mode = button.dataset.showcaseMode;
    card.querySelectorAll('[data-showcase-mode]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    update(card);
  }));
  card.getShowcaseState = () => ({ mode: card.dataset.mode, visible: card.dataset.visible === 'true',
    scenePlayback: card.dataset.kind === 'scene' ? { ...sceneState(card) } : null,
    geometry: controllers.get(card)?.state() || null,
    videos: [...card.querySelectorAll('video')].map(video => ({ mode: video.dataset.mode,
      loaded: !!video.getAttribute('src'), paused: video.paused, time: video.currentTime,
      readyState: video.readyState, source: video.getAttribute('src') })) });
}
document.addEventListener('visibilitychange', () => cards.forEach(update));
