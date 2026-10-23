// Texture mode selects the reviewed super-resolution materials.
const catalog = fetch(globalThis.meshAxiomAssetUrl(new URL('./assets/texture-hd/library.json', import.meta.url)))
  .then(response => {
    if (!response.ok) throw new Error('Texture information unavailable');
    return response.json();
  }).catch(() => []);

const absolute = file => new URL(file, document.baseURI).href;
const index = catalog.then(rows => new Map(rows.map(row => [absolute(row.originalMesh), row])));

export async function materialFile(item, card) {
  const file = item.materialMesh || item.mesh;
  const row = (await index).get(absolute(file));
  if (!row) {
    card.dataset.textureResolution = 'standard';
    return file;
  }
  // A single enlarged desktop view gets 4K. Cards, phones and assemblies use
  // the enhanced compact atlas; the 8K terrain versions are download assets.
  const desktop = matchMedia('(min-width: 640px)').matches && (navigator.deviceMemory === undefined || navigator.deviceMemory >= 4);
  const detailed = card.classList.contains('is-enlarged') && desktop;
  card.dataset.textureResolution = String(detailed ? row.viewerResolution : row.compactResolution);
  return detailed ? row.viewerMesh : row.compactMesh;
}

export async function assemblyMaterialFile(file) {
  return (await index).get(absolute(file))?.compactMesh || file;
}

export async function textureMetadata(item) {
  return (await index).get(absolute(item.materialMesh || item.mesh));
}

export async function geometryFile(item) {
  const row = await textureMetadata(item);
  return row ? row.compactMesh : item.mesh;
}
