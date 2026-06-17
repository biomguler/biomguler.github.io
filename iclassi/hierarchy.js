const ICLASSI_HIERARCHY_LEVELS = [
  { key: 'Lineage-Nature', label: 'L1', columnIndex: 7 },
  { key: 'Major Group', label: 'L2', columnIndex: 8 },
  { key: 'Category', label: 'L3', columnIndex: 9 },
  { key: 'Class-Family', label: 'L4', columnIndex: 10 },
  { key: 'Entity-Type', label: 'L5', columnIndex: 11 },
  { key: 'Subtype(s)', label: 'L6', columnIndex: 12 }
];

function buildIclassiHierarchy(rows) {
  const root = { children: new Map(), rows: [] };
  rows.forEach(row => {
    const path = ICLASSI_HIERARCHY_LEVELS
      .map(level => ({
        ...level,
        value: normalizeHierarchyValue(row[level.key])
      }))
      .filter(item => item.value && item.value !== '*');

    let node = root;
    path.forEach(item => {
      const id = `${item.label}:${item.value}`;
      if (!node.children.has(id)) {
        node.children.set(id, {
          id,
          key: item.key,
          label: item.label,
          value: item.value,
          columnIndex: item.columnIndex,
          children: new Map(),
          rows: []
        });
      }
      node = node.children.get(id);
      node.rows.push(row);
    });
  });
  return root;
}

function renderExpandableHierarchy(container, rows, options = {}) {
  const root = buildIclassiHierarchy(rows);
  const renderOptions = {
    ...options,
    searchQuery: normalizeHierarchyValue(options.searchQuery).toLowerCase(),
    expandToLevel: Math.max(1, Number(options.expandToLevel || 1))
  };
  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = options.className || 'hierarchy-tree';
  const nodes = Array.from(root.children.values()).sort(compareNodes);
  if (!nodes.length) {
    const empty = document.createElement('p');
    empty.className = 'muted-small hierarchy-empty';
    empty.textContent = options.searchQuery
      ? 'No hierarchy branches match this search.'
      : 'No hierarchy branches are available.';
    list.appendChild(empty);
  }
  nodes
    .sort(compareNodes)
    .forEach(node => list.appendChild(renderNode(node, 0, renderOptions)));
  container.appendChild(list);
}

function renderNode(node, depth, options) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node';
  const hasChildren = node.children.size > 0;
  const isTerminal = !hasChildren || node.label === 'L6';
  const isMatch = Boolean(options.searchQuery && nodeMatchesSearch(node, options.searchQuery));
  const subtreeMatch = Boolean(options.searchQuery && subtreeMatchesSearch(node, options.searchQuery));
  const shouldExpand = hasChildren && (
    options.searchQuery ? subtreeMatch : getHierarchyLevelNumber(node.label) < options.expandToLevel
  );
  const button = document.createElement('button');
  button.type = 'button';
  button.className = [
    'tree-item',
    isTerminal ? 'terminal' : '',
    isMatch ? 'match' : '',
    subtreeMatch && !isMatch ? 'branch-match' : ''
  ].filter(Boolean).join(' ');
  button.style.paddingLeft = `${5 + depth * 14}px`;
  button.innerHTML = `
    <span class="tree-arrow">${hasChildren ? (shouldExpand ? '▼' : '▶') : '•'}</span>
    <span class="tree-level">${node.label}:</span>
    <span class="tree-label">${highlightHierarchyMatch(node.value, options.searchQuery)}</span>
    <span class="tree-count">${node.rows.length}</span>
  `;

  const children = document.createElement('div');
  children.className = 'tree-children';
  children.hidden = !shouldExpand;
  button.classList.toggle('expanded', shouldExpand);
  Array.from(node.children.values())
    .sort(compareNodes)
    .forEach(child => children.appendChild(renderNode(child, depth + 1, options)));

  button.addEventListener('click', () => {
    if (hasChildren) {
      children.hidden = !children.hidden;
      button.classList.toggle('expanded', !children.hidden);
      button.querySelector('.tree-arrow').textContent = children.hidden ? '▶' : '▼';
    }
    if (typeof options.onSelect === 'function') {
      options.onSelect(node, button, isTerminal);
    }
  });

  wrapper.appendChild(button);
  if (hasChildren) wrapper.appendChild(children);
  return wrapper;
}

function compareNodes(a, b) {
  return String(a.value).localeCompare(String(b.value), undefined, { numeric: true, sensitivity: 'base' });
}

function normalizeHierarchyValue(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getHierarchyLevelNumber(label) {
  const match = String(label || '').match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function nodeMatchesSearch(node, query) {
  if (!query) return false;
  return String(node.value || '').toLowerCase().includes(query);
}

function subtreeMatchesSearch(node, query) {
  if (nodeMatchesSearch(node, query)) return true;
  if (node.rows.some(row => rowMatchesSearch(row, query))) return true;
  return Array.from(node.children.values()).some(child => subtreeMatchesSearch(child, query));
}

function rowMatchesSearch(row, query) {
  return Object.values(row).some(value => String(value || '').toLowerCase().includes(query));
}

function highlightHierarchyMatch(value, query) {
  const text = String(value || '');
  if (!query) return escapeHierarchyHtml(text);
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(query);
  if (index === -1) return escapeHierarchyHtml(text);
  return [
    escapeHierarchyHtml(text.slice(0, index)),
    '<mark>',
    escapeHierarchyHtml(text.slice(index, index + query.length)),
    '</mark>',
    escapeHierarchyHtml(text.slice(index + query.length))
  ].join('');
}

function escapeHierarchyHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
