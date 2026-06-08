/**
 * @fileoverview Site registry — loads the default site list, persists user
 * customisations to Storage, and builds profile URLs for a given variant.
 *
 * @typedef {Object} Site
 * @property {string}  id               - Unique identifier (e.g. "github").
 * @property {string}  name             - Human-readable display name.
 * @property {string}  url              - URL template containing "{pseudo}".
 * @property {string}  [cat]            - Category label (e.g. "social", "coding").
 * @property {string}  [strip_bad_char] - Characters to remove from the variant
 *                                        before URL injection (site-specific constraint).
 */
const Sites = (() => {
  /** @type {Site[]} In-memory copy of sites.default.json, populated by loadDefaults(). */
  let defaultSites = [];

  /**
   * Fetches and caches the default site list from `config/sites.default.json`.
   * Must be awaited before calling any other Sites method.
   * Silently falls back to an empty array on fetch failure.
   * @returns {Promise<void>}
   */
  async function loadDefaults() {
    try {
      const res = await fetch('config/sites.default.json');
      defaultSites = await res.json();
    } catch {
      defaultSites = [];
    }
  }

  /**
   * Returns the active site list, preferring the user's persisted customisation.
   * Falls back to `defaultSites` when nothing is stored or the stored list is empty.
   * Entries that are missing `cat` or `strip_bad_char` are enriched from the
   * matching default entry (matched by `id`).
   * @returns {Site[]}
   */
  function getSites() {
    const stored = Storage.get('sites');
    if (!stored || !Array.isArray(stored) || !stored.length) return defaultSites;
    return stored.map(s => {
      if (s.cat) return s;
      const def = defaultSites.find(d => d.id === s.id);
      return def ? { ...def, ...s } : s;
    });
  }

  /**
   * Persists `sites` to localStorage, replacing any previously saved list.
   * @param {Site[]} sites - The full site list to persist.
   * @returns {void}
   */
  function saveSites(sites) {
    Storage.set('sites', sites);
  }

  /**
   * Appends a new user-defined site to the persisted list.
   * The URL template must contain the "{pseudo}" placeholder.
   * @param {string} name - Display name for the new site.
   * @param {string} url  - URL template (must include "{pseudo}").
   * @returns {{ ok: true } | { ok: false, error: string }}
   *   Returns `{ ok: false, error }` when the URL is missing the placeholder.
   */
  function addSite(name, url) {
    if (!url.includes('{pseudo}')) return { ok: false, error: "L'URL doit contenir {pseudo}" };
    const sites = getSites();
    const id = 'site_' + Date.now();
    sites.push({ id, name: name.trim(), url: url.trim() });
    saveSites(sites);
    return { ok: true };
  }

  /**
   * Removes the site with the given `id` from the persisted list.
   * @param {string} id - Unique site identifier to remove.
   * @returns {void}
   */
  function removeSite(id) {
    const sites = getSites().filter(s => s.id !== id);
    saveSites(sites);
  }

  /**
   * Clears the user-customised site list from Storage.
   * After this call, `getSites` will return the default list again.
   * @returns {void}
   */
  function resetToDefaults() {
    Storage.remove('sites');
  }

  /**
   * Builds the final profile URL for a site/variant pair.
   * Characters listed in `site.strip_bad_char` are stripped from the variant
   * before URL-encoding and substituting into the template.
   * @param {Site}   site    - Target site descriptor.
   * @param {string} variant - Leet-speak variant to inject.
   * @returns {string} Fully-formed URL ready to open in a browser tab.
   */
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
