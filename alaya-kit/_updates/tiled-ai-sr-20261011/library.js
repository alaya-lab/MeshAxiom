// Space-game asset library page: navigation, category filter and the assembly cards.
import { mountAssemblyCard } from './assembly-viewer.js?v=tiled-ai-sr-20261011';

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

// Category filter: buttons carry data-filter, cards carry data-category.
const buttons = $$('[data-filter]');
const cards = $$('#library-grid .space-model-card');
function filter(category) {
  buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
  let shown = 0;
  for (const card of cards) {
    const match = category === 'all' || card.dataset.category === category;
    card.hidden = !match; if (match) shown++;
  }
  $('#library-count').textContent = `${shown} asset${shown === 1 ? '' : 's'}`;
}
buttons.forEach(button => button.addEventListener('click', () => filter(button.dataset.filter)));
filter('all');

// Each assembly card names its layout; layouts list the GLB url of every part type.
for (const card of $$('.kit-assembly-card[data-layout]')) {
  mountAssemblyCard(card, { layoutUrl: card.dataset.layout, partUrl: key => `assets/kit/${key}.glb`, noun: 'assets' });
}
