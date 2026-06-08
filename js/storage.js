/**
 * @fileoverview Thin wrapper around localStorage that namespaces every key
 * under the "raven_" prefix and handles JSON serialisation transparently.
 */
const Storage = (() => {
  /** @type {string} Common prefix applied to all RAVEN keys in localStorage. */
  const PREFIX = 'raven_';

  /**
   * Returns the fully-qualified localStorage key for the given logical name.
   * @param {string} name - Logical storage key (e.g. "pseudo").
   * @returns {string} The prefixed key (e.g. "raven_pseudo").
   */
  function key(name) {
    return PREFIX + name;
  }

  /**
   * Reads and JSON-parses a value from localStorage.
   * Returns `defaultValue` if the key is absent or the stored value is unparseable.
   * @template T
   * @param {string} name - Logical storage key.
   * @param {T} [defaultValue=null] - Fallback when the key is missing or invalid.
   * @returns {T} The stored value, or `defaultValue`.
   */
  function get(name, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key(name));
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  }

  /**
   * JSON-serialises `value` and writes it to localStorage under the namespaced key.
   * Silently logs an error when the write fails (e.g. quota exceeded, private mode).
   * @param {string} name - Logical storage key.
   * @param {*} value - Any JSON-serialisable value.
   * @returns {void}
   */
  function set(name, value) {
    try {
      localStorage.setItem(key(name), JSON.stringify(value));
    } catch (e) {
      console.error('localStorage write failed:', e);
    }
  }

  /**
   * Removes a single namespaced key from localStorage.
   * No-op when the key does not exist.
   * @param {string} name - Logical storage key to remove.
   * @returns {void}
   */
  function remove(name) {
    localStorage.removeItem(key(name));
  }

  /**
   * Removes every localStorage key that belongs to RAVEN (i.e. starts with PREFIX).
   * Keys owned by other applications are left untouched.
   * @returns {void}
   */
  function clearAll() {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  }

  return { get, set, remove, clearAll };
})();
