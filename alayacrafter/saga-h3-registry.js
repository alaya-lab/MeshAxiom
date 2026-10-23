// H3 outputs join the existing material/gray timeline only after source-bound review.
const validSha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const validId = value => typeof value === 'string' && /^[a-z0-9-]+$/.test(value);
export async function readH3Registry(scenes) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const fixture = local ? new URL(location.href).searchParams.get('h3fixture') : null;
  const fixtureNames = new Set(['two-styles', 'retry404', 'invalid']);
  const url = fixtureNames.has(fixture) ? `/__fixtures__/${fixture}.json` : 'saga-h3-manifest.json';
  let data, error;
  try {
    const response = await fetch(globalThis.meshAxiomAssetUrl(url));
    if (!response.ok) throw new Error('H3 version information is unavailable.');
    data = await response.json();
    if (data.schemaVersion !== 1 || data.fixture && !local) throw new Error('H3 version information is invalid.');
  } catch (failure) {
    error = failure.message;
    data = { schemaVersion: 1, defaultStyle: 'dark-biomech-oil', styles: [], acts: {} };
  }
  const styles = (Array.isArray(data.styles) ? data.styles : []).filter(style => validId(style.id) && typeof style.label === 'string');
  function clip(act, styleId) {
    const row = data.acts?.[act];
    const version = row?.versions?.[styleId];
    const style = styles.find(x => x.id === styleId);
    const direction = { faction: row?.faction, styleLabel: row?.styleLabel || 'H3 rendering direction' };
    if (!version || version.state !== 'accepted') return {
      ...direction,
      available: false, state: version?.state || 'pending',
      unavailable: error || 'This H3 version is not available for this act yet.',
      note: 'Reviewed H3 versions will appear here. The gray and material views remain available.'
    };
    const base = scenes[act];
    let file = null;
    try { if (typeof version.file === 'string' && version.file.trim()) file = new URL(version.file, document.baseURI); } catch {}
    const valid = style && row && validSha(row.guideSha256) && version.guideSha256 === row.guideSha256
      && file && file.origin === location.origin && file.pathname.endsWith('.mp4')
      && validSha(version.sha256) && Number.isSafeInteger(version.bytes) && version.bytes > 0
      && version.fps === 24 && version.frameCount === 345 && version.firstPts === 0
      && Math.abs(version.duration - base.duration) < 1e-6
      && version.approval?.state === 'accepted' && validSha(version.approval.receiptSha256)
      && !(version.fixture && !local);
    if (!valid) return { ...direction, available: false, state: 'invalid',
      unavailable: 'This H3 version has not passed the source and timing checks.',
      note: 'Select another version or use the gray and material views.' };
    return { ...version, ...direction, available: true, note: version.note ||
      'H3 rendering guided by this material movie. Visual details are inferred; scene layout and animation are authored.' };
  }
  const count = styleId => Object.keys(scenes).filter(act => clip(act, styleId).available).length;
  const acceptedStyles = styles.filter(style => count(style.id) > 0);
  const choose = acceptedStyles.find(x => x.id === data.defaultStyle)?.id || acceptedStyles[0]?.id || data.defaultStyle || 'dark-biomech-oil';
  return { data, styles, acceptedStyles, count, clip, defaultStyle: choose, fixture: !!data.fixture,
    baseSource(act, stage) {
      const binding = data.acts?.[act]?.controls?.[stage];
      const source = scenes[act]?.views[stage];
      return binding?.file === source?.file && validSha(binding.sha256) ? binding : source;
    },
    populate(select, selected) {
      if (!select) return;
      const entries = acceptedStyles.length ? acceptedStyles : [{ id: choose,
        label: styles.find(x => x.id === choose)?.label || 'H3 · Faction styles' }];
      select.replaceChildren(...entries.map(style => {
        const option = document.createElement('option'); option.value = style.id;
        const ready = count(style.id);
        option.textContent = ready ? `${style.label} · ${ready}/${Object.keys(scenes).length} acts` : `${style.label} · Not available yet`;
        return option;
      }));
      select.value = selected; select.disabled = !acceptedStyles.length;
    }
  };
}
