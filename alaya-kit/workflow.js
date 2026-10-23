import { scenes, stages } from './scenes.js';

// Each comparison owns a synchronized group. Starting another film pauses the
// whole group, rather than letting its three play events pause one another.
const playbackGroups = [];
let mediaListenerReady = false;
// Auto-looping panels are arbitrated together: only the one with the largest visible share
// (at least half) plays, so stacked panels never take turns pausing each other.
const autoPanels = [];
function arbitrate() {
  if (document.hidden) return;
  const best = autoPanels.filter(panel => panel.share >= .5).sort((a, b) => b.share - a.share)[0];
  best?.start();
}
function registerPlaybackGroup(videos, pause) {
  playbackGroups.push({ videos, pause });
  if (mediaListenerReady) return;
  mediaListenerReady = true;
  document.addEventListener('play', event => {
    // Ambient videos (the looping project film) neither pause nor get paused by the comparisons.
    if (!(event.target instanceof HTMLVideoElement) || 'ambient' in event.target.dataset) return;
    const active = playbackGroups.find(group => group.videos.includes(event.target));
    playbackGroups.forEach(group => { if (group !== active) group.pause(); });
    document.querySelectorAll('video').forEach(video => {
      if (video !== event.target && !active?.videos.includes(video) && !('ambient' in video.dataset)) video.pause();
    });
  }, true);
}

// autoLoop: play muted while the panel is on screen and start over at the end.
// scenes: optional scene set (default: the main page's scenes.js); the six-act page passes its own.
export function mountWorkflow({ root = document.getElementById('workflow'), prefix = 'workflow', initialScene = 'transform', autoLoop = false, scenes: sceneSet = scenes } = {}) {
  const $ = (selector, scope = root) => scope.querySelector(selector);
  const $$ = selector => [...root.querySelectorAll(selector)];
  const id = key => $(`#${prefix}-${key}`);
  const panel = id('panel'), views = id('views');
  const timeline = id('timeline'), playButton = id('play');
  const status = id('status'), audioButton = id('audio');
  const stageElements = Object.fromEntries(stages.map(stage => [stage.key, $(`.workflow-stage[data-stage="${stage.key}"]`)]));
  const videos = Object.fromEntries(stages.map(stage => [stage.key, id(`video-${stage.key}`)]));
  let sceneKey = initialScene, view = 'all', time = 0, wanted = false, playing = false;
  let initialized = false, epoch = 0, starting = false, animationFrame, audio = false, onScreen = false;
  const failed = new Set();
  // The host ignores HTTP Range requests, so a streamed MP4 is not seekable (seekable.end(0) is 0): chapter jumps and the
  // timeline snap back to 0. Once a scene's stage videos have downloaded, they are swapped for in-memory copies (blob URLs,
  // fully seekable; the browser cache serves the second request) and playback resumes where it was. The panel's blob URLs
  // are revoked when another scene is chosen.
  let sceneToken = 0, blobUrls = [];

  const scene = () => sceneSet[sceneKey];
  const available = () => stages.filter(stage => scene().views[stage.key]?.file && !failed.has(stage.key));
  const players = () => available().map(stage => videos[stage.key]);
  const master = () => players()[0];
  function formatTime(value) {
    const seconds = Math.floor(value);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${Math.floor((value - seconds) * 10 + .0001)}`;
  }
  function updateUI() {
    timeline.value = time;
    timeline.setAttribute('aria-valuetext', `${formatTime(time)} of ${formatTime(scene().duration)}`);
    id('time').value = `${formatTime(time)} / ${formatTime(scene().duration)}`;
    playButton.setAttribute('aria-pressed', String(wanted));
    playButton.setAttribute('aria-label', wanted ? 'Pause the rendering stages together' : 'Play the rendering stages together');
    playButton.children[0].textContent = wanted ? 'Ⅱ' : '▶';
    playButton.children[1].textContent = wanted ? 'Pause all' : 'Play all';
    playButton.disabled = !available().length;
    const chapters = scene().chapters;
    let active = 0;
    chapters.forEach(([at], index) => { if (time + .1 >= at) active = index; });
    [...id('chapters').querySelectorAll('button')].forEach((button, index) => button.setAttribute('aria-pressed', String(index === active)));
    panel.dataset.scene = sceneKey; panel.dataset.time = String(time);
    panel.dataset.playing = String(playing);
  }
  function stopPlayers() {
    cancelAnimationFrame(animationFrame); playing = false; starting = false;
    Object.values(videos).forEach(video => video.pause());
  }
  function pause() {
    if (playing && master()) time = Math.min(master().currentTime, scene().duration);
    wanted = false; ++epoch; stopPlayers(); updateUI();
  }
  function tick() {
    if (!playing) return;
    const lead = master();
    if (!lead) return pause();
    time = Math.min(lead.currentTime, scene().duration);
    for (const video of players()) {
      if (video !== lead && video.readyState >= 2 && !video.seeking && Math.abs(video.currentTime - time) > .09) {
        video.currentTime = Math.min(time, video.duration);
      }
    }
    updateUI();
    if (lead.ended || time >= scene().duration - .015) {
      if (autoLoop) return seek(0, true);
      wanted = false; time = scene().duration; stopPlayers(); updateUI(); return;
    }
    animationFrame = requestAnimationFrame(tick);
  }
  function sourceIsCurrent(video) {
    return video.currentSrc === video.dataset.expectedSource;
  }
  async function settle() {
    if (!initialized || !players().length) return;
    if (!players().every(video => sourceIsCurrent(video) && video.readyState >= 2 && !video.seeking)) return;
    status.hidden = true;
    if (!wanted || playing || starting) return;
    const token = epoch; starting = true;
    try {
      await Promise.all(players().map(video => video.play()));
      if (token !== epoch || !wanted) return;
      starting = false; playing = true; panel.classList.remove('needs-play'); updateUI();
      cancelAnimationFrame(animationFrame); animationFrame = requestAnimationFrame(tick);
    } catch (error) {
      if (token !== epoch) return;
      wanted = false; stopPlayers(); updateUI();
      // A blocked autoplay brings the hidden Play all button back.
      if (autoLoop) panel.classList.add('needs-play');
      status.textContent = 'Playback paused. Press Play all to continue.'; status.hidden = false;
    }
  }
  function prepare() {
    if (initialized) return;
    initialized = true;
    status.textContent = 'Loading the rendering stages…'; status.hidden = false;
    for (const stage of available()) {
      const video = videos[stage.key];
      video.preload = 'metadata'; video.load();
    }
    makeSeekable(sceneToken);
  }
  async function makeSeekable(token) {
    const list = available().map(stage => videos[stage.key]).filter(video => {
      const src = video.getAttribute('src'); return src && !src.startsWith('blob:');
    });
    if (!list.length) return;
    let blobs;
    try {
      blobs = await Promise.all(list.map(video => fetch(globalThis.meshAxiomAssetUrl(video.getAttribute('src'))).then(r => r.ok ? r.blob() : Promise.reject(new Error(String(r.status))))));
    } catch (error) { return; }   // keep the streamed sources (playback still works, seeking stays limited)
    if (token !== sceneToken) return;   // another scene was chosen meanwhile
    if (playing && master()) time = Math.min(master().currentTime, scene().duration);
    const resume = wanted;
    ++epoch; stopPlayers(); wanted = resume;   // the new sources restart from `time` once they can play (settle)
    list.forEach((video, i) => {
      const url = URL.createObjectURL(blobs[i]); blobUrls.push(url);
      video.dataset.expectedSource = globalThis.meshAxiomAssetUrl(url); video.src = globalThis.meshAxiomAssetUrl(url);
    });
    updateUI();
  }
  function seek(target, resume = wanted) {
    ++epoch; stopPlayers();
    time = Math.max(0, Math.min(target, scene().duration));
    wanted = resume && time < scene().duration - .015;
    prepare();
    status.textContent = 'Loading this moment…'; status.hidden = false;
    for (const video of players()) {
      if (sourceIsCurrent(video) && video.readyState >= 1) video.currentTime = Math.min(time, video.duration);
    }
    updateUI(); settle();
  }
  function focusStage(key) {
    view = key; views.dataset.view = key;
    stages.forEach(stage => { stageElements[stage.key].hidden = key !== 'all' && stage.key !== key; });
    $$('[data-workflow-modes] button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === key)));
  }
  function selectScene(key, initial = false) {
    ++epoch; stopPlayers(); ++sceneToken;
    sceneKey = key; time = 0; wanted = false; initialized = false; failed.clear(); audio = false;
    const current = scene();
    panel.setAttribute('aria-labelledby', id(`tab-${key}`) ? `${prefix}-tab-${key}` : `${prefix}-title`);
    id('title').textContent = current.title;
    id('duration').textContent = current.label;
    id('copy').textContent = current.copy;
    id('detail').textContent = current.note;
    // A scene without a public source page hides its source links.
    id('source').hidden = !current.source;
    if (current.source) id('source').href = globalThis.meshAxiomAssetUrl(current.source);
    timeline.max = current.duration;
    for (const stage of stages) {
      const data = current.views[stage.key], element = stageElements[stage.key], video = videos[stage.key];
      const placeholder = $('.stage-empty', element);
      element.dataset.available = String(!!data?.file);
      video.muted = true; video.removeAttribute('src'); video.removeAttribute('poster'); video.load();
      video.hidden = !data?.file;
      if (data?.file) {
        video.src = globalThis.meshAxiomAssetUrl(data.file); video.poster = globalThis.meshAxiomAssetUrl(data.poster);
        video.dataset.expectedSource = globalThis.meshAxiomAssetUrl(new URL(data.file, document.baseURI).href);
        video.setAttribute('aria-label', `${current.title} — ${stage.title}`);
      } else {
        delete video.dataset.expectedSource;
        $('strong', placeholder).textContent = `${stage.title} unavailable`;
        $('p', placeholder).textContent = data?.unavailable || 'This stage is not available for the selected scene.';
      }
      placeholder.hidden = !!data?.file;
      $('.stage-note', element).textContent = data?.note || '';
      const link = $('.stage-source', element);
      link.hidden = !(data?.source || current.source);
      if (!link.hidden) link.href = globalThis.meshAxiomAssetUrl(data?.source || current.source);
      link.textContent = data?.file ? 'Source ↗' : 'Source demonstration ↗';
    }
    blobUrls.forEach(url => URL.revokeObjectURL(url)); blobUrls = [];   // the previous scene's copies are detached by now
    audioButton.hidden = !current.views.h3?.audio;
    audioButton.setAttribute('aria-pressed', 'false'); audioButton.setAttribute('aria-label', 'Enable H3 audio');
    id('chapters').replaceChildren(...current.chapters.map(([at, title], index) => {
      const button = document.createElement('button'); button.type = 'button';
      button.dataset.time = at; button.textContent = title;
      button.setAttribute('aria-label', `Jump all stages to ${title}, ${formatTime(at)}`);
      button.setAttribute('aria-pressed', String(index === 0)); return button;
    }));
    $$('.workflow-tabs button').forEach(button => {
      const active = button.dataset.case === key;
      button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
      button.classList.toggle('selected', active);
    });
    focusStage(view); status.hidden = true; updateUI();
    if (!initial) {
      prepare();
      const tabs = $('.workflow-tabs'), tab = id(`tab-${key}`);
      if (tabs && tab && tabs.scrollWidth > tabs.clientWidth) tabs.scrollLeft = tab.offsetLeft - tabs.offsetLeft - (tabs.clientWidth - tab.clientWidth) / 2;
    }
  }
  for (const stage of stages) {
    const video = videos[stage.key];
    video.addEventListener('loadedmetadata', () => {
      if (sourceIsCurrent(video)) video.currentTime = Math.min(time, video.duration);
    });
    for (const event of ['loadeddata', 'canplay', 'seeked']) video.addEventListener(event, settle);
    video.addEventListener('waiting', () => {
      if (!playing || !sourceIsCurrent(video)) return;
      time = master()?.currentTime || time; ++epoch; stopPlayers();
      for (const other of players()) if (other.readyState >= 1 && !other.seeking && Math.abs(other.currentTime - time) > .09) other.currentTime = Math.min(time, other.duration);
      status.textContent = 'Buffering the rendering stages…'; status.hidden = false; updateUI();
    });
    video.addEventListener('ended', () => {
      if (video === master() && sourceIsCurrent(video)) {
        if (autoLoop) return seek(0, true);
        wanted = false; time = scene().duration; ++epoch; stopPlayers(); updateUI();
      }
    });
    video.addEventListener('error', () => {
      if (!scene().views[stage.key]?.file || !video.getAttribute('src') || !video.error) return;
      failed.add(stage.key);
      const element = stageElements[stage.key], empty = $('.stage-empty', element);
      video.hidden = true; empty.hidden = false;
      $('strong', empty).textContent = 'Video unavailable';
      $('p', empty).textContent = 'Explore this view at the source below.';
      updateUI(); settle();
    });
  }
  playButton.addEventListener('click', () => {
    if (wanted) return pause();
    if (time >= scene().duration - .015) return seek(0, true);
    wanted = true; prepare(); updateUI(); settle();
  });
  timeline.addEventListener('input', () => seek(Number(timeline.value)));
  id('chapters').addEventListener('click', event => {
    const button = event.target.closest('button[data-time]');
    if (button) seek(Number(button.dataset.time));
  });
  $('[data-workflow-modes]').addEventListener('click', event => {
    const button = event.target.closest('button[data-view]');
    if (button) focusStage(button.dataset.view);
  });
  audioButton.addEventListener('click', () => {
    audio = !audio; videos.h3.muted = !audio;
    audioButton.setAttribute('aria-pressed', String(audio));
    audioButton.setAttribute('aria-label', audio ? 'Mute H3 audio' : 'Enable H3 audio');
  });
  $$('.workflow-tabs button').forEach((button, index, buttons) => {
    button.addEventListener('click', () => selectScene(button.dataset.case));
    button.addEventListener('keydown', event => {
      const targets = { ArrowRight: (index + 1) % buttons.length, ArrowLeft: (index + buttons.length - 1) % buttons.length, Home: 0, End: buttons.length - 1 };
      if (!(event.key in targets)) return;
      event.preventDefault(); const target = buttons[targets[event.key]];
      target.focus(); selectScene(target.dataset.case);
    });
  });
  const group = Object.values(videos);
  registerPlaybackGroup(group, pause);
  function autoStart() {
    if (!autoLoop || !onScreen || document.hidden || wanted) return;
    if (time >= scene().duration - .015) return seek(0, true);
    wanted = true; prepare(); updateUI(); settle();
  }
  // Share = visible part of the panel, or of the screen for panels taller than it.
  const auto = { share: 0, start: () => autoStart() };
  if (autoLoop) autoPanels.push(auto);
  new IntersectionObserver(entries => {
    const entry = entries[0];
    auto.share = entry.isIntersecting ? entry.intersectionRect.height / Math.min(entry.boundingClientRect.height, innerHeight) : 0;
    onScreen = autoLoop ? auto.share >= .5 : entry.isIntersecting;
    if (!entry.isIntersecting) pause();
    if (autoLoop) arbitrate();
  }, { threshold: Array.from({ length: 11 }, (_, i) => i / 10) }).observe(panel);
  const mediaObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) { prepare(); mediaObserver.disconnect(); }
  }, { rootMargin: '150px' });
  mediaObserver.observe(views);
  const outsideObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting && !playbackGroups.some(candidate => candidate.videos.includes(entry.target))) entry.target.pause();
  }), { threshold: .05 });
  document.querySelectorAll('video:not([data-ambient])').forEach(video => { if (!group.includes(video)) outsideObserver.observe(video); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else if (autoLoop) arbitrate(); });
  panel.getPlaybackState = () => ({
    scene: sceneKey, view, time, playing, wanted, duration: scene().duration,
    stages: Object.fromEntries(stages.map(stage => [stage.key, {
      available: !!scene().views[stage.key]?.file, time: videos[stage.key].currentTime,
      paused: videos[stage.key].paused, seeking: videos[stage.key].seeking,
      ready: videos[stage.key].readyState, duration: Number.isFinite(videos[stage.key].duration) ? videos[stage.key].duration : null,
      src: videos[stage.key].currentSrc
    }]))
  });
  selectScene(initialScene, true);
}
