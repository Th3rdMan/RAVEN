let leetPairsAll      = [];
let checkerController = null;

function isDirectMode() {
  return document.getElementById('direct-mode')?.checked ?? false;
}

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

  const directMode = Storage.get('direct_mode', false);
  document.getElementById('direct-mode').checked = directMode;
  updateDirectModeUI(directMode);
}

function updateDirectModeUI(enabled) {
  document.body.classList.toggle('direct-mode', enabled);
  const btn = document.getElementById('btn-generate');
  if (btn) btn.textContent = enabled ? 'Lancer la recherche' : 'Générer les variantes';
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

// ── Active sites ───────────────────────────────────────────────────────────────

function getActiveSites() {
  const disabled = Storage.get('sites_disabled', []);
  return Sites.getSites().filter(s => !disabled.includes(s.id));
}

// ── Category filter ────────────────────────────────────────────────────────────

function renderCategoryFilter(sites, disabled) {
  const bar = document.getElementById('cat-filter-bar');
  if (!bar) return;

  const allCats      = [...new Set(sites.filter(s => s.cat).map(s => s.cat))].sort();
  const totalCount   = sites.length;
  const enabledCount = sites.filter(s => !disabled.includes(s.id)).length;

  bar.textContent = '';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'cat-filter-label';
  labelSpan.textContent = 'Catégories :';
  bar.appendChild(labelSpan);

  function makeCatItem(catValue, text) {
    const lbl = document.createElement('label');
    lbl.className = 'cat-filter-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'cat-cb';
    cb.dataset.cat = catValue;
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(' ' + text));
    return { lbl, cb };
  }

  const { lbl: allLbl, cb: allCb } = makeCatItem('all', `Tout (${enabledCount}/${totalCount})`);
  allCb.checked       = enabledCount === totalCount;
  allCb.indeterminate = enabledCount > 0 && enabledCount < totalCount;
  bar.appendChild(allLbl);

  for (const cat of allCats) {
    const catSites   = sites.filter(s => s.cat === cat);
    const catEnabled = catSites.filter(s => !disabled.includes(s.id)).length;
    const { lbl, cb } = makeCatItem(cat, `${cat} (${catEnabled}/${catSites.length})`);
    cb.checked       = catEnabled === catSites.length;
    cb.indeterminate = catEnabled > 0 && catEnabled < catSites.length;
    bar.appendChild(lbl);
  }
}

// ── Sites editor ───────────────────────────────────────────────────────────────

function renderSitesEditor() {
  const sites    = Sites.getSites();
  const disabled = Storage.get('sites_disabled', []);
  const tbody    = document.getElementById('sites-tbody');
  tbody.innerHTML = '';

  renderCategoryFilter(sites, disabled);

  for (const site of sites) {
    const isEnabled = !disabled.includes(site.id);
    const isCustom  = site.id.startsWith('site_');
    const tr = document.createElement('tr');
    tr.dataset.id = site.id;
    if (!isEnabled) tr.classList.add('site-disabled');

    // Col 1 — enable/disable checkbox
    const tdCheck = document.createElement('td');
    tdCheck.className = 'col-check';
    const enableCb = document.createElement('input');
    enableCb.type = 'checkbox';
    enableCb.className = 'site-enable-cb';
    enableCb.dataset.id = site.id;
    enableCb.checked = isEnabled;
    enableCb.setAttribute('aria-label', (isEnabled ? 'Désactiver ' : 'Activer ') + site.name);
    tdCheck.appendChild(enableCb);
    tr.appendChild(tdCheck);

    // Col 2 — name + category badge
    const tdName = document.createElement('td');
    tdName.textContent = site.name;
    if (site.cat) {
      const catSpan = document.createElement('span');
      catSpan.className = 'site-cat';
      catSpan.textContent = site.cat;
      tdName.appendChild(catSpan);
    }
    tr.appendChild(tdName);

    // Col 3 — URL template
    const tdUrl = document.createElement('td');
    tdUrl.className = 'url-cell';
    const urlSpan = document.createElement('span');
    urlSpan.title = site.url;
    urlSpan.textContent = site.url;
    tdUrl.appendChild(urlSpan);
    if (site.strip_bad_char) {
      const stripSpan = document.createElement('span');
      stripSpan.className = 'strip-badge';
      stripSpan.title = 'Caractères ignorés par ce site';
      stripSpan.textContent = 'strip: ';
      const code = document.createElement('code');
      code.textContent = site.strip_bad_char;
      stripSpan.appendChild(code);
      tdUrl.appendChild(stripSpan);
    }
    tr.appendChild(tdUrl);

    // Col 4 — delete button (custom sites only)
    const tdAction = document.createElement('td');
    if (isCustom) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon btn-delete-site';
      delBtn.dataset.id = site.id;
      delBtn.setAttribute('aria-label', 'Supprimer ' + site.name);
      delBtn.title = 'Supprimer';
      delBtn.textContent = '🗑';
      tdAction.appendChild(delBtn);
    }
    tr.appendChild(tdAction);

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

  const directMode = isDirectMode();

  if (directMode) {
    saveAndRenderResults(pseudo, [pseudo]);
    startAutoCheck();
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
  if (isDirectMode()) switchTab('links');
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
  initChecker();
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
  const sites      = getActiveSites();
  const linkStates = Storage.get('link_states', {});
  const linkClicked = Storage.get('link_clicked', {});
  const container  = document.getElementById('links-container');
  container.innerHTML = '';

  populateCategoryFilter(sites);

  const filterState = document.getElementById('links-filter').value;
  const filterCat   = document.getElementById('links-filter-cat').value;

  for (const variant of variants) {
    for (const site of sites) {
      const compositeKey = `${variant}::${site.id}`;
      const state   = linkStates[compositeKey] ?? null;
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
  if (tabName === 'links') initChecker();
}

// ── Auto-checker ───────────────────────────────────────────────────────────────

async function initChecker() {
  const available = await Checker.ping();
  setCheckerUI(available ? 'ready' : 'offline');
}

function setCheckerUI(state) {
  const badge    = document.getElementById('proxy-badge');
  const btnStart = document.getElementById('btn-check-all');
  const btnStop  = document.getElementById('btn-check-stop');
  const progress = document.getElementById('checker-progress');
  const info     = document.getElementById('checker-info');
  if (!badge) return;

  badge.dataset.state = state;

  if (state === 'offline') {
    badge.textContent       = '⬤ Proxy inactif';
    btnStart.disabled       = true;
    btnStop.style.display   = 'none';
    btnStart.style.display  = '';
    progress.style.display  = 'none';
    info.textContent        = 'Service indisponible';
  } else if (state === 'ready') {
    badge.textContent       = '⬤ Proxy actif';
    btnStart.disabled       = false;
    btnStop.style.display   = 'none';
    btnStart.style.display  = '';
    progress.style.display  = 'none';
    const results = Storage.get('results', null);
    const count   = results ? results.variants.length * getActiveSites().length : 0;
    info.textContent = count ? `${count} liens à vérifier` : '';
  } else if (state === 'running') {
    badge.textContent       = '⬤ Vérification…';
    btnStart.disabled       = true;
    btnStart.style.display  = 'none';
    btnStop.style.display   = '';
    progress.style.display  = '';
  } else if (state === 'done') {
    badge.textContent       = '⬤ Proxy actif';
    btnStart.disabled       = false;
    btnStart.style.display  = '';
    btnStop.style.display   = 'none';
    progress.style.display  = 'none';
    info.textContent        = 'Vérification terminée';
  }
}

function updateCheckerProgress(completed, total) {
  const directMode = isDirectMode();
  const fillId = directMode ? 'direct-progress-fill' : 'progress-fill';
  const textId = directMode ? 'direct-progress-text' : 'progress-text';
  const fill = document.getElementById(fillId);
  const text = document.getElementById(textId);
  if (!fill || !text) return;
  fill.style.width = (total ? Math.round((completed / total) * 100) : 0) + '%';
  text.textContent = `${completed} / ${total}`;
}

function setDirectCheckUI(state) {
  const btn      = document.getElementById('btn-direct-check');
  const btnStop  = document.getElementById('btn-direct-stop');
  const progress = document.getElementById('direct-progress');
  if (!btn || !btnStop || !progress) return;
  if (state === 'running') {
    btn.style.display      = 'none';
    btnStop.style.display  = '';
    progress.style.display = '';
  } else {
    btn.style.display      = '';
    btnStop.style.display  = 'none';
    progress.style.display = 'none';
    if (state === 'done') showToast('Vérification terminée.', 'success');
  }
}

function updateLinkRowState(key, state) {
  const linkStates       = Storage.get('link_states', {});
  linkStates[key]        = state;
  Storage.set('link_states', linkStates);

  const row = document.querySelector(`.link-row[data-key="${CSS.escape(key)}"]`);
  if (!row) return;
  row.querySelectorAll('.btn-state').forEach(b => {
    const s      = parseInt(b.dataset.state, 10);
    const active = s === state;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active);
  });
}

async function startAutoCheck() {
  const results = Storage.get('results', null);
  if (!results || !results.variants.length) {
    showToast('Aucun résultat à vérifier.', 'warn');
    return;
  }

  const directMode = isDirectMode();
  const sites = getActiveSites();
  const links = [];
  for (const variant of results.variants) {
    for (const site of sites) {
      links.push({ key: `${variant}::${site.id}`, url: Sites.buildUrl(site, variant) });
    }
  }

  checkerController = new AbortController();
  if (directMode) {
    setDirectCheckUI('running');
  } else {
    setCheckerUI('running');
  }
  updateCheckerProgress(0, links.length);

  await Checker.runAll({
    links,
    concurrency : 3,
    signal      : checkerController.signal,
    onProgress  : (done, total) => updateCheckerProgress(done, total),
    onResult    : (key, state)  => updateLinkRowState(key, state),
  });

  const aborted = checkerController.signal.aborted;
  checkerController = null;
  if (directMode) {
    setDirectCheckUI(aborted ? 'idle' : 'done');
    if (!aborted) renderLinks(results.variants);
  } else {
    setCheckerUI(aborted ? 'ready' : 'done');
    if (!aborted) {
      renderLinks(results.variants);
      showToast('Vérification terminée.', 'success');
    }
  }
}

function stopAutoCheck() {
  if (checkerController) { checkerController.abort(); checkerController = null; }
  setCheckerUI('ready');
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

  // Direct mode checkbox
  document.getElementById('direct-mode').addEventListener('change', (e) => {
    Storage.set('direct_mode', e.target.checked);
    updateDirectModeUI(e.target.checked);
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

  // Sites editor — site enable/disable checkbox (delegated, change event)
  document.getElementById('sites-tbody').addEventListener('change', (e) => {
    const cb = e.target.closest('.site-enable-cb');
    if (!cb) return;
    const id = cb.dataset.id;
    let disabled = Storage.get('sites_disabled', []);
    if (cb.checked) {
      disabled = disabled.filter(d => d !== id);
    } else {
      if (!disabled.includes(id)) disabled.push(id);
    }
    Storage.set('sites_disabled', disabled);
    const tr = cb.closest('tr');
    if (tr) tr.classList.toggle('site-disabled', !cb.checked);
    renderCategoryFilter(Sites.getSites(), disabled);
  });

  // Sites editor — delete custom site (delegated, click event)
  document.getElementById('sites-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete-site');
    if (btn) {
      Sites.removeSite(btn.dataset.id);
      renderSitesEditor();
    }
  });

  // Category filter checkboxes (delegated)
  document.getElementById('cat-filter-bar').addEventListener('change', (e) => {
    const cb = e.target.closest('.cat-cb');
    if (!cb) return;
    const cat   = cb.dataset.cat;
    const sites = Sites.getSites();
    let disabled = Storage.get('sites_disabled', []);

    if (cat === 'all') {
      disabled = cb.checked ? [] : sites.map(s => s.id);
    } else {
      const catIds = sites.filter(s => s.cat === cat).map(s => s.id);
      if (cb.checked) {
        disabled = disabled.filter(id => !catIds.includes(id));
      } else {
        for (const id of catIds) {
          if (!disabled.includes(id)) disabled.push(id);
        }
      }
    }

    Storage.set('sites_disabled', disabled);
    renderSitesEditor();
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

  // Auto-checker controls (mode standard)
  document.getElementById('btn-check-all').addEventListener('click', startAutoCheck);
  document.getElementById('btn-check-stop').addEventListener('click', stopAutoCheck);

  // Auto-checker controls (mode direct)
  document.getElementById('btn-direct-check').addEventListener('click', startAutoCheck);
  document.getElementById('btn-direct-stop').addEventListener('click', () => {
    if (checkerController) { checkerController.abort(); checkerController = null; }
    setDirectCheckUI('idle');  // remet le gros bouton, identique à stopAutoCheck pour le mode standard
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
