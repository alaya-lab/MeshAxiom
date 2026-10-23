// Reuse the published material library with a base independent of this page.
const ROOT = "https://alaya-lab.github.io/MeshAxiom/alaya-kit/";
const catalog = fetch(globalThis.meshAxiomAssetUrl(ROOT + 'assets/texture-hd/library.json'))
  .then(r => { if (!r.ok) throw new Error('Texture information unavailable'); return r.json(); })
  .catch(() => []);
export function sharedAsset(file) {
  const url = new URL(file, document.baseURI);
  // Asset aliases share one texture index even when the project page is hosted elsewhere.
  const assetOrigin = new URL(document.baseURI).origin;
  const match = url.origin === assetOrigin ? url.pathname.match(/^\/(?:MeshAxiom\/)?(?:alayacrafter|alaya-kit)\/(assets\/.*)$/) : null;
  return match ? new URL(ROOT + match[1], document.baseURI).href : url.href;
}
const index = catalog.then(rows => new Map(rows.map(row => [sharedAsset(ROOT + row.originalMesh), row])));
const originalFile = item => sharedAsset(item.materialMesh || item.mesh);
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
  card.dataset.textureResolution = String(row.viewerResolution);
  return ROOT + row.viewerMesh;
}
export async function assemblyMaterialFile(file) {
  const row = (await index).get(sharedAsset(file));
  return row ? ROOT + row.viewerMesh : sharedAsset(file);
}
