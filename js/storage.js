const Storage = (() => {
  const PREFIX = 'osint_pg_';

  function key(name) {
    return PREFIX + name;
  }

  function get(name, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key(name));
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  }

  function set(name, value) {
    try {
      localStorage.setItem(key(name), JSON.stringify(value));
    } catch (e) {
      console.error('localStorage write failed:', e);
    }
  }

  function remove(name) {
    localStorage.removeItem(key(name));
  }

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
