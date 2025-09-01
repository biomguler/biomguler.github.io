// ==========================
// sankey.js (cycle-proof)
// ==========================

// -------- settings --------
const DATA_URL = 'ihc.json'; // same folder as index.html

// Build the flow from these columns (left → right) using your exact keys
const COLS = [
  'Lineage-Nature',     // L1
  'Major Group',        // L2
  'Category',           // L3
  'Class-Family',       // L4
  'Entity-Type',        // L5
  'Subtype(s)'          // L6
];

// short tags per column (for unique node keys)
const COL_TAGS = {
  'Lineage-Nature': 'L1',
  'Major Group': 'L2',
  'Category': 'L3',
  'Class-Family': 'L4',
  'Entity-Type': 'L5',
  'Subtype(s)': 'L6'
};

// optional colors for top buckets
const GROUP_COLORS = {
  NHL:'#5470C6', HL:'#EE6666', LPD:'#91CC75', 'PM-LN':'#FAC858', 'ID-LN':'#73C0DE'
};
const DEFAULT_NODE_COLOR = '#1f77b4';

const ROOT_LABEL = 'Hematological-lymphoid Neoplasms';
const ROOT_KEY   = 'ROOT|' + ROOT_LABEL;

// ---------- helpers ----------
const norm = s => (s ?? '').toString().trim();
const keyFor = (col, val) => `${(COL_TAGS[col] || 'X')}|${norm(val)}`;
const stripPrefix = s => s.replace(/^[A-Z]+?\|/, '');

// ---------- build graph (namespaced nodes, dedup, no self-loops) ----------
function buildFromRows(rows) {
  const nodeSet = new Set([ROOT_KEY]);
  const linkMap = new Map(); // "A||B" -> weight
  let used = 0;

  function addLink(a, b, w = 1) {
    if (!a || !b) return;
    if (a === b) return;                 // guard self-loops
    nodeSet.add(a); nodeSet.add(b);
    const k = a + '||' + b;
    linkMap.set(k, (linkMap.get(k) || 0) + w);
  }

  rows.forEach(r => {
    const chain = COLS
      .map(c => [c, norm(r[c])])
      .filter(([, v]) => !!v);

    if (!chain.length) return;
    used++;

    // Root → first level
    addLink(ROOT_KEY, keyFor(chain[0][0], chain[0][1]), 1);

    // Chain through levels
    for (let i = 0; i < chain.length - 1; i++) {
      const [colA, valA] = chain[i];
      const [colB, valB] = chain[i + 1];
      addLink(keyFor(colA, valA), keyFor(colB, valB), 1);
    }
  });

  // Nodes
  const nodes = [...nodeSet].map(name => {
    const label = stripPrefix(name);
    // Color only the Major Group (MG|…) nodes by palette
    let color = DEFAULT_NODE_COLOR;
    if (name.startsWith('MG|')) color = GROUP_COLORS[label] || DEFAULT_NODE_COLOR;
    return { name, itemStyle: { color, borderColor: color } };
  });

  // Links (dedup already via linkMap; self-loops already filtered)
  const links = [...linkMap.entries()].map(([k, w]) => {
    const [source, target] = k.split('||');
    return { source, target, value: w };
  });

  console.log(`Sankey build: rows used=${used}, nodes=${nodes.length}, links=${links.length}`);
  return { nodes, links };
}

// ---------- simple DAG sanity check (optional; throws on cycle) ----------
function assertDAG(nodes, links) {
  const adj = new Map(), indeg = new Map();
  nodes.forEach(n => { adj.set(n.name, []); indeg.set(n.name, 0); });
  links.forEach(l => {
    if (!adj.has(l.source)) adj.set(l.source, []);
    adj.get(l.source).push(l.target);
    indeg.set(l.target, (indeg.get(l.target) || 0) + 1);
  });
  const q = [];
  indeg.forEach((d, k) => { if (d === 0) q.push(k); });
  let seen = 0;
  while (q.length) {
    const u = q.shift(); seen++;
    (adj.get(u) || []).forEach(v => {
      indeg.set(v, indeg.get(v) - 1);
      if (indeg.get(v) === 0) q.push(v);
    });
  }
  if (seen !== nodes.length) throw new Error('Local DAG check failed: cycle present.');
}

// ---------- rendering ----------
const chart = echarts.init(document.getElementById('chart'));

function render(nodes, links) {
  // Optional: verify no cycle before rendering
  assertDAG(nodes, links);

  const option = {
    backgroundColor: '#fff',
    title: { text: 'InterLymph / WHO-HAEM5 — Sankey', subtext: 'from ihc.json', left: 'center' },
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        if (p.dataType === 'edge') {
          const s = stripPrefix(p.data.source);
          const t = stripPrefix(p.data.target);
          return `<b>${s}</b> → <b>${t}</b><br/>Rows: <b>${p.data.value}</b>`;
        }
        return `<b>${stripPrefix(p.data.name)}</b>`;
      }
    },
    series: [{
      type: 'sankey',
      left: 50, top: 20, right: 150, bottom: 25,
      data: nodes,
      links: links,
      lineStyle: { color: 'source', curveness: 0.5 },
      itemStyle: { color: DEFAULT_NODE_COLOR, borderColor: DEFAULT_NODE_COLOR },
      label: {
        color: 'rgba(0,0,0,0.7)',
        fontFamily: 'Arial',
        fontSize: 10,
        formatter: params => stripPrefix(params.name)
      },
      nodeWidth: 22, nodeGap: 10, layoutIterations: 64,
      emphasis: { focus: 'adjacency' }
    }]
  };

  // IMPORTANT: render fresh each time to avoid lingering edges that form cycles
  chart.setOption(option, { notMerge: true, lazyUpdate: false });
  window.addEventListener('resize', () => chart.resize());
}

// ---------- filter + download ----------
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

// ---------- load & go ----------
let current = { nodes: [], links: [] };

(async function init() {
  try {
    const rows = await fetch(DATA_URL).then(r => {
      if (!r.ok) throw new Error(`fetch ${DATA_URL} failed: ${r.status}`);
      return r.json();
    });
    if (!Array.isArray(rows)) throw new Error('ihc.json must be a JSON array of row objects.');
    current = buildFromRows(rows);
    render(current.nodes, current.links);
  } catch (e) {
    console.error('Init failed:', e);
    // Minimal fallback to verify the chart mounts
    const nodes = [{ name: ROOT_KEY }, { name: 'MG|NHL' }, { name: 'C1|Large B-cell lymphomas (LBCL)' }];
    const links = [
      { source: ROOT_KEY, target: 'MG|NHL', value: 1 },
      { source: 'MG|NHL', target: 'C1|Large B-cell lymphomas (LBCL)', value: 1 }
    ];
    render(nodes, links);
  }
})();
