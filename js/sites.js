const Sites = (() => {
  let defaultSites = [];

  async function loadDefaults() {
    try {
      const res = await fetch('config/sites.default.json');
      defaultSites = await res.json();
    } catch {
      defaultSites = [];
    }
  }

  function getSites() {
    const stored = Storage.get('sites');
    if (!stored || !Array.isArray(stored) || !stored.length) return defaultSites;
    // Enrich stored entries with fields from defaults when missing (cat, strip_bad_char)
    return stored.map(s => {
      if (s.cat) return s;
      const def = defaultSites.find(d => d.id === s.id);
      return def ? { ...def, ...s } : s;
    });
  }

  function saveSites(sites) {
    Storage.set('sites', sites);
  }

  function addSite(name, url) {
    if (!url.includes('{pseudo}')) return { ok: false, error: "L'URL doit contenir {pseudo}" };
    const sites = getSites();
    const id = 'site_' + Date.now();
    sites.push({ id, name: name.trim(), url: url.trim() });
    saveSites(sites);
    return { ok: true };
  }

  function removeSite(id) {
    const sites = getSites().filter(s => s.id !== id);
    saveSites(sites);
  }

  function resetToDefaults() {
    Storage.remove('sites');
  }

  function buildUrl(site, variant) {
    let v = variant;
    if (site.strip_bad_char) {
      for (const ch of site.strip_bad_char) {
        v = v.split(ch).join('');
      }
    }
    return site.url.replace('{pseudo}', encodeURIComponent(v));
  }

  return { loadDefaults, getSites, saveSites, addSite, removeSite, resetToDefaults, buildUrl };
})();
