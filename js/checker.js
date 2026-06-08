/**
 * @fileoverview Auto-checker — communicates with a RAVEN proxy (local server.js
 * or a deployed Cloudflare Worker) to verify each generated link automatically.
 *
 * The proxy URL is persisted in localStorage under "raven_proxy_url".
 * Default fallback: http://localhost:7472 (local server.js).
 */
const Checker = (() => {
  /** @type {string} Fallback proxy when none is configured. */
  const DEFAULT_PROXY = 'http://localhost:7472';

  /**
   * Returns the active proxy base URL (from Storage or the default).
   * @returns {string}
   */
  function getProxyUrl() {
    return (Storage.get('proxy_url', '') || DEFAULT_PROXY).replace(/\/$/, '');
  }

  /**
   * Pings the proxy to test whether it is reachable.
   * @returns {Promise<boolean>}
   */
  async function ping() {
    try {
      const res = await fetch(`${getProxyUrl()}/ping`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Asks the proxy to HEAD/GET a URL and returns the HTTP status code.
   * Returns -1 on network error, proxy error, or timeout.
   * @param {string} url - Profile URL to check.
   * @returns {Promise<number>} HTTP status, or -1 on failure.
   */
  async function checkUrl(url) {
    try {
      const res = await fetch(
        `${getProxyUrl()}/check?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(12000) }
      );
      if (!res.ok) return -1;
      const data = await res.json();
      return typeof data.status === 'number' ? data.status : -1;
    } catch {
      return -1;
    }
  }

  /**
   * Maps an HTTP status code to a RAVEN link-state value.
   *
   * | Status          | State | Meaning           |
   * |-----------------|-------|-------------------|
   * | 200             | 2     | 🟢 Probably found  |
   * | 404 / 410       | 0     | 🔴 Not found       |
   * | 3xx / 403 / 429 | 1     | 🟡 Uncertain       |
   * | 5xx / -1        | null  | Leave unchanged    |
   *
   * @param {number} status
   * @returns {0|1|2|null}
   */
  function statusToState(status) {
    if (status === 200)                   return 2;
    if (status === 404 || status === 410) return 0;
    if (status === -1 || status >= 500)   return null;
    return 1;
  }

  /**
   * Runs auto-check against all provided links with bounded concurrency.
   *
   * @param {Object}   opts
   * @param {Array<{key: string, url: string}>} opts.links     - Links to check.
   * @param {number}  [opts.concurrency=3]                     - Parallel workers.
   * @param {function(number, number): void} [opts.onProgress] - Called after each check.
   * @param {function(string, 0|1|2): void}  [opts.onResult]   - Called with conclusive results.
   * @param {AbortSignal} [opts.signal]                        - Cancellation signal.
   * @returns {Promise<void>}
   */
  async function runAll({ links, concurrency = 3, onProgress, onResult, signal }) {
    let completed = 0;
    let index     = 0;
    const total   = links.length;

    async function worker() {
      while (index < total) {
        if (signal?.aborted) return;
        const link   = links[index++];
        const status = await checkUrl(link.url);
        const state  = statusToState(status);
        completed++;
        onProgress?.(completed, total);
        if (state !== null) onResult?.(link.key, state);
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  }

  return { getProxyUrl, ping, checkUrl, statusToState, runAll };
})();
