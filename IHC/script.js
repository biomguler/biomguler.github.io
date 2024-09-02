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
    
    // Collapse all children at the beginning
    root.descendants().forEach(d => {
        if (d.depth > 0) d._children = d.children, d.children = null;
    });

    update(root);

    function update(source) {
        const nodes = root.descendants().reverse();
        const links = root.links();

        tree(root);

        // Join data to existing nodes
        const node = svg.selectAll(".node")
            .data(nodes, d => d.id || (d.id = ++i));

        // Enter new nodes at the parent's previous position
        const nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${source.y0},${source.x0})`)
            .on("click", function(event, d) {
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else {
                    d.children = d._children;
                    d._children = null;
                }
                update(d);
            });

        // Add circles to nodes
        nodeEnter.append("circle")
            .attr("r", 5)
            .style("fill", d => d._children ? "lightsteelblue" : "#fff");

        // Add labels to nodes
        nodeEnter.append("text")
            .attr("dy", ".35em")
            .attr("x", d => d.children || d._children ? -10 : 10)
            .attr("text-anchor", d => d.children || d._children ? "end" : "start")
            .text(d => d.data.name);

        // Transition nodes to their new position
        const nodeUpdate = nodeEnter.merge(node).transition()
            .duration(750)
            .attr("transform", d => `translate(${d.y},${d.x})`);

        nodeUpdate.select("circle")
            .attr("r", 10)
            .style("fill", d => d._children ? "lightsteelblue" : "#fff");

        nodeUpdate.select("text")
            .style("fill-opacity", 1);

        // Transition exiting nodes
        const nodeExit = node.exit().transition()
            .duration(750)
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select("circle")
            .attr("r", 1e-6);

        nodeExit.select("text")
            .style("fill-opacity", 1e-6);

        // Update links
        const link = svg.selectAll(".link")
            .data(links, d => d.target.id);

        const linkEnter = link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("d", d => {
                const o = {x: source.x0, y: source.y0};
                return diagonal(o, o);
            });

        linkEnter.merge(link).transition()
            .duration(750)
            .attr("d", d => diagonal(d.source, d.target));

        link.exit().transition()
            .duration(750)
            .attr("d", d => {
                const o = {x: source.x, y: source.y};
                return diagonal(o, o);
            })
            .remove();

        // Store the old positions for transition
        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });

        function diagonal(s, d) {
            return `M${s.y},${s.x}
                    C${(s.y + d.y) / 2},${s.x}
                     ${(s.y + d.y) / 2},${d.x}
                     ${d.y},${d.x}`;
        }
    }

    // Implement search functionality
    document.getElementById("searchBox").addEventListener("input", function() {
        const searchTerm = this.value.toLowerCase();
        svg.selectAll("text").style("fill", d => {
            return d.data.name.toLowerCase().includes(searchTerm) ? "orange" : "#555";
        });
    });
});
