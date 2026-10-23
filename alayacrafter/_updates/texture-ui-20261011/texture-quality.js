// Reuse the published material library with a base independent of this page.
const ROOT = "https://alaya-lab.github.io/MeshAxiom/alaya-kit/";
const catalog = fetch(globalThis.meshAxiomAssetUrl(ROOT + 'assets/texture-hd/library.json'))
  .then(r => { if (!r.ok) throw new Error('Texture information unavailable'); return r.json(); })
  .catch(() => []);
export function sharedAsset(file) {
  const url = new URL(file, document.baseURI);
  if (url.origin !== location.origin) return url.href;
  const match = url.pathname.match(/^\/(?:MeshAxiom\/)?(?:alayacrafter|alaya-kit)\/(assets\/.*)$/);
  return match ? ROOT + match[1] : url.href;
}
const index = catalog.then(rows => new Map(rows.map(row => [sharedAsset(ROOT + row.originalMesh), row])));
const originalFile = item => sharedAsset(item.materialMesh || item.mesh);
export function supportsDetail() {
  return matchMedia('(min-width: 640px)').matches && (navigator.deviceMemory === undefined || navigator.deviceMemory >= 4);
}
export async function textureMetadata(item) { return (await index).get(originalFile(item)); }
export async function geometryFile(item) {
  const row = await textureMetadata(item);
  return row ? ROOT + row.compactMesh : originalFile(item);
}
export async function materialFile(item, card) {
  const row = await textureMetadata(item);
  if (!row) {
    card.dataset.textureResolution = 'standard';
    return row ? ROOT + row.compactMesh : originalFile(item);
  }
  const choice = card.dataset.textureQuality || 'auto';
  const detailed = supportsDetail() && (choice === 'detail' || choice === 'auto' && card.classList.contains('is-enlarged'));
  card.dataset.textureResolution = String(detailed ? row.viewerResolution : row.compactResolution);
  return ROOT + (detailed ? row.viewerMesh : row.compactMesh);
}
export async function assemblyMaterialFile(file) {
  const row = (await index).get(sharedAsset(file));
  return row ? ROOT + row.compactMesh : sharedAsset(file);
}
