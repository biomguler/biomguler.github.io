// ==========================
// sankey.js (right-align + group color propagation)
// ==========================

const DATA_URL = 'ihc.json';

// column order (left → right)
const COLS = [
  'Lineage-Nature',     // L1
  'Major Group',        // L2
  'Category',           // L3
  'Class-Family',       // L4
  'Entity-Type',        // L5
  'Subtype(s)'          // L6
];

const COL_TAGS = {
  'Lineage-Nature': 'L1',
  'Major Group':     'L2',
  'Category':        'L3',
  'Class-Family':    'L4',
  'Entity-Type':     'L5',
  'Subtype(s)':      'L6'
};

// palette for Major Group (exact strings from your data)
const GROUP_COLORS = {
  'NHL':     '#5470C6',
  'HL':      '#EE6666',
  'LPD':     '#91CC75',
  'LPD/NHL': '#FAC858',
  'NHL/HL':  '#73C0DE',
  '*':       '#999999'
};

// palette for Lineage-Nature (L1)
const LINEAGE_COLORS = {
  'PM-LN':   '#8B4513',
  'LN':      '#2E8B57',
  'LN-IDD':  '#A0522D',
  'TLL':     '#4682B4',
  'ID-TLL':  '#DA70D6'
};

// colors assigned to unknown groups will be pulled from here
const FALLBACK_PALETTE = [
  '#3BA272', '#FC8452', '#9A60B4', '#EA7CCC',
  '#2F4554', '#61A0A8', '#D48265', '#91C7AE'
];
let fallbackIndex = 0;

const DEFAULT_NODE_COLOR = '#1f77b4';

const ROOT_LABEL = 'Hematological-lymphoid Neoplasms';
const ROOT_KEY   = 'ROOT|' + ROOT_LABEL;

const norm = s => (s ?? '').toString().trim();
const keyFor = (col, val) => `${(COL_TAGS[col] || 'X')}|${norm(val)}`;
const stripPrefix = s => s.replace(/^[A-Z0-9]+\|/, '');

// default depth threshold for initial rendering
let visibleDepth = 4;

// hold the full graph (all depths) and the currently rendered subset
let fullGraph = { nodes: [], links: [], childMap: new Map() };
let current   = { nodes: [], links: [] };

// ------- build graph (namespaced, dedup) -------
function buildFromRows(rows) {
  const nodeSet = new Set([ROOT_KEY]);
  const childMap = new Map(); // parent -> Set(children)

  function addLink(a, b) {
    if (!a || !b || a === b) return;
    nodeSet.add(a); nodeSet.add(b);
    if (!childMap.has(a)) childMap.set(a, new Set());
    childMap.get(a).add(b);
  }

  rows.forEach(r => {
    const chain = COLS.map(c => [c, norm(r[c])]).filter(([, v]) => !!v);
    if (!chain.length) return;

    addLink(ROOT_KEY, keyFor(chain[0][0], chain[0][1]));
    for (let i = 0; i < chain.length - 1; i++) {
      const [colA, valA] = chain[i];
      const [colB, valB] = chain[i + 1];
      addLink(keyFor(colA, valA), keyFor(colB, valB));
    }
  });

  const nodes = [...nodeSet].map(name => {
    let depth = 0;
    if (name !== ROOT_KEY) {
      const m = name.match(/^L(\d+)\|/);
      depth = m ? parseInt(m[1], 10) : 0;
    }
    return { name, depth, children: Array.from(childMap.get(name) || []) };
  });
  const links = [];
  childMap.forEach((children, parent) => {
    const weight = parent === ROOT_KEY ? 1 : 1 / children.size;
    children.forEach(child => {
      links.push({ source: parent, target: child, value: weight });
    });
  });

  return { nodes, links, childMap };
}

// ------- color propagation from L2 (Major Group) -------
function applyGroupColors(nodes, links) {
  const nodeMap = new Map(nodes.map(n => [n.name, n]));
  const parents = new Map();
  nodes.forEach(n => parents.set(n.name, new Set()));
  links.forEach(l => parents.get(l.target)?.add(l.source));

  const colorCache = new Map();

  function colorForL2Label(label) {
    if (!GROUP_COLORS[label]) {
      const color = FALLBACK_PALETTE[fallbackIndex % FALLBACK_PALETTE.length] || DEFAULT_NODE_COLOR;
      GROUP_COLORS[label] = color;
      fallbackIndex++;
    }
    return GROUP_COLORS[label];
  }

  function colorForL1Label(label) {
    if (!LINEAGE_COLORS[label]) {
      const color = FALLBACK_PALETTE[fallbackIndex % FALLBACK_PALETTE.length] || DEFAULT_NODE_COLOR;
      LINEAGE_COLORS[label] = color;
      fallbackIndex++;
    }
    return LINEAGE_COLORS[label];
  }

  function findNearestColor(nodeName) {
    if (colorCache.has(nodeName)) return colorCache.get(nodeName);

    if (nodeName.startsWith('L2|')) {
      const c = colorForL2Label(stripPrefix(nodeName));
      colorCache.set(nodeName, c);
      return c;
    }
    if (nodeName.startsWith('L1|')) {
      const c = colorForL1Label(stripPrefix(nodeName));
      colorCache.set(nodeName, c);
      return c;
    }
    // BFS upstream until we find L2 or L1
    const seen = new Set([nodeName]);
    const q = [nodeName];
    while (q.length) {
      const u = q.shift();
      const ps = parents.get(u) || new Set();
      for (const p of ps) {
        if (p.startsWith('L2|')) {
          const c = colorForL2Label(stripPrefix(p));
          colorCache.set(nodeName, c);
          return c;
        }
        if (p.startsWith('L1|')) {
          const c = colorForL1Label(stripPrefix(p));
          colorCache.set(nodeName, c);
          return c;
        }
        if (!seen.has(p)) { seen.add(p); q.push(p); }
      }
    }
    colorCache.set(nodeName, DEFAULT_NODE_COLOR);
    return DEFAULT_NODE_COLOR;
  }

  // assign node colors
  nodes.forEach(n => {
    let color = DEFAULT_NODE_COLOR;
    if (n.name !== ROOT_KEY) color = findNearestColor(n.name);
    n.itemStyle = { color, borderColor: color };
  });

  // color links by the SOURCE group color (so flow carries upstream color)
  links.forEach(l => {
    const srcColor =
      nodes.find(n => n.name === l.source)?.itemStyle?.color || DEFAULT_NODE_COLOR;
    l.lineStyle = { color: srcColor, opacity: 0.95 };
  });

  return { nodes, links };
}

// ------- simple DAG check (defensive) -------
function assertDAG(nodes, links) {
  const adj = new Map(), indeg = new Map();
  nodes.forEach(n => { adj.set(n.name, []); indeg.set(n.name, 0); });
  links.forEach(l => { adj.get(l.source)?.push(l.target); indeg.set(l.target, (indeg.get(l.target)||0)+1); });
  const q = []; indeg.forEach((d,k)=>{ if(d===0) q.push(k); });
  let seen = 0;
  while (q.length) {
    const u = q.shift(); seen++;
    (adj.get(u)||[]).forEach(v => {
      indeg.set(v, indeg.get(v)-1);
      if (indeg.get(v)===0) q.push(v);
    });
  }
  if (seen !== nodes.length) throw new Error('Local DAG check failed: cycle present.');
}

// filter graph by depth
function filterByDepth(nodes, links, depthLimit) {
  const keptNodes = nodes.filter(n => (n.depth || 0) <= depthLimit);
  const names = new Set(keptNodes.map(n => n.name));
  const keptLinks = links.filter(l => names.has(l.source) && names.has(l.target));
  return { nodes: keptNodes, links: keptLinks };
}

// recursively collect all descendant node names
function getDescendants(name) {
  const result = new Set();
  const stack = [...(fullGraph.childMap.get(name) || [])];
  while (stack.length) {
    const n = stack.pop();
    if (!result.has(n)) {
      result.add(n);
      stack.push(...(fullGraph.childMap.get(n) || []));
    }
  }
  return result;
}

// expand a node to reveal its hidden descendants
function expandNode(name) {
  const descendants = getDescendants(name);
  if (!descendants.size) return;
  const nodeMap = new Map(fullGraph.nodes.map(n => [n.name, n]));
  const nodeSet = new Set(current.nodes.map(n => n.name));
  const linkSet = new Set(current.links.map(l => `${l.source}|${l.target}`));

  descendants.forEach(n => {
    if (!nodeSet.has(n)) {
      const node = nodeMap.get(n);
      if (node) { current.nodes.push(node); nodeSet.add(n); }
    }
  });

  fullGraph.links.forEach(l => {
    if (nodeSet.has(l.source) && nodeSet.has(l.target)) {
      const key = `${l.source}|${l.target}`;
      if (!linkSet.has(key)) { current.links.push(l); linkSet.add(key); }
    }
  });

  render(current.nodes, current.links);
}

// ------- render (nodeAlign: 'right') -------
const chartEl = document.getElementById('chart');
const chart = echarts.init(chartEl, null, { useDirtyRect: true });

chart.on('click', params => {
  if (params.dataType === 'node' && params.data.depth === visibleDepth) {
    expandNode(params.data.name);
  }
});

function render(nodes, links) {
  assertDAG(nodes, links);

  const option = {
    backgroundColor: '#fff',
    title: { text: 'InterLymph / WHO-HAEM5 — Sankey', subtext: 'from ihc.json', left: 'center' },
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      formatter: (p) => {
        if (p.dataType === 'edge') {
          const s = stripPrefix(p.data.source);
          const t = stripPrefix(p.data.target);
          return `<b>${s}</b> → <b>${t}</b><br/>Rows: <b>${p.data.value}</b>`;
        }
        return `<b>${stripPrefix(p.data.name)}</b>`;
      }
    },
    animation: true,
      series: [{
        type: 'sankey',
        nodeAlign: 'right',
        emphasis: { focus: 'trajectory' },
        nodeGap: 8,
        data: nodes,
        links: links,
        labelLayout: { hideOverlap: true },
        label: { width: 120, fontSize: 12 },
        // do NOT set a series-level itemStyle.color — we want per-node colors to show
        lineStyle: {
              color: 'source',
              curveness: 0.5
            }
      
    }]
  };

  chart.setOption(option, { notMerge: true, lazyUpdate: false });
}

window.addEventListener('resize', () => chart.resize());
new ResizeObserver(() => chart.resize()).observe(chartEl);

// ------- filter + download -------
function filterGraph(nodes, links, q) {
  const query = (q || '').trim().toLowerCase();
  if (!query) return { nodes, links };
  const keep = new Set(nodes
    .filter(n => stripPrefix(n.name).toLowerCase().includes(query))
    .map(n => n.name));
  const flinks = links.filter(l => keep.has(l.source) || keep.has(l.target));
  const fnames = new Set(); flinks.forEach(l => { fnames.add(l.source); fnames.add(l.target); });
  return { nodes: nodes.filter(n => fnames.has(n.name)), links: flinks };
}

document.getElementById('filter').addEventListener('input', e => {
  const f = filterGraph(current.nodes, current.links, e.target.value || '');
  render(f.nodes, f.links);
});
document.getElementById('reset').addEventListener('click', () => {
  document.getElementById('filter').value = '';
  render(current.nodes, current.links);
});
document.getElementById('download').addEventListener('click', () => {
  const url = chart.getDataURL({ type: 'png', backgroundColor: '#ffffff' });
  const a = document.createElement('a'); a.href = url; a.download = 'ln-sankey.png'; a.click();
});

// collapse all expansions
document.getElementById('collapse')?.addEventListener('click', () => {
  document.getElementById('filter').value = '';
  current = filterByDepth(fullGraph.nodes, fullGraph.links, visibleDepth);
  render(current.nodes, current.links);
});

// fullscreen toggle
const fsBtn = document.getElementById('fullscreen');
const chartContainer = document.getElementById('chart-container');
fsBtn?.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    chartContainer?.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});
document.addEventListener('fullscreenchange', () => chart.resize());

// ------- init -------
(async function init() {
  try {
    const rows = await fetch(DATA_URL).then(r => {
      if (!r.ok) throw new Error(`fetch ${DATA_URL} failed: ${r.status}`);
      return r.json();
    });
    if (!Array.isArray(rows)) throw new Error('ihc.json must be a JSON array of row objects.');

    const built   = buildFromRows(rows);
    const colored = applyGroupColors(built.nodes, built.links);
    fullGraph = { nodes: colored.nodes, links: colored.links, childMap: built.childMap };
    current = filterByDepth(fullGraph.nodes, fullGraph.links, visibleDepth);
    render(current.nodes, current.links);
  } catch (e) {
    console.error('Init failed:', e);
    // tiny fallback so you see something
    const nodes = [
      { name: ROOT_KEY, depth: 0, children: ['L2|NHL'] },
      { name: 'L2|NHL', depth: 2, children: ['L3|Large B-cell lymphomas (LBCL)'] },
      { name: 'L3|Large B-cell lymphomas (LBCL)', depth: 3, children: [] }
    ];
    const links = [
      { source: ROOT_KEY, target: 'L2|NHL', value: 1 },
      { source: 'L2|NHL', target: 'L3|Large B-cell lymphomas (LBCL)', value: 1 }
    ];
    const colored = applyGroupColors(nodes, links);
    fullGraph = {
      nodes: colored.nodes,
      links: colored.links,
      childMap: new Map([
        [ROOT_KEY, new Set(['L2|NHL'])],
        ['L2|NHL', new Set(['L3|Large B-cell lymphomas (LBCL)'])]
      ])
    };
    current = filterByDepth(fullGraph.nodes, fullGraph.links, visibleDepth);
    render(current.nodes, current.links);
  }
})();
