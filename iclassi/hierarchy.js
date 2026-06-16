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
  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = options.className || 'hierarchy-tree';
  Array.from(root.children.values())
    .sort(compareNodes)
    .forEach(node => list.appendChild(renderNode(node, 0, options)));
  container.appendChild(list);
}

function renderNode(node, depth, options) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node';
  const hasChildren = node.children.size > 0;
  const isTerminal = !hasChildren || node.label === 'L6';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `tree-item ${isTerminal ? 'terminal' : ''}`;
  button.style.paddingLeft = `${5 + depth * 14}px`;
  button.innerHTML = `
    <span class="tree-arrow">${hasChildren ? '▶' : '•'}</span>
    <span class="tree-level">${node.label}:</span>
    <span class="tree-label">${escapeHierarchyHtml(node.value)}</span>
    <span class="tree-count">${node.rows.length}</span>
  `;

  const children = document.createElement('div');
  children.className = 'tree-children';
  children.hidden = true;
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

function escapeHierarchyHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
