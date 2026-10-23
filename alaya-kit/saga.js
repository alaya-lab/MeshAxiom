// Six-act space saga page: navigation and the shared three-stage player (workflow.js) over the six acts.
import { mountWorkflow } from './workflow.js';
import { sagaScenes } from './saga-scenes.js';

const $ = (query, root = document) => root.querySelector(query);
const $$ = (query, root = document) => [...root.querySelectorAll(query)];

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
mountWorkflow({ root: document.getElementById('saga'), prefix: 'saga', initialScene, scenes: sagaScenes, autoLoop: true });

// The shared player only starts once at least half of this tall panel is on screen and does not restart after another
// act is chosen. Here the acts start (muted) as soon as the three videos are well in view and whenever an act is picked;
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

// The host ignores HTTP range requests, so a streamed MP4 is not seekable (the act player handles its own videos in
// workflow.js). The trailer is swapped for an in-memory copy (blob URL) once it has downloaded; the browser cache serves it.
const blobUrls = new Map();
async function blobOf(src) {
  const url = new URL(src, document.baseURI).href;
  if (!blobUrls.has(url)) blobUrls.set(url, fetch(globalThis.meshAxiomAssetUrl(url)).then(r => r.ok ? r.blob() : Promise.reject(r.status)).then(b => URL.createObjectURL(b)));
  return blobUrls.get(url);
}

// Trailer at the top: a muted preview loop while it is on screen; "Watch with sound" restarts it with sound and native
// controls, and it returns to the silent loop when it ends. Scrolled away (less than 30% visible) it pauses.
const trailer = $('#saga-trailer');
if (trailer) {
  const frame = trailer.closest('.saga-trailer-frame'), soundButton = $('#saga-trailer-sound');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The silent preview skips the title card on black at the start and loops from the first shot.
  const start = Number(trailer.dataset.previewStart || 0);
  let withSound = false, trailerShare = 1;
  const tryPlay = () => trailer.play().catch(() => {});
  const ambient = () => {
    withSound = false; trailer.controls = false; trailer.muted = true;
    frame.classList.remove('with-sound'); soundButton.hidden = false;
  };
  if (still) trailer.pause();
  // Autoplay often starts before this module runs (and #t=<start> on the source is not always honoured), so jump once, at
  // the first sign of loaded media or playback progress.
  let jumped = false;
  const toStart = () => {
    if (jumped || withSound || trailer.readyState < 1) return;
    jumped = true; if (trailer.currentTime < start - .05) trailer.currentTime = start;
  };
  toStart(); trailer.addEventListener('loadedmetadata', toStart); trailer.addEventListener('timeupdate', toStart);
  const source = trailer.querySelector('source');
  if (source) blobOf(source.getAttribute('src').split('#')[0]).then(url => {
    const t = trailer.currentTime, wasPlaying = !trailer.paused;
    trailer.src = globalThis.meshAxiomAssetUrl(url); jumped = false;
    trailer.addEventListener('loadedmetadata', () => {
      trailer.currentTime = withSound ? t : Math.max(t, start); jumped = true;
      if (wasPlaying || (!withSound && !still && trailerShare >= .3)) tryPlay();
    }, { once: true });
  }).catch(() => {});
  soundButton.addEventListener('click', () => {
    withSound = true; trailer.muted = false; trailer.controls = true; trailer.currentTime = 0;
    frame.classList.add('with-sound'); soundButton.hidden = true; tryPlay();
  });
  trailer.addEventListener('ended', () => { ambient(); trailer.currentTime = start; if (!still) tryPlay(); });
  new IntersectionObserver(entries => {
    trailerShare = entries[0].intersectionRatio;
    if (trailerShare < .3) { if (!trailer.paused) trailer.pause(); }
    else if (trailer.paused && !withSound && !still) tryPlay();
  }, { threshold: [0, .3, .6] }).observe(trailer);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) trailer.pause(); else if (trailerShare >= .3 && !withSound && !still) tryPlay();
  });
}
