// Showcase clips on the library page: each card stacks its Materials and Gray-mesh loops, loads them only near the
// viewport, plays them only while at least a third of the card is visible, and the switch just changes which loop shows.
// Nothing seeks: the host ignores HTTP Range requests, so a seek would snap back to the start.
const cards = [...document.querySelectorAll('.showcase-card')];
const start = card => {
  const vids = [...card.querySelectorAll('video')];
  vids.forEach(v => { if (!v.getAttribute('src')) { v.src = globalThis.meshAxiomAssetUrl(v.dataset.src); v.load(); } });
  Promise.all(vids.map(v => v.readyState >= 3 ? null : new Promise(r => v.addEventListener('canplay', r, { once: true }))))
    .then(() => { if (card.dataset.visible === 'true') vids.forEach(v => { const p = v.play(); if (p) p.catch(() => {}); }); });
};
const io = new IntersectionObserver(entries => entries.forEach(e => {
  const card = e.target, on = e.isIntersecting && e.intersectionRatio >= .34;
  card.dataset.visible = String(on);
  if (on) start(card); else card.querySelectorAll('video').forEach(v => v.pause());
}), { threshold: [0, .34, .7] });
cards.forEach(card => {
  io.observe(card);
  card.querySelectorAll('[data-showcase-mode]').forEach(b => b.addEventListener('click', () => {
    card.dataset.mode = b.dataset.showcaseMode;
    card.querySelectorAll('[data-showcase-mode]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
});
