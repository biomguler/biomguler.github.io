function initIclassiUmlsPanel(table, rows, config = {}) {
  const panel = document.querySelector('#umlsPanel');
  if (!panel) return;

  const selectedBox = panel.querySelector('#selectedDisease');
  const cuiList = panel.querySelector('#mappedCuis');
  const results = panel.querySelector('#umlsResults');
  const status = panel.querySelector('#umlsStatus');
  const cacheSearch = panel.querySelector('#umlsCacheSearch');
  const cacheSearchButton = panel.querySelector('#umlsCacheSearchButton');

  let mappings = [];
  let cache = { concepts: {}, entityConcepts: {} };
  let selectedRow = null;

  Promise.all([
    fetch(config.mappingUrl || 'iclassi_mapping.json').then(toJson),
    fetch(config.cacheUrl || 'umls_concepts.json').then(toJson)
  ])
    .then(([mappingData, cacheData]) => {
      mappings = Array.isArray(mappingData) ? mappingData : [];
      cache = normalizeCache(cacheData);
      setStatus(cache.generatedAt
        ? `UMLS metadata cache generated ${cache.generatedAt}.`
        : 'UMLS metadata cache is not generated yet.');
      if (config.autoSelectInitial !== false && rows && rows.length) selectDisease(rows[0]);
    })
    .catch(error => setStatus(error.message, true));

  if (cacheSearchButton) {
    cacheSearchButton.addEventListener('click', () => searchCache(cacheSearch.value));
  }

  if (cacheSearch) {
    cacheSearch.addEventListener('keydown', event => {
      if (event.key === 'Enter') searchCache(cacheSearch.value);
    });
  }

  window.iclassiSelectDisease = selectDisease;

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
    if (cacheSearch) cacheSearch.value = entity;

    const firstCached = cuis.find(cui => cache.concepts[cui]);
    if (firstCached) {
      renderConcept(cache.concepts[firstCached], lnic);
    } else {
      renderMissing(cuis, lnic);
    }
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

    cuiList.innerHTML = cuis.map(cui => {
      const isCached = Boolean(cache.concepts[cui]);
      return `
        <button type="button" class="${isCached ? '' : 'ghost'}" data-cui="${escapeHtml(cui)}">
          ${escapeHtml(cui)}${isCached ? '' : ' (not cached)'}
        </button>
      `;
    }).join('');

    cuiList.querySelectorAll('button[data-cui]').forEach(button => {
      button.addEventListener('click', () => {
        const concept = cache.concepts[button.dataset.cui];
        if (concept) renderConcept(concept, selectedRow && selectedRow['LNIC Code']);
        else renderMissing([button.dataset.cui], selectedRow && selectedRow['LNIC Code']);
      });
    });
  }

  function searchCache(query) {
    const value = String(query || '').trim().toLowerCase();
    if (!value) {
      setStatus('Enter a CUI or disease name to search the local metadata cache.', true);
      return;
    }

    const matches = Object.values(cache.concepts)
      .filter(concept =>
        String(concept.ui || '').toLowerCase().includes(value) ||
        String(concept.name || '').toLowerCase().includes(value) ||
        (concept.semanticTypes || []).join(' ').toLowerCase().includes(value)
      )
      .slice(0, 20);

    if (!matches.length) {
      results.innerHTML = '<p class="muted-small">No cached UMLS concepts match this search.</p>';
      setStatus('No match in the generated UMLS cache.', true);
      return;
    }

    results.innerHTML = `
      <div class="result-list">
        ${matches.map(concept => `
          <button type="button" data-cui="${escapeHtml(concept.ui)}">
            <strong>${escapeHtml(concept.ui)}</strong>
            <span>${escapeHtml(concept.name || '')}</span>
          </button>
        `).join('')}
      </div>
    `;
    results.querySelectorAll('button[data-cui]').forEach(button => {
      button.addEventListener('click', () => renderConcept(cache.concepts[button.dataset.cui]));
    });
    setStatus(`Found ${matches.length} cached UMLS concept${matches.length === 1 ? '' : 's'}.`);
  }

  function renderConcept(concept, lnic) {
    if (concept.notFound || concept.status === 'not_found') {
      renderNotFoundConcept(concept, lnic);
      return;
    }
    const definitions = Array.isArray(concept.definitions) ? concept.definitions : [];
    const atoms = Array.isArray(concept.atoms) ? concept.atoms : [];
    const semanticTypes = (concept.semanticTypes || []).join(', ') || 'Not reported';
    results.innerHTML = `
      <div class="concept-header">
        <div>
          <span class="muted-small">${escapeHtml(concept.ui || '')}${lnic ? ` · ${escapeHtml(lnic)}` : ''}</span>
          <h3>${escapeHtml(concept.name || concept.ui || 'UMLS concept')}</h3>
        </div>
        ${concept.ui ? `<a class="concept-link" href="https://uts-ws.nlm.nih.gov/rest/content/current/CUI/${encodeURIComponent(concept.ui)}" target="_blank" rel="noopener">Open UMLS metadata</a>` : ''}
      </div>
      <div class="meta-grid compact">
        <div class="meta-item"><span>Status</span>${escapeHtml(concept.status || 'Not reported')}</div>
        <div class="meta-item"><span>Semantic type</span>${escapeHtml(semanticTypes)}</div>
        <div class="meta-item"><span>Atoms</span>${escapeHtml(String(concept.atomCount || 0))}</div>
        <div class="meta-item"><span>Relations</span>${escapeHtml(String(concept.relationCount || 0))}</div>
        <div class="meta-item"><span>Major revision</span>${escapeHtml(concept.majorRevisionDate || 'Not reported')}</div>
      </div>
      <div class="definition-list">
        ${definitions.length ? definitions.map(definition => `
          <article class="definition">
            <strong>${escapeHtml(definition.rootSource || 'UMLS')}</strong>
            <p>${escapeHtml(definition.value || '')}</p>
          </article>
        `).join('') : '<p class="muted-small">No definitions were returned for this concept when the cache was generated.</p>'}
      </div>
      ${renderAtoms(atoms)}
    `;
    setStatus(`Showing cached UMLS concept ${concept.ui}.`);
  }

  function renderAtoms(atoms) {
    if (!atoms.length) {
      return '<p class="muted-small">No atoms were cached for this concept.</p>';
    }
    return `
      <div class="atoms-panel">
        <h3>Atoms</h3>
        <div class="atoms-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>AUI</th>
                <th>Vocabulary</th>
                <th>Term Type</th>
                <th>Code</th>
              </tr>
            </thead>
            <tbody>
              ${atoms.map(atom => `
                <tr>
                  <td>${escapeHtml(atom.name || '')}</td>
                  <td>${escapeHtml(atom.aui || '')}</td>
                  <td>${escapeHtml(atom.vocabulary || '')}</td>
                  <td>${escapeHtml(atom.termType || '')}</td>
                  <td>${escapeHtml(atom.code || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderNotFoundConcept(concept, lnic) {
    const fallbackNames = Array.isArray(concept.mappingPreferredNames) ? concept.mappingPreferredNames : [];
    results.innerHTML = `
      <div class="concept-header">
        <div>
          <span class="muted-small">${escapeHtml(concept.ui || '')}${lnic ? ` · ${escapeHtml(lnic)}` : ''}</span>
          <h3>${escapeHtml(concept.name || concept.ui || 'Mapped UMLS CUI')}</h3>
        </div>
        ${concept.ui ? `<a class="concept-link" href="https://uts-ws.nlm.nih.gov/rest/content/current/CUI/${encodeURIComponent(concept.ui)}" target="_blank" rel="noopener">Open UMLS metadata</a>` : ''}
      </div>
      <p class="muted-small">
        This mapped CUI was not found in the configured UMLS release when the metadata cache was generated.
        The mapping is preserved, but UMLS concept metadata could not be retrieved.
      </p>
      ${fallbackNames.length ? `
        <div class="definition-list">
          <article class="definition">
            <strong>Mapping preferred name</strong>
            <p>${fallbackNames.map(escapeHtml).join('; ')}</p>
          </article>
        </div>
      ` : ''}
    `;
    setStatus(`Mapped CUI ${concept.ui} was not found in UMLS ${concept.umlsVersion || 'current'}.`, true);
  }

  function renderMissing(cuis, lnic) {
    const cuiText = cuis.length ? cuis.join(', ') : 'No CUI';
    results.innerHTML = `
      <p class="muted-small">
        ${escapeHtml(cuiText)} ${lnic ? `for ${escapeHtml(lnic)} ` : ''}is not in the generated UMLS metadata cache yet.
        Run <code>scripts/build-umls-cache.ps1</code> with your private UMLS API key, then publish the updated
        <code>iclassi/umls_concepts.json</code>.
      </p>
    `;
  }

  function normalizeCache(data) {
    const normalized = data && typeof data === 'object' ? data : {};
    normalized.concepts = normalized.concepts || {};
    normalized.entityConcepts = normalized.entityConcepts || {};
    return normalized;
  }

  function toJson(response) {
    if (!response.ok) throw new Error(`Could not load ${response.url}.`);
    return response.json();
  }

  function isCui(value) {
    return /^C\d{7}$/i.test(String(value || '').trim());
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.className = isError ? 'status error' : 'status';
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
