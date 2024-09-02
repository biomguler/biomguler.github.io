const width = document.getElementById('network').offsetWidth;
const height = document.getElementById('network').offsetHeight;

const svg = d3.select("#network")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const simulation = d3.forceSimulation(data.nodes)
    .force("link", d3.forceLink(data.links).id(d => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-500))
    .force("center", d3.forceCenter(width / 2, height / 2));

const link = svg.append("g")
    .selectAll("line")
    .data(data.links)
    .enter().append("line")
    .attr("stroke-width", 2)
    .attr("stroke", "#999");

const node = svg.append("g")
    .selectAll("circle")
    .data(data.nodes)
    .enter().append("circle")
    .attr("r", 10)
    .attr("fill", d => d.group === 0 ? "#1f77b4" : "#ff7f0e")
    .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

node.append("title")
    .text(d => d.id);

simulation.on("tick", () => {
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
});

function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
}

function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

// Search functionality
document.getElementById("searchBox").addEventListener("input", function() {
    const query = this.value.toLowerCase();
    node.attr("fill", d => d.id.toLowerCase().includes(query) ? "red" : (d.group === 0 ? "#1f77b4" : "#ff7f0e"));
});
