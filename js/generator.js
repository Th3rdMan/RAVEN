const Generator = (() => {
  /**
   * @param {string} pseudo
   * @param {Array<{from: string, to: string}>} leetPairs
   * @param {number} maxDistance
   * @returns {{ variants: string[], tooMany: boolean, estimate: number }}
   */
  function generateVariants(pseudo, leetPairs, maxDistance) {
    const normalized = pseudo.toLowerCase();
    const n = normalized.length;

    // Build substitution map: char -> Set of replacements (including itself)
    // Track if both i-1 and l-1 are active for collision handling
    const hasI1 = leetPairs.some(p => p.from === 'i' && p.to === '1');
    const hasL1 = leetPairs.some(p => p.from === 'l' && p.to === '1');

    // Build forward substitution table (bidirectional)
    const subsMap = new Map();

    function addSub(from, to) {
      if (!subsMap.has(from)) subsMap.set(from, new Set());
      subsMap.get(from).add(to);
    }

    for (const pair of leetPairs) {
      addSub(pair.from, pair.to);
      // Reverse direction: to -> from
      // Special case: '1' can map to both 'i' and 'l' if both pairs active
      if (pair.to === '1') {
        // handled below
      } else {
        addSub(pair.to, pair.from);
      }
    }

    // Handle '1' reverse: if both i-1 and l-1 are active, '1' -> ['i', 'l']
    if (hasI1 || hasL1) {
      if (!subsMap.has('1')) subsMap.set('1', new Set());
      if (hasI1) subsMap.get('1').add('i');
      if (hasL1) subsMap.get('1').add('l');
    }

    // For each position, list of [char, isSubstitution] options
    // options[i] = array of chars that can appear at position i
    // original char always included; substitutions are "changed" positions
    const posOptions = [];
    for (let i = 0; i < n; i++) {
      const ch = normalized[i];
      const subs = subsMap.get(ch);
      const opts = [ch]; // original is first
      if (subs) {
        for (const s of subs) {
          if (s !== ch) opts.push(s);
        }
      }
      posOptions.push(opts);
    }

    // Estimate variant count
    const avgSubs = posOptions.reduce((sum, opts) => sum + (opts.length - 1), 0) / n;
    let estimate = 0;
    for (let k = 0; k <= maxDistance; k++) {
      estimate += comb(n, k) * Math.pow(Math.max(avgSubs, 1), k);
    }

    if (estimate > 10000) {
      return { variants: [], tooMany: true, estimate: Math.round(estimate) };
    }

    // Enumerate all combinations via iterative cartesian product
    // Track how many positions differ from original
    const results = new Set();
    const variantsWithDist = [];

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

    // Sort by distance then lexicographic
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
