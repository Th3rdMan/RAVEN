/**
 * @fileoverview Variant generator — produces all leet-speak permutations of a
 * pseudo up to a given Hamming distance using a bidirectional substitution map.
 */
const Generator = (() => {
  /**
   * Generates every unique leet-speak variant of `pseudo` whose Hamming distance
   * from the normalised (lowercase) original is at most `maxDistance`.
   *
   * The substitution map is bidirectional: if "a → 4" is active, "4 → a" is also
   * considered. The special case where both "i → 1" and "l → 1" are active is
   * handled so that "1" correctly maps back to both "i" and "l".
   *
   * When the estimated variant count exceeds 10 000 the function returns early
   * with `tooMany: true` to prevent the browser from hanging.
   *
   * @param {string} pseudo - The username to analyse.
   * @param {Array<{from: string, to: string}>} leetPairs - Active substitution pairs.
   * @param {number} maxDistance - Maximum number of substituted positions (≥ 1).
   * @returns {{ variants: string[], tooMany: boolean, estimate: number }}
   *   `variants` is sorted first by Hamming distance, then lexicographically.
   *   `tooMany` is true when the result set would exceed the safety threshold.
   *   `estimate` is always populated with a rounded integer approximation.
   */
  function generateVariants(pseudo, leetPairs, maxDistance) {
    const normalized = pseudo.toLowerCase();
    const n = normalized.length;

    // Track whether both i→1 and l→1 are active; needed for the reverse mapping of '1'.
    const hasI1 = leetPairs.some(p => p.from === 'i' && p.to === '1');
    const hasL1 = leetPairs.some(p => p.from === 'l' && p.to === '1');

    /**
     * Bidirectional substitution map: character → set of characters it may become.
     * @type {Map<string, Set<string>>}
     */
    const subsMap = new Map();

    /**
     * Registers a directed edge `from → to` in the substitution map.
     * @param {string} from
     * @param {string} to
     */
    function addSub(from, to) {
      if (!subsMap.has(from)) subsMap.set(from, new Set());
      subsMap.get(from).add(to);
    }

    for (const pair of leetPairs) {
      addSub(pair.from, pair.to);
      // '1' reverse direction is handled separately below to avoid
      // double-registering when both i→1 and l→1 are active.
      if (pair.to !== '1') {
        addSub(pair.to, pair.from);
      }
    }

    // When '1' is reachable from 'i' or 'l', map it back to both sources.
    if (hasI1 || hasL1) {
      if (!subsMap.has('1')) subsMap.set('1', new Set());
      if (hasI1) subsMap.get('1').add('i');
      if (hasL1) subsMap.get('1').add('l');
    }

    /**
     * Per-position option lists. `posOptions[i]` starts with the original
     * character at index i followed by all valid substitutions for that character.
     * @type {Array<string[]>}
     */
    const posOptions = [];
    for (let i = 0; i < n; i++) {
      const ch = normalized[i];
      const subs = subsMap.get(ch);
      const opts = [ch];
      if (subs) {
        for (const s of subs) {
          if (s !== ch) opts.push(s);
        }
      }
      posOptions.push(opts);
    }

    // Rough upper-bound estimate: avoids running the full enumeration when the
    // result set would be unreasonably large.
    const avgSubs = posOptions.reduce((sum, opts) => sum + (opts.length - 1), 0) / n;
    let estimate = 0;
    for (let k = 0; k <= maxDistance; k++) {
      estimate += comb(n, k) * Math.pow(Math.max(avgSubs, 1), k);
    }

    if (estimate > 10000) {
      return { variants: [], tooMany: true, estimate: Math.round(estimate) };
    }

    /** @type {Set<string>} De-duplication guard across all generated variants. */
    const results = new Set();
    /** @type {Array<{variant: string, dist: number}>} */
    const variantsWithDist = [];

    /**
     * Recursive DFS that assembles every variant one character at a time.
     * Prunes branches whose accumulated distance already exceeds `maxDistance`.
     * @param {number} pos - Current character index being filled.
     * @param {string[]} current - Mutable character buffer being assembled.
     * @param {number} dist - Number of substitutions applied so far.
     */
    function enumerate(pos, current, dist) {
      if (pos === n) {
        const variant = current.join('');
        if (!results.has(variant)) {
          results.add(variant);
          variantsWithDist.push({ variant, dist });
        }
        return;
      }
      const opts = posOptions[pos];
      const orig = normalized[pos];
      for (const ch of opts) {
        const newDist = dist + (ch !== orig ? 1 : 0);
        if (newDist <= maxDistance) {
          current[pos] = ch;
          enumerate(pos + 1, current, newDist);
        }
      }
    }

    enumerate(0, new Array(n), 0);

    // Primary sort: ascending Hamming distance. Secondary sort: lexicographic.
    variantsWithDist.sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      return a.variant.localeCompare(b.variant);
    });

    return {
      variants: variantsWithDist.map(v => v.variant),
      tooMany: false,
      estimate: Math.round(estimate)
    };
  }

  /**
   * Binomial coefficient C(n, k) — the number of ways to choose k items from n.
   * Uses the multiplicative formula to stay integer-safe for small values.
   * @param {number} n - Total items.
   * @param {number} k - Items chosen.
   * @returns {number} The rounded binomial coefficient.
   */
  function comb(n, k) {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    let result = 1;
    for (let i = 0; i < k; i++) {
      result = result * (n - i) / (i + 1);
    }
    return Math.round(result);
  }

  return { generateVariants };
})();
