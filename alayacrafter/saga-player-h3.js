import { scenes, stages } from './scenes.js';
import { readH3Registry } from './saga-h3-registry.js';

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
export async function mountWorkflow({ root = document.getElementById('workflow'), prefix = 'workflow', initialScene = 'transform', autoLoop = false, scenes: sceneSet = scenes } = {}) {
  const $ = (selector, scope = root) => scope.querySelector(selector);
  const $$ = selector => [...root.querySelectorAll(selector)];
  const id = key => $(`#${prefix}-${key}`);
  const panel = id('panel'), views = id('views');
  const timeline = id('timeline'), playButton = id('play');
  const status = id('status'), audioButton = id('audio');
  const stageElements = Object.fromEntries(stages.map(stage => [stage.key, $(`.workflow-stage[data-stage="${stage.key}"]`)]));
  const videos = Object.fromEntries(stages.map(stage => [stage.key, id(`video-${stage.key}`)]));
  const registry = await readH3Registry(sceneSet);
  const styleSelect = id('style'), styleStatus = id('style-status');
  const styleDirection = id('style-direction');
  let styleId = registry.defaultStyle; registry.populate(styleSelect, styleId);
  let sceneKey = initialScene, view = matchMedia('(max-width:760px)').matches ? 'material' : 'all', time = 0, wanted = false, playing = false;
  let initialized = false, epoch = 0, starting = false, animationFrame, audio = false, onScreen = false;
  let visitorPaused = false;
  const failed = new Set();
  // Fetch only the selected act/views, validate their reviewed bytes, then use seekable blobs.
  // Other acts/styles are not preloaded; previous sources are aborted and revoked on scene/style changes.
  let sceneToken = 0;
  const loads = new Map();

  const scene = () => {
    const base = sceneSet[sceneKey];
    const h3 = registry.clip(sceneKey, styleId);
    return { ...base, views: { ...base.views, h3: h3.available ? h3 : { ...h3, file: undefined } } };
  };
  const available = () => stages.filter(stage => (view === 'all' || view === stage.key) && scene().views[stage.key]?.file && !failed.has(stage.key));
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
    panel.dataset.style = styleId;
    if (styleStatus) { const clip = registry.clip(sceneKey, styleId); styleStatus.textContent = clip.available ? 'Reviewed H3 version · Shared timeline' : clip.unavailable; }
    if (styleDirection) styleDirection.textContent = `Direction: ${registry.clip(sceneKey, styleId).styleLabel}`;
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
    if (!initialized) { initialized = true; status.textContent = 'Loading the selected rendering views…'; status.hidden = false; }
    makeSeekable(sceneToken);
  }
  function stageFailure(stage, message) {
    if (playing && master()) time = Math.min(master().currentTime, scene().duration);
    ++epoch; stopPlayers();
    failed.add(stage.key);
    const element = stageElements[stage.key], empty = $('.stage-empty', element), video = videos[stage.key];
    video.hidden = true; empty.hidden = false;
    $('strong', empty).textContent = `${stage.title} could not be loaded`;
    $('p', empty).textContent = message || 'Retry this view or select another one.';
    if (!$('.saga-stage-retry', empty)) {
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'saga-stage-retry';
      retry.textContent = 'Retry'; retry.setAttribute('aria-label', `Retry ${stage.title}`);
      retry.addEventListener('click', () => {
        if (playing && master()) time = Math.min(master().currentTime, scene().duration);
        ++epoch; stopPlayers();
        failed.delete(stage.key); retry.remove();
        const key = video.dataset.loadKey, prior = loads.get(key);
        if (prior?.url) URL.revokeObjectURL(prior.url);
        prior?.controller.abort(); loads.delete(key); delete video.dataset.loadKey;
        video.removeAttribute('src'); delete video.dataset.expectedSource; video.load();
        for (const other of players()) if (other.readyState >= 1) other.currentTime = Math.min(time, other.duration);
        makeSeekable(sceneToken, true); updateUI();
      }); empty.append(retry);
    }
    updateUI(); settle();
  }
  function makeSeekable(token, retry = false) {
    // One GET per selected source, then a bounded blob: both hosts are supported without relying on HTTP Range.
    for (const stage of available()) {
      const data = stage.key === 'h3' ? scene().views.h3 : registry.baseSource(sceneKey, stage.key);
      const video = videos[stage.key], source = new URL(data.file, document.baseURI).href;
      const key = source + ':' + (data.sha256 || '');
      if (video.dataset.loadKey === key && (video.getAttribute('src') || loads.has(key))) continue;
      video.dataset.loadKey = key;
      const element = stageElements[stage.key], empty = $('.stage-empty', element);
      video.hidden = true; empty.hidden = false; $('strong', empty).textContent = `Loading ${stage.title}`;
      $('p', empty).textContent = 'This view joins the same timeline when it is ready.';
      let load = loads.get(key);
      if (!load) {
        const controller = new AbortController(); load = { controller, url: null };
        load.promise = fetch(globalThis.meshAxiomAssetUrl(source), { signal: controller.signal, cache: retry ? 'reload' : 'default' }).then(async response => {
          if (!response.ok) throw new Error(response.status === 404 ? 'This video is unavailable. Retry it or select another view.' : 'This video could not be downloaded.');
          const bytes = await response.arrayBuffer();
          if (data.bytes && bytes.byteLength !== data.bytes) throw new Error('This video does not match the reviewed version.');
          if (data.sha256) {
            const digest = await crypto.subtle.digest('SHA-256', bytes);
            const sha = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
            if (sha !== data.sha256) throw new Error('This video does not match the reviewed version.');
          }
          if (controller.signal.aborted) throw new DOMException('This view was replaced.', 'AbortError');
          load.url = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' })); return load.url;
        });
        loads.set(key, load);
      }
      load.promise.then(url => {
        if (token !== sceneToken || video.dataset.loadKey !== key) return;
        video.dataset.expectedSource = globalThis.meshAxiomAssetUrl(url); video.src = globalThis.meshAxiomAssetUrl(url); video.preload = 'auto'; video.load();
        video.hidden = false; empty.hidden = true;
        if (stage.key === 'h3') video.muted = !audio;
        updateUI();
      }).catch(error => {
        if (token !== sceneToken || video.dataset.loadKey !== key || error.name === 'AbortError') return;
        stageFailure(stage, error.message);
      });
    }
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
  function focusStage(key, interactive = false) {
    const resume = wanted;
    if (interactive) { if (playing && master()) time = Math.min(master().currentTime, scene().duration); ++epoch; stopPlayers(); }
    view = key; views.dataset.view = key;
    stages.forEach(stage => { stageElements[stage.key].hidden = key !== 'all' && stage.key !== key; });
    $$('[data-workflow-modes] button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === key)));
    if (interactive) { wanted = resume && !!available().length; prepare(); updateUI(); settle(); }
  }
  function selectScene(key, initial = false, retained = null) {
    ++epoch; stopPlayers(); ++sceneToken;
    sceneKey = key; time = retained?.time || 0; wanted = retained?.wanted || false; initialized = false; failed.clear(); audio = retained?.audio || false;
    if (!retained) visitorPaused = false;
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
      delete video.dataset.loadKey; $('.saga-stage-retry', placeholder)?.remove();
      if (data?.file) {
        if (data.poster) video.poster = globalThis.meshAxiomAssetUrl(data.poster);
        delete video.dataset.expectedSource;
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
    const keep = new Set(stages.filter(stage => current.views[stage.key]?.file).map(stage => {
      const data = stage.key === 'h3' ? current.views.h3 : registry.baseSource(sceneKey, stage.key);
      return new URL(data.file, document.baseURI).href + ':' + (data.sha256 || '');
    }));
    for (const [key, load] of loads) if (!keep.has(key)) {
      load.controller.abort(); if (load.url) URL.revokeObjectURL(load.url); loads.delete(key);
    }
    audioButton.hidden = !current.views.h3?.audio;
    audioButton.setAttribute('aria-pressed', String(audio)); audioButton.setAttribute('aria-label', audio ? 'Mute H3 audio' : 'Enable H3 audio');
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
      if (sourceIsCurrent(video)) {
        if (stage.key === 'h3' && Math.abs(video.duration - scene().duration) > 1 / 24) return stageFailure(stage, 'This version does not match the shared timeline.');
        video.currentTime = Math.min(time, video.duration);
      }
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
      if (!scene().views[stage.key]?.file || !video.getAttribute('src') || !video.error || !sourceIsCurrent(video)) return;
      stageFailure(stage, 'This video could not be played. Retry it or select another view.');
    });
  }
  playButton.addEventListener('click', event => {
    if (wanted) { if (event.isTrusted) visitorPaused = true; return pause(); }
    if (visitorPaused && !event.isTrusted) return;
    if (event.isTrusted) visitorPaused = false;
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
    if (button) focusStage(button.dataset.view, true);
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
  styleSelect?.addEventListener('change', () => {
    if (!registry.acceptedStyles.some(style => style.id === styleSelect.value)) return;
    const retained = { time: playing && master() ? Math.min(master().currentTime, scene().duration) : time, wanted, audio };
    styleId = styleSelect.value; selectScene(sceneKey, false, retained);
  });
  const group = Object.values(videos);
  registerPlaybackGroup(group, pause);
  function autoStart() {
    if (!autoLoop || !onScreen || document.hidden || wanted || visitorPaused || !available().length) return;
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
    scene: sceneKey, style: styleId, fixture: registry.fixture, view, time, playing, wanted, visitorPaused, duration: scene().duration,
    stages: Object.fromEntries(stages.map(stage => [stage.key, {
      available: !!scene().views[stage.key]?.file, failed: failed.has(stage.key), time: videos[stage.key].currentTime,
      paused: videos[stage.key].paused, seeking: videos[stage.key].seeking,
      ready: videos[stage.key].readyState, duration: Number.isFinite(videos[stage.key].duration) ? videos[stage.key].duration : null,
      src: videos[stage.key].currentSrc
    }]))
  });
  selectScene(initialScene, true);
}
