// Pool budget: desktop8, small devices3; home reserves its2 legacy gallery/budget viewers.
const smallDevice = matchMedia('(max-width: 639px)').matches ||
  (navigator.deviceMemory !== undefined && navigator.deviceMemory < 4);
const legacyReserve = document.body.classList.contains('library-page') ? 0 : 2;
const LIMIT = smallDevice ? (legacyReserve ? 2 : 3) : 8 - legacyReserve, HARD = LIMIT;
const slots = new Set();

// release(reason): called when this viewer must give its context back ('evicted' off screen, or 'crowded').
// Returns { visible(bool), touch(), drop() }.
export function claimContext(release, visible = true) {
  const now = performance.now();
  const slot = { release, visible, seen: now, used: now };
  slots.add(slot);
  const give = (list, cap, reason) => {
    for (const other of list) {
      if (slots.size <= cap) break;
      slots.delete(other); other.release(reason);
    }
  };
  give([...slots].filter(o => o !== slot && !o.visible).sort((a, b) => a.seen - b.seen), LIMIT, 'evicted');
  give([...slots].filter(o => o !== slot).sort((a, b) => a.used - b.used), HARD, 'crowded');
  return {
    visible(value) { slot.visible = value; slot.seen = performance.now(); },
    touch() { slot.used = performance.now(); },
    drop() { slots.delete(slot); }
  };
}

// True when a new claim would not have to take a context from a view that is on screen.
export function canClaim() {
  const offScreen = [...slots].filter(s => !s.visible).length;
  return slots.size + 1 - offScreen <= HARD;
}

// Calls start() once the element has stayed at least half in view for `dwell` ms, so a quick scroll past (or a
// smooth-scrolling nav jump) loads nothing. afterLeaving: only count a stay that begins after the element has been
// out of view (a view that just lost its context while on screen waits for the visitor to come back to it).
// Returns a function that cancels the wait.
export function whenDwelling(element, start, { ratio = .5, dwell = 400, afterLeaving = false } = {}) {
  let timer, left = !afterLeaving;
  const observer = new IntersectionObserver(entries => {
    const entry = entries[entries.length - 1];
    clearTimeout(timer);
    if (!entry.isIntersecting) { left = true; return; }
    // A view taller than the window counts once it covers half the window.
    if (left && (entry.intersectionRatio >= ratio || entry.intersectionRect.height >= innerHeight * ratio)) {
      timer = setTimeout(() => { observer.disconnect(); start(); }, dwell);
    }
  }, { threshold: [0, .1, .25, .5, .75, 1] });
  observer.observe(element);
  return () => { clearTimeout(timer); observer.disconnect(); };
}
