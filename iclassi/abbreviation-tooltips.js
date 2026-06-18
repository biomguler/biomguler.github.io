(function() {
  const TARGET_SELECTOR = [
    'table.dataTable tbody',
    '.hierarchy-tree',
    '#entityDetail',
    '#mappingContextBody',
    '#gwasContextBody',
    '[data-abbreviations]'
  ].join(', ');

  let abbreviationPattern = null;
  let abbreviationMap = new Map();
  let observer = null;
  let scheduled = false;

  function init() {
    const versionReady = window.IclassiVersions
      ? window.IclassiVersions.ready()
      : Promise.resolve({ file: filename => filename });

    versionReady
      .then(versionContext => fetch(versionContext.file('abbreviations.json'), { cache: 'no-store' }))
      .then(response => {
        if (!response.ok) throw new Error('Could not load abbreviations.json');
        return response.json();
      })
      .then(rows => {
        abbreviationMap = buildAbbreviationMap(rows);
        const abbreviations = [...abbreviationMap.keys()]
          .sort((a, b) => b.length - a.length)
          .map(escapeRegExp);
        if (!abbreviations.length) return;
        abbreviationPattern = new RegExp(
          `(^|[^A-Za-z0-9])(${abbreviations.join('|')})(?=$|[^A-Za-z0-9])`,
          'g'
        );
        decorateTargets(document);
        observeChanges();
      })
      .catch(error => {
        console.warn('Abbreviation tooltips are unavailable:', error.message);
      });
  }

  function buildAbbreviationMap(rows) {
    const result = new Map();
    rows.forEach(row => {
      const abbreviation = String(
        row.abbreviation || row['Abbreviations-acronyms'] || ''
      ).trim();
      const fullName = String(
        row.full_name || row['Full name'] || ''
      ).trim();
      if (!abbreviation || !fullName) return;

      const record = {
        abbreviation,
        fullName,
        category: String(row.category || '').trim(),
        status: String(row.status || '').trim()
      };
      result.set(abbreviation, record);
      normalizeAliases(row.aliases).forEach(alias => {
        if (!result.has(alias)) result.set(alias, record);
      });
    });
    return result;
  }

  function normalizeAliases(value) {
    if (Array.isArray(value)) {
      return value.map(alias => String(alias).trim()).filter(Boolean);
    }
    return String(value || '')
      .split(/[,;|]+/)
      .map(alias => alias.trim())
      .filter(Boolean);
  }

  function observeChanges() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        decorateTargets(document);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function decorateTargets(root) {
    if (!abbreviationPattern) return;
    if (root.matches && root.matches(TARGET_SELECTOR)) {
      decorate(root);
    }
    root.querySelectorAll(TARGET_SELECTOR).forEach(decorate);
  }

  function decorate(container) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || parent.closest('.abbr-term, script, style, input, select, textarea, option')) {
          return NodeFilter.FILTER_REJECT;
        }
        abbreviationPattern.lastIndex = 0;
        return abbreviationPattern.test(node.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(replaceAbbreviations);
  }

  function replaceAbbreviations(textNode) {
    const text = textNode.nodeValue;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let match;
    abbreviationPattern.lastIndex = 0;

    while ((match = abbreviationPattern.exec(text)) !== null) {
      const prefix = match[1] || '';
      const abbreviation = match[2];
      const abbreviationStart = match.index + prefix.length;
      const record = abbreviationMap.get(abbreviation);
      if (!record) continue;

      fragment.appendChild(document.createTextNode(text.slice(cursor, abbreviationStart)));
      const term = document.createElement('span');
      term.className = 'abbr-term';
      term.tabIndex = 0;
      term.textContent = abbreviation;
      term.dataset.expansion = record.fullName;
      const aliasNote = abbreviation === record.abbreviation
        ? ''
        : `; alias of ${record.abbreviation}`;
      term.title = `${record.fullName}${aliasNote}`;
      term.setAttribute('aria-label', `${abbreviation}: ${record.fullName}${aliasNote}`);
      fragment.appendChild(term);
      cursor = abbreviationStart + abbreviation.length;
    }

    if (cursor === 0) return;
    fragment.appendChild(document.createTextNode(text.slice(cursor)));
    textNode.replaceWith(fragment);
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
