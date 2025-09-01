// ==========================
// sankey.js (namespaced + group-color propagation)
// ==========================

// -------- settings --------
const DATA_URL = 'ihc.json'; // same folder as index.html

// Build the flow from these columns (left → right)
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
  'Major Group':     'L2',
  'Category':        'L3',
  'Class-Family':    'L4',
  'Entity-Type':     'L5',
  'Subtype(s)':      'L6'
};

// colors for Major Group (L2)
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

// ---------- helpers ----------
const norm = s => (s ?? '').toString().trim();
const keyFor = (col, val) => `${(COL_TAGS[col] || 'X')}|${norm(val)}`;
const stripPrefix = s => s.replace(/^[A-Z]+?\|/, '');

// ---------- build graph ----------
function buildFromRows(rows) {
  const nodeSet = new Set([ROOT_KEY]);
  const linkMap = new Map(); // "A||B" -> weight

  function addLink(a, b, w = 1) {
    if (!a || !b || a === b) return;
    nodeSet.add(a); nodeSet.add(b);
    const k = a + '||' + b;
    linkMap.set(k, (linkMap.get(k) || 0) + w);
  }

  let used = 0;
  rows.forEach(r => {
    const chain = COLS.map(c => [c, norm(r[c])]).filter(([,v]) => !!v);
    if (!chain.length) return;
    used++;

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

  console.log(`Sankey build: rows used=${used}, nodes=${nodes.length}, links=${links.length}`);
  return { nodes, links };
}

// ---------- propagate Major Group (L2) colors to all nodes + links ----------
function applyGroupColors(nodes, links) {
  const nameToNode = new Map(nodes.map(n => [n.name, n]));
  const parents = new Map();  // child -> Set(parents)
  const children = new Map(); // parent -> Set(children)

  nodes.forEach(n => { parents.set(n.name, new Set()); children.set(n.name, new Set()); });
  links.forEach(l => { parents.get(l.target)?.add(l.source); children.get(l.source)?.add(l.target); });

  // Cache for group color lookup
  const groupColorCache = new Map();

  function colorOfGroupLabel(label) {
    return GROUP_COLORS[label] || DEFAULT_NODE_COLOR;
  }

  function findNearestL2Ancestor(nodeName, seen = new Set()) {
    if (groupColorCache.has(nodeName)) return groupColorCache.get(nodeName);

    // if this node itself is L2|X use that color
    if (nodeName.startsWith('L2|')) {
      const label = stripPrefix(nodeName);
      const color = colorOfGroupLabel(label);
      groupColorCache.set(nodeName, color);
      return color;
    }

    // BFS upstream until we hit any L2
    const q = [nodeName];
    seen.add(nodeName);
    while (q.length) {
      const u = q.shift();
      const ps = parents.get(u) || new Set();
      for (const p of ps) {
        if (p.startsWith('L2|')) {
          const label = stripPrefix(p);
          const color = colorOfGroupLabel(label);
          groupColorCache.set(nodeName, color);
          return color;
        }
        if (!seen.has(p)) { seen.add(p); q.push(p); }
      }
    }
    // nothing found: default
    groupColorCache.set(nodeName, DEFAULT_NODE_COLOR);
    return DEFAULT_NODE_COLOR;
  }

  // assign node colors based on nearest L2 ancestor
  nodes.forEach(n => {
    let color = DEFAULT_NODE_COLOR;
    if (n.name === ROOT_KEY) {
      color = DEFAULT_NODE_COLOR;
    } else if (n.name.startsWith('L2|')) {
      color = colorOfGroupLabel(stripPrefix(n.name));
    } else {
      color = findNearestL2Ancestor(n.name);
    }
    n.itemStyle = { color, borderColor: color };
  });

  // color each link based on the color of its TARGET's major group (or source—choose one).
  // Using target makes downstream flows look consistent by group.
  links.forEach(l => {
    const targetColor =
      nodes.find(n => n.name === l.target)?.itemStyle?.color || DEFAULT_NODE_COLOR;
    l.lineStyle = { color: targetColor, opacity: 0.9 };
  });

  return { nodes, links };
}

// ---------- simple DAG check (defensive) ----------
function assertDAG(nodes, links) {
  const adj = new Map(), indeg = new Map();
  nodes.forEach(n => { adj.set(n.name, []); indeg.set(n.name, 0); });
  links.forEach(l => { adj.get(l.source)?.push(l.target); indeg.set(l.target, (indeg.get(l.target)||0) + 1); });
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

// ---------- rendering ----------
const chart = echarts.init(document.getElementById('chart'));

function render(nodes, links) {
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
      left: 20, top: 10, right: 20, bottom: 10,   // give it more room
      data: nodes,
      links: links,
      // We color links individually, so no global color rule needed here:
      lineStyle: { curveness: 0.5 },
      // Node default (overridden per node above):
      itemStyle: { color: DEFAULT_NODE_COLOR, borderColor: DEFAULT_NODE_COLOR },
      label: {
        color: 'rgba(0,0,0,0.8)',
        fontFamily: 'Arial',
        fontSize: 11,
        formatter: params => stripPrefix(params.name)
      },
      nodeWidth: 24,
      nodeGap: 12,
      layoutIterations: 64,
      emphasis: { focus: 'adjacency' }
    }]
  };

  chart.setOption(option, { notMerge: true, lazyUpdate: false });
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
window.addEventListener('resize', () => chart.resize());

// ---------- load & go ----------
let current = { nodes: [], links: [] };

(async function init() {
  try {
    const rows = await fetch(DATA_URL).then(r => {
      if (!r.ok) throw new Error(`fetch ${DATA_URL} failed: ${r.status}`);
      return r.json();
    });
    if (!Array.isArray(rows)) throw new Error('ihc.json must be a JSON array of row objects.');

    const built = buildFromRows(rows);
    const colored = applyGroupColors(built.nodes, built.links);
    current = colored;
    render(current.nodes, current.links);
  } catch (e) {
    console.error('Init failed:', e);
    // Minimal fallback to verify the chart mounts
    const nodes = [{ name: ROOT_KEY }, { name: 'L2|NHL' }, { name: 'L3|Large B-cell lymphomas (LBCL)' }];
    const links = [
      { source: ROOT_KEY, target: 'L2|NHL', value: 1 },
      { source: 'L2|NHL', target: 'L3|Large B-cell lymphomas (LBCL)', value: 1 }
    ];
    const colored = applyGroupColors(nodes, links);
    render(colored.nodes, colored.links);
  }
})();
