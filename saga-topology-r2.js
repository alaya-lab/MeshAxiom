// Space saga page: navigation and the shared gray/material player over the acts.
import { mountWorkflow } from 'https://alaya-lab.github.io/MeshAxiom/alayacrafter/saga-player-material.js?v=topology-library-v61-r1-20261012';
import { sagaScenes, reviewedTopologyMediaBindings } from 'https://alaya-lab.github.io/MeshAxiom/alayacrafter/saga-scenes.js?v=topology-library-v61-r1-20261012';

const $ = (query, root = document) => root.querySelector(query);
const $$ = (query, root = document) => [...root.querySelectorAll(query)];

// A trailer remains covered until a current, explicit Play request succeeds.
function mountTrailerCover(video) {
  if (!video) return;
  const frame = video.closest('.saga-trailer-frame');
  const cover = $('#saga-trailer-cover'), button = $('#saga-trailer-sound');
  const label = $('[data-play-label]', button), status = $('#saga-trailer-status');
  const source = globalThis.meshAxiomAssetUrl(new URL(video.dataset.trailerSrc, document.baseURI).href);
  let generation = 0, requested = false, detachPlaying = () => {};
  const inView = () => {
    const box = frame.getBoundingClientRect();
    return Math.max(0, Math.min(box.bottom, innerHeight) - Math.max(box.top, 0)) >= box.height * .3;
  };
  function reset(message = '', restoreFocus = false) {
    ++generation; requested = false; detachPlaying(); detachPlaying = () => {};
    // Hide decoded pixels synchronously, before pausing or seeking the native video.
    frame.dataset.trailerState = 'cover'; cover.hidden = false;
    video.controls = false; video.tabIndex = -1;
    video.pause();
    try { video.currentTime = 0; } catch { /* Metadata may not exist yet. */ }
    label.textContent = 'Play trailer'; status.textContent = message;
    button.removeAttribute('aria-busy');
    if (restoreFocus) button.focus({ preventScroll: true });
  }
  button.addEventListener('click', () => {
    reset();
    const token = generation;
    requested = true; frame.dataset.trailerState = 'loading';
    label.textContent = 'Restart trailer'; status.textContent = 'Loading…';
    button.setAttribute('aria-busy', 'true');
    video.muted = false; video.defaultMuted = false; video.loop = false;
    if (video.volume === 0) video.volume = 1;
    if (!video.getAttribute('src')) video.src = globalThis.meshAxiomAssetUrl(source);
    try { video.currentTime = 0; } catch { /* A new source starts at zero. */ }
    let acknowledged = false;
    const reveal = () => {
      if (token !== generation || !requested || !acknowledged || document.hidden || !inView()) return;
      if (video.paused || video.readyState < 2 || video.currentSrc !== source) return;
      frame.dataset.trailerState = 'playing'; cover.hidden = true;
      video.controls = true; video.tabIndex = 0;
      status.textContent = ''; button.removeAttribute('aria-busy');
      if (document.activeElement === button) video.focus({ preventScroll: true });
      detachPlaying(); detachPlaying = () => {};
    };
    video.addEventListener('playing', reveal);
    detachPlaying = () => video.removeEventListener('playing', reveal);
    try {
      // Invoke play in the click gesture; never wait for fetch or a blob swap first.
      Promise.resolve(video.play()).then(() => {
        if (token !== generation || !requested) return;
        acknowledged = true; reveal();
      }).catch(() => {
        if (token === generation) reset('Playback could not start. Press Play to try again.');
      });
    } catch {
      if (token === generation) reset('Playback could not start. Press Play to try again.');
    }
  });
  video.addEventListener('play', () => { if (!requested) reset(); });
  video.addEventListener('playing', () => { if (!requested) reset(); });
  video.addEventListener('ended', () => reset('', document.activeElement === video));
  video.addEventListener('error', () => {
    if (requested) reset('The trailer could not load. Press Play to retry.');
  });
  new IntersectionObserver(entries => {
    if (entries[0].intersectionRatio < .3) reset();
  }, { threshold: [0, .3, .6] }).observe(frame);
  document.addEventListener('visibilitychange', () => reset());
  window.addEventListener('pagehide', () => reset());
  window.addEventListener('pageshow', () => reset());
  reset();
}
mountTrailerCover($('#saga-trailer'));


const menu = $('.menu-toggle');
const setMenu = open => {
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  $('#nav-links').classList.toggle('open', open);
  document.body.classList.toggle('menu-open', open);
};
menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
$$('#nav-links a').forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenu(false); });

// A #act3_fleet_battle-style hash opens that act; otherwise the most complete act (most finished stages, earliest first).
const fromHash = location.hash.replace('#', '');
const done = key => Object.values(sagaScenes[key].views).filter(view => view.file).length;
const ready = Object.keys(sagaScenes).reduce((best, key) => (done(key) > (best ? done(best) : 0) ? key : best), null);
const initialScene = fromHash in sagaScenes ? fromHash : (ready || Object.keys(sagaScenes)[0]);
// Autoplay (muted) while the panel is on screen, looping the selected act.
const localTopologyBindings = { ...reviewedTopologyMediaBindings(sagaScenes) };
localTopologyBindings.act2_ground_war = {
  "file": "https://alaya-lab.github.io/MeshAxiom/assets/saga/act2_ground_war-topology-r2.mp4",
  "poster": "https://alaya-lab.github.io/MeshAxiom/assets/saga/act2_ground_war-topology-r2.webp",
  "sha256": "d54ac54d2c399fa48fb6c0d95cec1b00e8f5c977dc73ecb52107f792e29274f0",
  "bytes": 16450297,
  "frames": 345,
  "fps": 24,
  "duration": 14.375,
  "width": 1344,
  "height": 768,
  "posterSha256": "93ab8ab92923846118b0b629ea84130224cbcbfb030b74d265fdbad9f7176c8e",
  "posterBytes": 79770
};
await mountWorkflow({ root: document.getElementById('saga'), prefix: 'saga', initialScene, scenes: sagaScenes, topologyMediaBindings: localTopologyBindings, autoLoop: true });

// The shared player only starts once at least half of this tall panel is on screen and does not restart after another
// act is chosen. Here the acts start (muted) as soon as both videos are well in view and whenever an act is picked;
// a Pause all pressed by the visitor is respected until another act is chosen.
const panel = $('#saga-panel'), playAll = $('#saga-play');
let visitorPaused = false, viewsShare = 0;
const startIfIdle = () => {
  if (visitorPaused || document.hidden || !panel.getPlaybackState || panel.getPlaybackState().wanted) return;
  playAll.click();
};
playAll.addEventListener('click', event => { if (event.isTrusted) visitorPaused = !panel.getPlaybackState().wanted; });
$$('#saga .workflow-tabs button').forEach(button => {
  button.addEventListener('click', () => { visitorPaused = false; startIfIdle(); });
  button.addEventListener('keydown', event => {
    if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) { visitorPaused = false; setTimeout(startIfIdle); }
  });
});
new IntersectionObserver(entries => {
  viewsShare = entries[0].intersectionRatio;
  if (viewsShare >= .35) startIfIdle();
}, { threshold: [0, .2, .35, .6, 1] }).observe($('#saga-views'));
document.addEventListener('visibilitychange', () => { if (!document.hidden && viewsShare >= .35) startIfIdle(); });

