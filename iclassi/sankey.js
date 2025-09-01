// -------- settings: use your real ihc.json --------
const DATA_URL = 'ihc.json';  // place this HTML next to ihc.json on GitHub Pages

// Build the flow from these columns (left → right)
// (using your exact hyphenated keys)
const COLS = [
  'Major Group',                 // NHL / HL / LPD / PM-LN / ID-LN ...
  'WHO-HAEM5 Category',
  'WHO-HAEM5 Family-Class',
  'WHO-HAEM5 Entity-Type',
  'Entity-Type',                 // Interlymph entity/type
  'Subtype(s)'                   // optional deepest level
];

// Optional colors for top buckets; everything else uses default
const GROUP_COLORS = { NHL:'#5470C6', HL:'#EE6666', LPD:'#91CC75', 'PM-LN':'#FAC858', 'ID-LN':'#73C0DE' };
const DEFAULT_NODE_COLOR = '#1f77b4';
const ROOT = 'Hematological-lymphoid Neoplasms';

// ---------- helpers ----------
const norm = s => (s ?? '').toString().trim();

function buildFromRows(rows) {
  const nodeSet = new Set([ROOT]);
  const linkMap = new Map();  // "A||B" -> weight

  function addLink(a,b,w=1){
    a = norm(a); b = norm(b);
    if (!a || !b) return;
    nodeSet.add(a); nodeSet.add(b);
    const k = a+'||'+b;
    linkMap.set(k, (linkMap.get(k)||0) + w);
  }

  rows.forEach(r => {
    const chain = COLS.map(c => norm(r[c])).filter(Boolean);
    if (!chain.length) return;
    // root → first level
    addLink(ROOT, chain[0], 1);
    // chain links
    for (let i=0;i<chain.length-1;i++) addLink(chain[i], chain[i+1], 1);
  });

  const nodes = [...nodeSet].map(name => ({ name }));
  const links = [...linkMap.entries()].map(([k,w]) => {
    const [source, target] = k.split('||');
    return { source, target, value: w };
  });
  return { nodes, links };
}

function colorForNode(name){
  return GROUP_COLORS[name] || DEFAULT_NODE_COLOR;
}

function themeNodes(nodes){
  return nodes.map(n => {
    const c = colorForNode(n.name);
    return { ...n, itemStyle: { color: c, borderColor: c } };
  });
}

// ---------- rendering ----------
const chart = echarts.init(document.getElementById('chart'));

function render(nodes, links){
  const themed = themeNodes(nodes);
  chart.setOption({
    backgroundColor: '#fff',
    title: { text: 'InterLymph / WHO-HAEM5 — Sankey', subtext: 'from ihc.json', left: 'center' },
    tooltip: { trigger: 'item' },
    series: [{
      type: 'sankey',
      left: 50, top: 20, right: 150, bottom: 25,
      data: themed,
      links,
      lineStyle: { color: 'source', curveness: 0.5 },
      itemStyle: { color: DEFAULT_NODE_COLOR, borderColor: DEFAULT_NODE_COLOR },
      label: { color: 'rgba(0,0,0,0.7)', fontFamily: 'Arial', fontSize: 10 },
      nodeWidth: 22, nodeGap: 10, layoutIterations: 64,
      emphasis: { focus: 'adjacency' }
    }]
  });
}

// ---------- filter + download ----------
function filterGraph(nodes, links, q){
  const query = q.trim().toLowerCase();
  if (!query) return { nodes, links };
  const keep = new Set(nodes.filter(n => n.name.toLowerCase().includes(query)).map(n => n.name));
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
window.addEventListener('resize', () => chart.resize());

// ---------- load & go ----------
let current = { nodes: [], links: [] };

(async function init(){
  // GitHub Pages: keep ihc.json next to this HTML
  const rows = await fetch(DATA_URL).then(r => r.json());
  current = buildFromRows(rows);
  render(current.nodes, current.links);
})();
