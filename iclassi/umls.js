function initIclassiUmlsPanel(table, rows, config = {}) {
  const panel = document.querySelector('#umlsPanel');
  if (!panel) return;

  const selectedBox = panel.querySelector('#selectedDisease');
  const cuiList = panel.querySelector('#mappedCuis');
  const results = panel.querySelector('#umlsResults');
  const status = panel.querySelector('#umlsStatus');
  const policySummary = panel.querySelector('#umlsPolicySummary');
  const liveCuiSelect = panel.querySelector('#liveCuiSelect');
  const apiKeyInput = panel.querySelector('#umlsApiKey');
  const liveLookupButton = panel.querySelector('#liveLookupButton');
  const clearLiveButton = panel.querySelector('#clearLiveLookup');
  const liveStatus = panel.querySelector('#liveLookupStatus');
  const liveResults = panel.querySelector('#liveLookupResults');

  const defaultPublicSources = ['MSH', 'NCI', 'HPO', 'MEDLINEPLUS', 'ORPHANET', 'PDQ'];
  let mappings = [];
  let cache = { concepts: {}, entityConcepts: {}, publicSources: defaultPublicSources };
  let selectedRow = null;
  let selectedCui = '';
  let liveRequestInFlight = false;

  Promise.all([
    fetch(config.mappingUrl || 'iclassi_mapping.json', { cache: 'no-store' }).then(toJson),
    fetch(config.cacheUrl || 'umls_concepts.json', { cache: 'no-store' }).then(toJson)
  ])
    .then(([mappingData, cacheData]) => {
      mappings = Array.isArray(mappingData) ? mappingData : [];
      cache = normalizeCache(cacheData);
      setStatus(cache.generatedAt
        ? `Public UMLS cache generated ${cache.generatedAt}.`
        : 'Public UMLS cache is not generated yet.');
      renderPolicySummary();
      if (config.autoSelectInitial !== false && rows && rows.length) selectDisease(rows[0]);
    })
    .catch(error => setStatus(error.message, true));

  window.iclassiSelectDisease = selectDisease;
  window.iclassiClearDiseaseSelection = clearDiseaseSelection;

  if (liveLookupButton) {
    liveLookupButton.addEventListener('click', retrieveLiveLookup);
  }

  if (clearLiveButton) {
    clearLiveButton.addEventListener('click', clearLiveLookup);
  }

  if (liveCuiSelect) {
    liveCuiSelect.addEventListener('change', () => {
      selectedCui = liveCuiSelect.value;
      if (selectedCui) renderPublicConcept(selectedCui, selectedRow && selectedRow['LNIC Code']);
    });
  }

  function selectDisease(row) {
    selectedRow = row;
    const lnic = row['LNIC Code'] || '';
    const entity = row['Entity-Type'] || row['WHO-HAEM5 Entity-Type'] || '';
    const family = row['Class-Family'] || row['WHO-HAEM5 Family-Class'] || '';
    const cuis = getCuisForRow(row);

    selectedBox.innerHTML = `
      <strong>${escapeHtml(entity || 'Selected disease')}</strong>
      <span>${escapeHtml(lnic || 'No LNIC code')}${family ? ` · ${escapeHtml(family)}` : ''}</span>
    `;

    renderCuis(cuis);
    populateLiveCuiSelect(cuis);
    selectedCui = cuis[0] || '';

    if (selectedCui) {
      renderPublicConcept(selectedCui, lnic);
      setLiveStatus(`Ready to retrieve live UMLS metadata for ${selectedCui} using your own API key.`);
    } else {
      renderNoMappedCui();
      setLiveStatus('No mapped CUI is available for this i-CLASSi entity.', true);
    }
    clearLiveResults(false);
  }

  function clearDiseaseSelection() {
    selectedRow = null;
    selectedCui = '';
    selectedBox.innerHTML = `
      <strong>No entity selected</strong>
      <span>Click a terminal hierarchy branch to view mapped UMLS concepts.</span>
    `;
    cuiList.innerHTML = '';
    results.innerHTML = '<p class="muted-small">Public UMLS content will appear here after selecting a mapped CUI.</p>';
    if (liveCuiSelect) liveCuiSelect.innerHTML = '<option value="">Select mapped CUI...</option>';
    if (apiKeyInput) apiKeyInput.value = '';
    clearLiveResults(false);
    setLiveStatus('Select an i-CLASSi terminal branch to enable live lookup for its mapped CUI.');
  }

  function getCuisForRow(row) {
    const lnic = row['LNIC Code'] || '';
    const fromCache = cache.entityConcepts[lnic] || [];
    const fromMapping = mappings
      .filter(item => item['LNIC Code'] === lnic && item.Vocabulary === 'UMLS CUI')
      .map(item => item.Code)
      .filter(isCui);
    const fromRow = Object.entries(row)
      .filter(([key]) => /umls|cui/i.test(key))
      .flatMap(([, value]) => String(value || '').split(/[;,| ]+/))
      .filter(isCui);
    return [...new Set([...fromCache, ...fromMapping, ...fromRow])];
  }

  function renderCuis(cuis) {
    if (!cuis.length) {
      cuiList.innerHTML = '<span class="muted-small">No UMLS CUI is mapped to this entity yet.</span>';
      return;
    }

    cuiList.innerHTML = cuis.map((cui, index) => {
      const concept = cache.concepts[cui];
      const hasPublicContent = Boolean(concept && (getPublicDefinitions(concept).length || getPublicAtoms(concept).length));
      const classes = [index === 0 ? 'active' : '', hasPublicContent ? '' : 'ghost'].filter(Boolean).join(' ');
      return `
        <button type="button" class="${classes}" data-cui="${escapeHtml(cui)}">
          ${escapeHtml(cui)}${hasPublicContent ? '' : ' (no cached public content)'}
        </button>
      `;
    }).join('');

    cuiList.querySelectorAll('button[data-cui]').forEach(button => {
      button.addEventListener('click', () => {
        selectedCui = button.dataset.cui;
        if (liveCuiSelect) liveCuiSelect.value = selectedCui;
        cuiList.querySelectorAll('button[data-cui]').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        renderPublicConcept(selectedCui, selectedRow && selectedRow['LNIC Code']);
        clearLiveResults(false);
        setLiveStatus(`Ready to retrieve live UMLS metadata for ${selectedCui} using your own API key.`);
      });
    });
  }

  function populateLiveCuiSelect(cuis) {
    if (!liveCuiSelect) return;
    liveCuiSelect.innerHTML = '<option value="">Select mapped CUI...</option>';
    cuis.forEach(cui => {
      const option = document.createElement('option');
      option.value = cui;
      option.textContent = cui;
      liveCuiSelect.appendChild(option);
    });
    liveCuiSelect.value = cuis[0] || '';
  }

  function renderPublicConcept(cui, lnic) {
    const concept = cache.concepts[cui] || { ui: cui, definitions: [], atoms: [] };
    const definitions = getPublicDefinitions(concept);
    const atoms = getPublicAtoms(concept);
    const release = cache.umlsVersion || concept.umlsVersion || 'not reported';
    const conceptName = concept.name || getMappedCuiName(cui) || 'UMLS concept';

    results.innerHTML = `
      <div class="concept-header">
        <div>
          <span class="muted-small">${escapeHtml(cui)}${lnic ? ` · ${escapeHtml(lnic)}` : ''}</span>
          <h3>${escapeHtml(conceptName)}</h3>
        </div>
        <a class="concept-link" href="https://uts.nlm.nih.gov/uts/umls/concept/${encodeURIComponent(cui)}" target="_blank" rel="noopener">Open UMLS concept page</a>
      </div>
      <div class="meta-grid compact">
        <div class="meta-item"><span>Mapped CUI</span>${escapeHtml(cui)}</div>
        <div class="meta-item"><span>UMLS release</span>${escapeHtml(release)}</div>
        <div class="meta-item"><span>Public sources</span>${escapeHtml((cache.publicSources || defaultPublicSources).join(', '))}</div>
      </div>
      <div class="definition-list">
        <h3>Definitions</h3>
        ${definitions.length ? definitions.map(definition => `
          <article class="definition">
            <strong>${escapeHtml(definition.rootSource || 'UMLS')}</strong>
            ${definition.sourceIdentifier ? `<span class="muted-small">${escapeHtml(definition.sourceIdentifier)}</span>` : ''}
            <p>${escapeHtml(definition.value || '')}</p>
          </article>
        `).join('') : '<p class="muted-small">No cached public definition is currently available for this mapped UMLS concept.</p>'}
      </div>
      ${renderPublicAtoms(atoms)}
    `;
    setStatus(`Showing public UMLS content for ${cui}.`);
  }

  function renderNoMappedCui() {
    results.innerHTML = '<p class="muted-small">No mapped CUI is available for this i-CLASSi entity.</p>';
  }

  function getPublicDefinitions(concept) {
    const publicSources = getPublicSourceSet();
    const seenDefinitions = new Set();
    const definitions = Array.isArray(concept.definitions)
      ? concept.definitions
      : concept.definitions
        ? [concept.definitions]
        : [];
    return definitions
      .filter(definition => {
        const source = String(definition.rootSource || '').toUpperCase();
        const key = `${source}|${definition.value || ''}`;
        if (!publicSources.has(source) || seenDefinitions.has(key)) return false;
        seenDefinitions.add(key);
        return true;
      });
  }

  function getPublicAtoms(concept) {
    const publicSources = getPublicSourceSet();
    const seenAtoms = new Set();
    const atoms = Array.isArray(concept.atoms)
      ? concept.atoms
      : concept.atoms
        ? [concept.atoms]
        : [];
    return atoms
      .filter(atom => {
        const source = String(atom.rootSource || '').toUpperCase();
        const key = `${source}|${atom.aui || ''}|${atom.name || ''}`;
        if (!publicSources.has(source) || seenAtoms.has(key)) return false;
        seenAtoms.add(key);
        return true;
      });
  }

  function renderPublicAtoms(atoms) {
    if (!atoms.length) {
      return '<p class="muted-small">No cached public atom names are currently available for this mapped UMLS concept.</p>';
    }
    return `
      <div class="atoms-panel public-atoms-panel">
        <h3>Public source names and atoms</h3>
        <div class="atoms-scroll">
          <table>
            <thead><tr><th>CUI</th><th>AUI</th><th>Name</th><th>Source</th><th>Term Type</th><th>Source Code</th></tr></thead>
            <tbody>
              ${atoms.map(atom => `
                <tr>
                  <td>${escapeHtml(atom.cui || '')}</td>
                  <td>${escapeHtml(atom.aui || '')}</td>
                  <td>${escapeHtml(atom.name || '')}</td>
                  <td>${escapeHtml(atom.rootSource || '')}</td>
                  <td>${escapeHtml(atom.termType || '')}</td>
                  <td>${escapeHtml(atom.sourceCode || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function getPublicSourceSet() {
    return new Set((cache.publicSources || defaultPublicSources).map(source => String(source || '').toUpperCase()));
  }

  function getMappedCuiName(cui) {
    const match = mappings.find(item => item.Vocabulary === 'UMLS CUI' && item.Code === cui && item['Vocabulary Prefered Name']);
    return match ? match['Vocabulary Prefered Name'] : '';
  }

  function renderPolicySummary() {
    if (!policySummary) return;
    const release = cache.umlsVersion || 'not reported';
    const represented = cache.representedSources && cache.representedSources.length
      ? cache.representedSources
      : [];
    const allowed = cache.publicSources || defaultPublicSources;
    policySummary.textContent = `UMLS release: ${release}. Public UMLS content is limited to selected CUI, AUI, names, source codes, term metadata, and definitions from ${allowed.join(', ')}. Represented sources in this cache: ${represented.join(', ') || 'none'}.`;
  }

  function retrieveLiveLookup() {
    const cui = liveCuiSelect && liveCuiSelect.value ? liveCuiSelect.value : selectedCui;
    const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';

    if (!cui || !getCuisForRow(selectedRow || {}).includes(cui)) {
      setLiveStatus('Select a mapped CUI from the current i-CLASSi disease before live lookup.', true);
      return;
    }
    if (!apiKey) {
      setLiveStatus('Enter your own active UMLS API key to retrieve live metadata.', true);
      return;
    }
    if (liveRequestInFlight) {
      setLiveStatus('A live UMLS request is already running. Please wait.');
      return;
    }

    liveRequestInFlight = true;
    if (liveLookupButton) liveLookupButton.disabled = true;
    setLiveStatus(`Retrieving live UMLS metadata for ${cui}.`);
    liveResults.innerHTML = '<p class="muted-small">Retrieving live UMLS response for this browser session...</p>';

    fetchLiveConcept(cui, apiKey)
      .then(liveData => {
        renderLiveResponse(cui, liveData);
        setLiveStatus(`Live UMLS response retrieved for ${cui}.`);
      })
      .catch(error => {
        liveResults.innerHTML = `<p class="status error">${escapeHtml(error.message)}</p>`;
        setLiveStatus(error.message, true);
      })
      .finally(() => {
        liveRequestInFlight = false;
        if (liveLookupButton) liveLookupButton.disabled = false;
      });
  }

  function fetchLiveConcept(cui, apiKey) {
    const version = cache.umlsVersion || '2026AA';
    const conceptPath = `content/${encodeURIComponent(version)}/CUI/${encodeURIComponent(cui)}`;
    return fetchUmlsJson(conceptPath, apiKey).then(conceptResponse => {
      const concept = conceptResponse.result || {};
      return Promise.allSettled([
        fetchUmlsJson(`${conceptPath}/definitions`, apiKey, { pageSize: '25' }),
        fetchUmlsJson(`${conceptPath}/atoms`, apiKey, { pageSize: '25' }),
        fetchUmlsJson(`${conceptPath}/relations`, apiKey, { pageSize: '25' })
      ]).then(([definitions, atoms, relations]) => ({
        concept,
        definitions: getSettledResults(definitions),
        atoms: getSettledResults(atoms),
        relations: getSettledResults(relations),
        errors: [definitions, atoms, relations]
          .filter(result => result.status === 'rejected')
          .map(result => result.reason.message)
      }));
    });
  }

  function fetchUmlsJson(path, apiKey, query = {}) {
    const url = new URL(`https://uts-ws.nlm.nih.gov/rest/${path}`);
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    url.searchParams.set('apiKey', apiKey);
    return fetch(url.toString())
      .then(response => {
        if (response.ok) return response.json();
        if (response.status === 401 || response.status === 403) throw new Error('UMLS authorization failed. Check that your API key is active and valid.');
        if (response.status === 404) throw new Error('The selected CUI was not found in the configured UMLS release.');
        if (response.status === 429) throw new Error('UMLS rate limit reached. Please wait before trying again.');
        throw new Error('The UMLS live lookup request failed.');
      })
      .catch(error => {
        if (error.message && (
          error.message.startsWith('UMLS') ||
          error.message.includes('CUI was not found') ||
          error.message.includes('rate limit') ||
          error.message.includes('live lookup request failed')
        )) throw error;
        throw new Error('Network or browser CORS failure during UMLS live lookup.');
      });
  }

  function getSettledResults(result) {
    if (result.status !== 'fulfilled') return [];
    return Array.isArray(result.value.result) ? result.value.result : [];
  }

  function renderLiveResponse(cui, data) {
    const semanticTypes = Array.isArray(data.concept.semanticTypes)
      ? data.concept.semanticTypes.map(item => item.name).filter(Boolean).join(', ')
      : 'Not reported';
    const conceptStatus = data.concept.status === 'R'
      ? 'Reviewed'
      : data.concept.status === 'U'
        ? 'Unreviewed'
        : data.concept.status || 'Not reported';
    liveResults.innerHTML = `
      <div class="concept-header">
        <div>
          <span class="muted-small">${escapeHtml(cui)}</span>
          <h3>${escapeHtml(data.concept.name || cui)}</h3>
        </div>
        <span class="session-badge">Live UMLS response</span>
      </div>
      <div class="meta-grid compact">
        <div class="meta-item"><span>Status</span>${escapeHtml(conceptStatus)}</div>
        <div class="meta-item"><span>Semantic types</span>${escapeHtml(semanticTypes)}</div>
        <div class="meta-item"><span>Class type</span>${escapeHtml(data.concept.classType || 'Not reported')}</div>
      </div>
      ${renderLiveDefinitions(data.definitions)}
      ${renderLiveAtoms(data.atoms)}
      ${renderLiveRelations(data.relations)}
      ${data.errors.length ? `<p class="muted-small">${escapeHtml(data.errors.join(' '))}</p>` : ''}
    `;
    bindLiveDownloads(cui, data);
  }

  function renderLiveDefinitions(definitions) {
    return `
      <div class="definition-list">
        <h3>Definitions</h3>
        ${definitions.length ? definitions.map(definition => `
          <article class="definition">
            <strong>${escapeHtml(definition.rootSource || 'UMLS')}</strong>
            <p>${escapeHtml(definition.value || '')}</p>
          </article>
        `).join('') : '<p class="muted-small">No definitions were returned by the live UMLS response.</p>'}
      </div>
    `;
  }

  function renderLiveAtoms(atoms) {
    if (!atoms.length) return '<p class="muted-small">No atoms were returned by the live UMLS response.</p>';
    return `
      <div class="atoms-panel">
        <div class="live-table-header">
          <h3>Atoms from live response</h3>
          <button type="button" class="secondary" data-live-download="atoms">Download atoms TXT</button>
        </div>
        <div class="atoms-scroll">
          <table>
            <thead><tr><th>Name</th><th>AUI</th><th>Vocabulary</th><th>Term Type</th><th>Source Code</th></tr></thead>
            <tbody>
              ${atoms.slice(0, 25).map(atom => `
                <tr>
                  <td>${escapeHtml(atom.name || '')}</td>
                  <td>${escapeHtml(atom.ui || '')}</td>
                  <td>${escapeHtml(atom.rootSource || '')}</td>
                  <td>${escapeHtml(atom.termType || '')}</td>
                  <td>${escapeHtml(getUmlsCodeId(atom.code) || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderLiveRelations(relations) {
    if (!relations.length) return '<p class="muted-small">No relations were returned by the live UMLS response.</p>';
    return `
      <div class="atoms-panel">
        <div class="live-table-header">
          <h3>Relations from live response</h3>
          <button type="button" class="secondary" data-live-download="relations">Download relations TXT</button>
        </div>
        <div class="atoms-scroll">
          <table>
            <thead><tr><th>Relation</th><th>Additional relation</th><th>Related concept</th><th>Vocabulary</th></tr></thead>
            <tbody>
              ${relations.slice(0, 25).map(relation => `
                <tr>
                  <td>${escapeHtml(relation.relationLabel || '')}</td>
                  <td>${escapeHtml(relation.additionalRelationLabel || '')}</td>
                  <td>${escapeHtml(relation.relatedIdName || relation.relatedId || '')}</td>
                  <td>${escapeHtml(relation.rootSource || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function bindLiveDownloads(cui, data) {
    liveResults.querySelectorAll('[data-live-download]').forEach(button => {
      button.addEventListener('click', () => {
        const type = button.dataset.liveDownload;
        if (type === 'atoms') {
          downloadTextFile(
            `umls-${cui}-atoms.txt`,
            buildAtomDownloadText(cui, data.atoms)
          );
        }
        if (type === 'relations') {
          downloadTextFile(
            `umls-${cui}-relations.txt`,
            buildRelationDownloadText(cui, data.relations)
          );
        }
      });
    });
  }

  function buildAtomDownloadText(cui, atoms) {
    const rows = [
      ['CUI', 'Name', 'AUI', 'Vocabulary', 'Term Type', 'Source Code']
    ];
    atoms.slice(0, 25).forEach(atom => {
      rows.push([
        cui,
        atom.name || '',
        atom.ui || '',
        atom.rootSource || '',
        atom.termType || '',
        getUmlsCodeId(atom.code) || ''
      ]);
    });
    return rows.map(row => row.map(cleanTextCell).join('\t')).join('\n');
  }

  function buildRelationDownloadText(cui, relations) {
    const rows = [
      ['CUI', 'Relation', 'Additional Relation', 'Related Concept', 'Vocabulary']
    ];
    relations.slice(0, 25).forEach(relation => {
      rows.push([
        cui,
        relation.relationLabel || '',
        relation.additionalRelationLabel || '',
        relation.relatedIdName || relation.relatedId || '',
        relation.rootSource || ''
      ]);
    });
    return rows.map(row => row.map(cleanTextCell).join('\t')).join('\n');
  }

  function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function cleanTextCell(value) {
    return String(value || '').replace(/[\r\n\t]+/g, ' ').trim();
  }

  function clearLiveLookup() {
    if (apiKeyInput) apiKeyInput.value = '';
    clearLiveResults(true);
  }

  function clearLiveResults(showStatus) {
    liveResults.innerHTML = '<p class="muted-small">No live UMLS response has been retrieved in this browser session.</p>';
    if (showStatus) setLiveStatus('API key and live response cleared from this browser session.');
  }

  function normalizeCache(data) {
    const normalized = data && typeof data === 'object' ? data : {};
    normalized.concepts = normalized.concepts || {};
    normalized.entityConcepts = normalized.entityConcepts || {};
    normalized.publicSources = normalized.publicSources || defaultPublicSources;
    normalized.representedSources = normalized.representedSources || [];
    return normalized;
  }

  function toJson(response) {
    if (!response.ok) throw new Error(`Could not load ${response.url}.`);
    return response.json();
  }

  function isCui(value) {
    return /^C\d{7}$/i.test(String(value || '').trim());
  }

  function getUmlsCodeId(codeUri) {
    if (!codeUri) return '';
    return decodeURIComponent(String(codeUri).split('/').pop());
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.className = isError ? 'status error' : 'status';
  }

  function setLiveStatus(message, isError = false) {
    liveStatus.textContent = message;
    liveStatus.className = isError ? 'status error' : 'status';
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
