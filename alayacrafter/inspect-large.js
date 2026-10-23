// Keep fragment links on this document when its asset base uses the migration prefix.
for(const a of document.querySelectorAll('a[href^="#"]'))a.href=globalThis.meshAxiomAssetUrl(location.pathname+location.search+a.getAttribute('href'));
// Move the existing viewer into a native dialog; its model, camera and context stay alive.
const dialog=document.createElement('dialog');dialog.className='inspect-dialog';
dialog.setAttribute('aria-label','Enlarged model inspection');
const close=document.createElement('button');close.type='button';close.className='inspect-close';close.textContent='Close enlarged view';
const content=document.createElement('div');content.className='inspect-content';
dialog.append(close,content);document.body.append(dialog);
let active=null,anchor=null,opener=null;
function restore(){
 if(!active)return;
 anchor.replaceWith(active);active.classList.remove('is-enlarged');active.dispatchEvent(new Event('detail-view-change'));
 active=null;anchor=null;document.body.classList.remove('inspect-open');opener?.focus();opener=null;
}
close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',restore);
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
for(const card of document.querySelectorAll('.space-model-card, .kit-assembly-card[data-layout]')){
 const button=document.createElement('button');button.type='button';button.dataset.inspectLarge='';button.textContent='Enlarge';
 button.setAttribute('aria-label','Enlarge '+(card.dataset.modelName||card.querySelector('h3')?.textContent||'model'));
 const tools=card.querySelector('.space-model-tools')||card.querySelector('.station-switches');
 if(card.closest('#library-grid'))tools.prepend(button);else tools.append(button);
 button.addEventListener('click',()=>{
  if(dialog.open)return;
  opener=button;active=card;anchor=document.createElement('div');anchor.className='inspect-placeholder';
  const box=card.getBoundingClientRect();anchor.style.height=box.height+'px';
  card.before(anchor);content.append(card);card.classList.add('is-enlarged');document.body.classList.add('inspect-open');dialog.showModal();
  const start=card.querySelector('[data-model-inspect]')||card.querySelector('[data-station-load]');
  if(card.querySelector('canvas'))card.dispatchEvent(new Event('detail-view-change'));
  if(!card.querySelector('canvas')){
   const viewport=card.querySelector('.space-model-viewport');
   if(viewport?.loadModelSelection)viewport.loadModelSelection();else start?.click();
  }
 });
}
