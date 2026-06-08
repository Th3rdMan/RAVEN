let leetPairsAll = [];

async function init() {
  await Sites.loadDefaults();

  try {
    const res = await fetch('config/leet.json');
    leetPairsAll = await res.json();
  } catch {
    leetPairsAll = [];
    showToast('Impossible de charger leet.json', 'error');
  }

  restoreState();
  renderLeetTable();
  renderSitesEditor();
  renderResults();
  bindEvents();
}

// ── State restore ──────────────────────────────────────────────────────────────

function restoreState() {
  const pseudo = Storage.get('pseudo', '');
  document.getElementById('pseudo-input').value = pseudo;

  const distance = Storage.get('distance', 1);
  document.getElementById('distance-select').value = distance;
}

// ── Leet table ─────────────────────────────────────────────────────────────────

function renderLeetTable() {
  const selected = Storage.get('leet_selected', getDefaultSelected());
  const tbody = document.getElementById('leet-tbody');
  tbody.innerHTML = '';

  const categories = ['digit', 'special'];
  for (const cat of categories) {
    const pairs = leetPairsAll.filter(p => p.category === cat);
    if (!pairs.length) continue;

    const headerRow = document.createElement('tr');
    headerRow.className = 'leet-category-header';
    headerRow.innerHTML = `<td colspan="5">${cat === 'digit' ? 'Chiffres' : 'Spéciaux'}</td>`;
    tbody.appendChild(headerRow);

    for (const pair of pairs) {
      const checked = selected.includes(pair.id);
      const tr = document.createElement('tr');
      tr.dataset.id = pair.id;
      tr.innerHTML = `
        <td><input type="checkbox" id="leet-${pair.id}" data-id="${pair.id}" ${checked ? 'checked' : ''} aria-label="${pair.from} ↔ ${pair.to}"></td>
        <td><label for="leet-${pair.id}" class="leet-from">${pair.from}</label></td>
        <td class="leet-arrow">↔</td>
        <td><label for="leet-${pair.id}" class="leet-to">${pair.to}</label></td>
        <td class="leet-cat">${pair.category}</td>
      `;
      tbody.appendChild(tr);
    }
  }
}

function getDefaultSelected() {
  return leetPairsAll.filter(p => p.default).map(p => p.id);
}

function getSelectedLeetPairs() {
  const selected = Storage.get('leet_selected', getDefaultSelected());
  return leetPairsAll.filter(p => selected.includes(p.id));
}

// ── Sites editor ───────────────────────────────────────────────────────────────

function renderSitesEditor() {
  const sites = Sites.getSites();
  const tbody = document.getElementById('sites-tbody');
  tbody.innerHTML = '';

  for (const site of sites) {
    const tr = document.createElement('tr');
    tr.dataset.id = site.id;
    tr.innerHTML = `
      <td>${escHtml(site.name)}${site.cat ? `<span class="site-cat">${escHtml(site.cat)}</span>` : ''}</td>
      <td class="url-cell"><span title="${escHtml(site.url)}">${escHtml(site.url)}</span>${site.strip_bad_char ? `<span class="strip-badge" title="Caractères ignorés par ce site">strip: <code>${escHtml(site.strip_bad_char)}</code></span>` : ''}</td>
      <td><button class="btn-icon btn-delete-site" data-id="${site.id}" aria-label="Supprimer ${escHtml(site.name)}" title="Supprimer">🗑</button></td>
    `;
    tbody.appendChild(tr);
  }
}

// ── Generate ───────────────────────────────────────────────────────────────────

function generate() {
  const pseudo = document.getElementById('pseudo-input').value.trim();
  if (!pseudo) {
    showToast('Veuillez saisir un pseudo.', 'warn');
    return;
  }

  const distance = parseInt(document.getElementById('distance-select').value, 10);
  const selectedPairs = getSelectedLeetPairs();

  if (!selectedPairs.length) {
    showToast('Sélectionnez au moins une paire leet.', 'warn');
    return;
  }

  const result = Generator.generateVariants(pseudo, selectedPairs, distance);

  if (result.tooMany) {
    const proceed = confirm(
      `Le nombre estimé de variantes est ~${result.estimate.toLocaleString()}, ce qui dépasse 10 000.\n` +
      `Cela peut bloquer le navigateur. Voulez-vous quand même continuer ?`
    );
    if (!proceed) return;
    // Re-run without guard — force it
    const forceResult = forceGenerate(pseudo, selectedPairs, distance);
    saveAndRenderResults(pseudo, forceResult.variants);
  } else {
    saveAndRenderResults(pseudo, result.variants);
  }
}

function forceGenerate(pseudo, leetPairs, maxDistance) {
  const normalized = pseudo.toLowerCase();
  const n = normalized.length;

  const hasI1 = leetPairs.some(p => p.from === 'i' && p.to === '1');
  const hasL1 = leetPairs.some(p => p.from === 'l' && p.to === '1');

  const subsMap = new Map();
  function addSub(from, to) {
    if (!subsMap.has(from)) subsMap.set(from, new Set());
    subsMap.get(from).add(to);
  }
  for (const pair of leetPairs) {
    addSub(pair.from, pair.to);
    if (pair.to !== '1') addSub(pair.to, pair.from);
  }
  if (hasI1 || hasL1) {
    if (!subsMap.has('1')) subsMap.set('1', new Set());
    if (hasI1) subsMap.get('1').add('i');
    if (hasL1) subsMap.get('1').add('l');
  }

  const posOptions = [];
  for (let i = 0; i < n; i++) {
    const ch = normalized[i];
    const subs = subsMap.get(ch);
    const opts = [ch];
    if (subs) for (const s of subs) if (s !== ch) opts.push(s);
    posOptions.push(opts);
  }

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
  variantsWithDist.sort((a, b) => a.dist !== b.dist ? a.dist - b.dist : a.variant.localeCompare(b.variant));
  return { variants: variantsWithDist.map(v => v.variant) };
}

function saveAndRenderResults(pseudo, variants) {
  const resultsData = {
    pseudo,
    generatedAt: new Date().toISOString(),
    variants
  };
  Storage.set('results', resultsData);
  showToast(`${variants.length} variante(s) générée(s).`, 'success');
  renderResults();
  document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
}

// ── Results rendering ──────────────────────────────────────────────────────────

function renderResults() {
  const results = Storage.get('results', null);
  const section = document.getElementById('results-section');

  if (!results || !results.variants || !results.variants.length) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  renderWordlist(results.variants);
  renderLinks(results.variants);
}

function renderWordlist(variants) {
  document.getElementById('wordlist-textarea').value = variants.join('\n');
}

function populateCategoryFilter(sites) {
  const sel = document.getElementById('links-filter-cat');
  const current = sel.value;
  const cats = [...new Set(sites.map(s => s.cat).filter(Boolean))].sort();
  sel.innerHTML = '<option value="all">Toutes</option>' +
    cats.map(c => `<option value="${escHtml(c)}"${current === c ? ' selected' : ''}>${escHtml(c)}</option>`).join('');
}

function renderLinks(variants) {
  const sites = Sites.getSites();
  const linkStates = Storage.get('link_states', {});
  const linkClicked = Storage.get('link_clicked', {});
  const container = document.getElementById('links-container');
  container.innerHTML = '';

  populateCategoryFilter(sites);

  const filterState = document.getElementById('links-filter').value;
  const filterCat   = document.getElementById('links-filter-cat').value;

  for (const variant of variants) {
    for (const site of sites) {
      const compositeKey = `${variant}::${site.id}`;
      const state = linkStates[compositeKey] ?? null;
      const clicked = linkClicked[compositeKey] ?? false;

      if (filterCat !== 'all' && (site.cat || '') !== filterCat) continue;
      if (filterState === 'unverified' && state !== null) continue;
      if (filterState === '0' && state !== 0) continue;
      if (filterState === '1' && state !== 1) continue;
      if (filterState === '2' && state !== 2) continue;

      const url = Sites.buildUrl(site, variant);
      const div = document.createElement('div');
      div.className = 'link-row';
      div.dataset.key = compositeKey;

      div.innerHTML = `
        <a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer"
           class="link-anchor${clicked ? ' visited' : ''}"
           data-key="${escHtml(compositeKey)}"
           title="${escHtml(site.name)} — ${escHtml(variant)}">
          ${escHtml(site.name)} / ${escHtml(variant)}
        </a>
        <div class="state-buttons" role="group" aria-label="État du lien">
          <button class="btn-state btn-state-0${state === 0 ? ' active' : ''}" data-key="${escHtml(compositeKey)}" data-state="0" title="Ne fonctionne pas" aria-pressed="${state === 0}">🔴</button>
          <button class="btn-state btn-state-1${state === 1 ? ' active' : ''}" data-key="${escHtml(compositeKey)}" data-state="1" title="Fonctionnel mais doute" aria-pressed="${state === 1}">🟡</button>
          <button class="btn-state btn-state-2${state === 2 ? ' active' : ''}" data-key="${escHtml(compositeKey)}" data-state="2" title="Correspond à la recherche" aria-pressed="${state === 2}">🟢</button>
        </div>
      `;
      container.appendChild(div);
    }
  }

  if (!container.children.length) {
    container.innerHTML = '<p class="empty-message">Aucun lien à afficher.</p>';
  }
}

// ── Tabs ───────────────────────────────────────────────────────────────────────

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
    btn.setAttribute('aria-selected', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.dataset.tab === tabName);
  });
}

// ── Event binding ──────────────────────────────────────────────────────────────

function bindEvents() {
  // Collapsible sections — toggle via inline style to avoid CSS specificity issues
  document.querySelectorAll('.collapsible').forEach(card => {
    const btn  = card.querySelector('.btn-collapse');
    const body = card.querySelector('.card-body');

    // Set initial state explicitly
    body.style.display = 'none';
    btn.textContent = '▶';
    btn.setAttribute('aria-expanded', 'false');

    const h2 = card.querySelector('h2');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const expand = body.style.display === 'none';
      body.style.display = expand ? '' : 'none';
      h2.style.marginBottom = expand ? '14px' : '0';
      btn.textContent = expand ? '▼' : '▶';
      btn.setAttribute('aria-expanded', expand);
    });
  });

  // Pseudo input
  document.getElementById('pseudo-input').addEventListener('input', (e) => {
    Storage.set('pseudo', e.target.value.trim());
  });

  // Distance select
  document.getElementById('distance-select').addEventListener('change', (e) => {
    Storage.set('distance', parseInt(e.target.value, 10));
  });

  // Leet checkboxes (delegated)
  document.getElementById('leet-tbody').addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') {
      const id = e.target.dataset.id;
      let selected = Storage.get('leet_selected', getDefaultSelected());
      if (e.target.checked) {
        if (!selected.includes(id)) selected.push(id);
      } else {
        selected = selected.filter(s => s !== id);
      }
      Storage.set('leet_selected', selected);
    }
  });

  // Sites editor — delete (delegated)
  document.getElementById('sites-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete-site');
    if (btn) {
      Sites.removeSite(btn.dataset.id);
      renderSitesEditor();
    }
  });

  // Add site button
  document.getElementById('btn-add-site').addEventListener('click', () => {
    const nameInput = document.getElementById('new-site-name');
    const urlInput = document.getElementById('new-site-url');
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();

    if (!name || !url) {
      showToast('Veuillez remplir le nom et l\'URL.', 'warn');
      return;
    }

    const result = Sites.addSite(name, url);
    if (!result.ok) {
      showToast(result.error, 'error');
      return;
    }

    nameInput.value = '';
    urlInput.value = '';
    renderSitesEditor();
    showToast('Site ajouté.', 'success');
  });

  // Generate button
  document.getElementById('btn-generate').addEventListener('click', generate);

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Copy wordlist
  document.getElementById('btn-copy').addEventListener('click', async () => {
    const text = document.getElementById('wordlist-textarea').value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copié dans le presse-papiers.', 'success');
    } catch {
      showToast('Impossible de copier.', 'error');
    }
  });

  // Links: click tracking and state buttons (delegated)
  document.getElementById('links-container').addEventListener('click', (e) => {
    // Link click
    const anchor = e.target.closest('.link-anchor');
    if (anchor) {
      const compositeKey = anchor.dataset.key;
      const clicked = Storage.get('link_clicked', {});
      clicked[compositeKey] = true;
      Storage.set('link_clicked', clicked);
      anchor.classList.add('visited');
    }

    // State button
    const stateBtn = e.target.closest('.btn-state');
    if (stateBtn) {
      const compositeKey = stateBtn.dataset.key;
      const newState = parseInt(stateBtn.dataset.state, 10);
      const linkStates = Storage.get('link_states', {});
      const currentState = linkStates[compositeKey] ?? null;

      if (currentState === newState) {
        // Toggle off
        delete linkStates[compositeKey];
      } else {
        linkStates[compositeKey] = newState;
      }
      Storage.set('link_states', linkStates);

      // Update UI for this row
      const row = stateBtn.closest('.link-row');
      if (row) {
        row.querySelectorAll('.btn-state').forEach(b => {
          const s = parseInt(b.dataset.state, 10);
          const active = linkStates[compositeKey] === s;
          b.classList.toggle('active', active);
          b.setAttribute('aria-pressed', active);
        });
      }
    }
  });

  // Links filters (state + category)
  function onFilterChange() {
    const results = Storage.get('results', null);
    if (results && results.variants) renderLinks(results.variants);
  }
  document.getElementById('links-filter').addEventListener('change', onFilterChange);
  document.getElementById('links-filter-cat').addEventListener('change', onFilterChange);

  // Reset
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm('Réinitialiser complètement l\'application ? Toutes les données seront perdues.')) return;
    Storage.clearAll();
    location.reload();
  });

  // Export
  document.getElementById('btn-export').addEventListener('click', () => {
    const results = Storage.get('results', null);
    if (!results) {
      showToast('Aucune session à exporter.', 'warn');
      return;
    }
    IO.exportSession();
  });

  // Import
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file-input').click();
  });

  document.getElementById('import-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    IO.importSession(
      file,
      (session) => {
        restoreState();
        renderResults();
        showToast('Session importée avec succès.', 'success');
      },
      (err) => showToast(err, 'error')
    );
    e.target.value = '';
  });
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('visible'));

  setTimeout(() => {
    toast.classList.remove('visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 3000);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Boot ───────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
