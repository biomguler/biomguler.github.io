// -------- settings: use your real ihc.json --------
const DATA_URL = 'ihc.json';

const COLS = [
  'Major Group',                 // MG
  'WHO-HAEM5 Category',          // C1
  'WHO-HAEM5 Family-Class',      // C2
  'WHO-HAEM5 Entity-Type',       // C3
  'Entity-Type',                 // C4
  'Subtype(s)'                   // SUB
];

// short tags per column (for unique node keys)
const COL_TAGS = {
  'Major Group': 'MG',
  'WHO-HAEM5 Category': 'C1',
  'WHO-HAEM5 Family-Class': 'C2',
  'WHO-HAEM5 Entity-Type': 'C3',
  'Entity-Type': 'C4',
  'Subtype(s)': 'SUB'
};

const GROUP_COLORS = { NHL:'#5470C6', HL:'#EE6666', LPD:'#91CC75', 'PM-LN':'#FAC858', 'ID-LN':'#73C0DE' };
const DEFAULT_NODE_COLOR = '#1f77b4';

const ROOT_LABEL = 'Hematological-lymphoid Neoplasms';
const ROOT_KEY   = 'ROOT|' + ROOT_LABEL;

// ---------- helpers ----------
const norm = s => (s ?? '').toString().trim();

// build a unique key per (column,value)
function keyFor(col, val) {
  const tag = COL_TAGS[col] || 'X';
  return `${tag}|${norm(val)}`;
}
// pretty label from key
function labelFrom(key) { return key.replace(/^[A-Z]+?\|/, ''); }

// ---------- build graph ----------
function buildFromRows(rows) {
  const nodeSet = new Set([ROOT_KEY]);
  const linkMap = new Map(); // "A||B" -> weight

  function addLink(a,b,w=1){
    if (!a || !b) return;
    const k = a + '||' + b;
    nodeSet.add(a); nodeSet.add(b);
    linkMap.set(k, (linkMap.get(k)||0) + w);
  }

  let used = 0;

  rows.forEach(r => {
    const chain = COLS
      .map(c => [c, norm(r[c])])
      .filter(([,v]) => !!v); // keep non-empty

    if (!chain.length) return;
    used++;

    // root → first level
    addLink(ROOT_KEY, keyFor(chain[0][0], chain[0][1]), 1);

    // chain through levels
    for (let i = 0; i < chain.length - 1; i++) {
      const [colA, valA] = chain[i];
      const [colB, valB] = chain[i+1];
      addLink(keyFor(colA,valA), keyFor(colB,valB), 1);
    }
  });

  const nodes = [...nodeSet].map(name => {
    const label = labelFrom(name);
    // color by major-group nodes only (MG|X)
    let color = DEFAULT_NODE_COLOR;
    if (name.startsWith('MG|')) {
      const mg = label;
      color = GROUP_COLORS[mg] || DEFAULT_NODE_COLOR;
    }
    return { 
      name,                      // internal unique id
      value: 1,
      itemStyle: { color, borderColor: color },
      // store the clean label for tooltips if you want:
      __label: label
    };
  });

  const links = [...linkMap.entries()].map(([k,w]) => {
    const [source, target] = k.split('||');
    return { source, target, value: w };
  });

  console.log(`Sankey build: rows used=${used}, nodes=${nodes.length}, links=${links.length}`);
  return { nodes, links };
}

// ---------- rendering ----------
const chart = echarts.init(document.getElementById('chart'));

function render(nodes, links) {
  chart.setOption({
    backgroundColor: '#fff',
    title: { text: 'InterLymph / WHO-HAEM5 — Sankey', subtext: 'from ihc.json', left: 'center' },
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        if (p.dataType === 'edge') {
          // show cleaned labels for edges
          const s = labelFrom(p.data.source);
          const t = labelFrom(p.data.target);
          return `<b>${s}</b> → <b>${t}</b><br/>Rows: <b>${p.data.value}</b>`;
        }
        // node tooltip
        const name = labelFrom(p.data.name);
        return `<b>${name}</b>`;
      }
    },
    series: [{
      type: 'sankey',
      left: 50, top: 20, right: 150, bottom: 25,
      data: nodes,
      links,
      lineStyle: { color: 'source', curveness: 0.5 },
      itemStyle: { color: DEFAULT_NODE_COLOR, borderColor: DEFAULT_NODE_COLOR },
      label: {
        color: 'rgba(0,0,0,0.7)',
        fontFamily: 'Arial',
        fontSize: 10,
        formatter: (params) => labelFrom(params.name) // strip prefixes in labels
      },
      nodeWidth: 22, nodeGap: 10, layoutIterations: 64,
      emphasis: { focus: 'adjacency' }
    }]
  });
  window.addEventListener('resize', () => chart.resize());
}

// ---------- filter + download ----------
function filterGraph(nodes, links, q){
  const query = q.trim().toLowerCase();
  if (!query) return { nodes, links };
  const keep = new Set(nodes
    .filter(n => labelFrom(n.name).toLowerCase().includes(query))
    .map(n => n.name));
  const flinks = links.filter(l => keep.has(l.source) || keep.has(l.target));
  const fnames = new Set(); flinks.forEach(l => { fnames.add(l.source); fnames.add(l.target); });
  return { nodes: nodes.filter(n => fnames.has(n.name)), links: flinks };
}

document.getElementById('filter').addEventListener('input', e => {
  const f = filterGraph(current.nodes, current.links, e.target.value||'');
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

(async function init(){
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
    // tiny fallback to prove the chart mounts
    const nodes = [{name:ROOT_KEY},{name:'MG|NHL'},{name:'C1|Large B-cell lymphomas (LBCL)'}];
    const links = [
      {source:ROOT_KEY, target:'MG|NHL', value:1},
      {source:'MG|NHL', target:'C1|Large B-cell lymphomas (LBCL)', value:1}
    ];
    render(nodes, links);
  }
})();
