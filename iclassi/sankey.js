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
  'NHL':   '#5470C6',
  'HL':    '#EE6666',
  'LPD':   '#91CC75',
  'PM-LN': '#FAC858',
  'ID-LN': '#73C0DE'
};
const DEFAULT_NODE_COLOR = '#1f77b4';

const ROOT_LABEL = 'Hematological-lymphoid Neoplasms';
const ROOT_KEY   = 'ROOT|' + ROOT_LABEL;

const norm = s => (s ?? '').toString().trim();
const keyFor = (col, val) => `${(COL_TAGS[col] || 'X')}|${norm(val)}`;
const stripPrefix = s => s.replace(/^[A-Z]+?\|/, '');

// ------- build graph (namespaced, dedup) -------
function buildFromRows(rows) {
  const nodeSet = new Set([ROOT_KEY]);
  const linkMap = new Map(); // "A||B" -> weight

  function addLink(a, b, w = 1) {
    if (!a || !b || a === b) return;
    nodeSet.add(a); nodeSet.add(b);
    const k = a + '||' + b;
    linkMap.set(k, (linkMap.get(k) || 0) + w);
  }

  rows.forEach(r => {
    const chain = COLS.map(c => [c, norm(r[c])]).filter(([, v]) => !!v);
    if (!chain.length) return;

    addLink(ROOT_KEY, keyFor(chain[0][0], chain[0][1]), 1);
    for (let i = 0; i < chain.length - 1; i++) {
      const [colA, valA] = chain[i];
      const [colB, valB] = chain[i + 1];
      addLink(keyFor(colA, valA), keyFor(colB, valB), 1);
    }
  });

  const nodes = [...nodeSet].map(name => ({ name }));
  const links = [...linkMap.entries()].map(([k, w]) => {
    const [source, target] = k.split('||');
    return { source, target, value: w };
  });

  return { nodes, links };
}

// ------- color propagation from L2 (Major Group) -------
function applyGroupColors(nodes, links) {
  const nodeMap = new Map(nodes.map(n => [n.name, n]));
  const parents = new Map();
  nodes.forEach(n => parents.set(n.name, new Set()));
  links.forEach(l => parents.get(l.target)?.add(l.source));

  const colorCache = new Map();

  function colorForL2Label(label) {
    return GROUP_COLORS[label] || DEFAULT_NODE_COLOR;
  }
  function findNearestL2Color(nodeName) {
    if (colorCache.has(nodeName)) return colorCache.get(nodeName);

    // if node itself is L2|X
    if (nodeName.startsWith('L2|')) {
      const c = colorForL2Label(stripPrefix(nodeName));
      colorCache.set(nodeName, c);
      return c;
    }
    // BFS upstream
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
        if (!seen.has(p)) { seen.add(p); q.push(p); }
      }
    }
    colorCache.set(nodeName, DEFAULT_NODE_COLOR);
    return DEFAULT_NODE_COLOR;
  }

  // assign node colors
  nodes.forEach(n => {
    let color = DEFAULT_NODE_COLOR;
    if (n.name !== ROOT_KEY) color = findNearestL2Color(n.name);
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

// ------- render (nodeAlign: 'right') -------
const chartEl = document.getElementById('chart');
const chart = echarts.init(chartEl, null, { useDirtyRect: true });

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
    animation: false,
    series: [{
      type: 'sankey',
      nodeAlign: 'right',           // << like the demo you found
      emphasis: { focus: 'adjacency' },
      data: nodes,
      links: links,
      // do NOT set a series-level itemStyle.color — we want per-node colors to show
      lineStyle: { curveness: 0.5 }, // per-link colors already set
      label: {
        color: 'rgba(0,0,0,0.85)',
        fontFamily: 'Arial',
        fontSize: 11,
        formatter: params => stripPrefix(params.name)
      },
      nodeWidth: 26,
      nodeGap: 12,
      layoutIterations: 64
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
let current = { nodes: [], links: [] };

(async function init() {
  try {
    const rows = await fetch(DATA_URL).then(r => {
      if (!r.ok) throw new Error(`fetch ${DATA_URL} failed: ${r.status}`);
      return r.json();
    });
    if (!Array.isArray(rows)) throw new Error('ihc.json must be a JSON array of row objects.');

    const built   = buildFromRows(rows);
    const colored = applyGroupColors(built.nodes, built.links);
    current = colored;
    render(current.nodes, current.links);
  } catch (e) {
    console.error('Init failed:', e);
    // tiny fallback so you see something
    const nodes = [{ name: ROOT_KEY }, { name: 'L2|NHL' }, { name: 'L3|Large B-cell lymphomas (LBCL)' }];
    const links = [
      { source: ROOT_KEY, target: 'L2|NHL', value: 1 },
      { source: 'L2|NHL', target: 'L3|Large B-cell lymphomas (LBCL)', value: 1 }
    ];
    const colored = applyGroupColors(nodes, links);
    current = colored;
    render(current.nodes, current.links);
  }
})();
