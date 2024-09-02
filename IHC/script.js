// Load data and create the cladogram
d3.json('data.json').then(function(data) {

    const width = 960;
    const height = 600;
    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", "translate(40,0)");

    const tree = d3.tree().size([height, width - 160]);
    const root = d3.hierarchy(data);
    
    tree(root);

    const link = svg.selectAll(".link")
        .data(root.descendants().slice(1))
        .enter().append("path")
        .attr("class", "link")
        .attr("d", d => `
            M${d.y},${d.x}
            C${(d.y + d.parent.y) / 2},${d.x}
             ${(d.y + d.parent.y) / 2},${d.parent.x}
             ${d.parent.y},${d.parent.x}
        `);

    const node = svg.selectAll(".node")
        .data(root.descendants())
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.y},${d.x})`);

    node.append("circle")
        .attr("r", 5)
        .style("fill", d => d.children ? "#555" : "#999")
        .on("click", function(event, d) {
            alert(`More information about ${d.data.name}`);
            // Here you can open a modal or redirect to a detailed information page
        });

    node.append("text")
        .attr("dy", 3)
        .attr("x", d => d.children ? -8 : 8)
        .style("text-anchor", d => d.children ? "end" : "start")
        .text(d => d.data.name);

    // Implement search functionality
    document.getElementById("searchBox").addEventListener("input", function() {
        const searchTerm = this.value.toLowerCase();
        node.selectAll("circle").style("fill", d => {
            return d.data.name.toLowerCase().includes(searchTerm) ? "orange" : (d.children ? "#555" : "#999");
        });
    });
});
