function handleSearch() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const chart = window.myTreeGraphChart;  // Use the global chart variable

    if (!chart) {
        console.error('Chart is not available');
        return;
    }

    if (query) {
        let found = false;

        // Iterate through the chart points
        chart.series[0].points.forEach(function (point) {
            const pointName = point.options.name ? point.options.name.toLowerCase() : '';  // Safely access the name

            console.log(`Checking point: ${pointName}`);  // Debugging line

            if (pointName.includes(query)) {
                point.update({
                    color: '#FF0000'  // Highlight matching nodes with red color
                });
                chart.tooltip.refresh(point);  // Show tooltip on matched point
                found = true;
            } else {
                point.update({
                    color: '#23a6d5'  // Reset color for non-matching nodes
                });
            }
        });

        if (!found) {
            alert('No match found');
        }
    } else {
        alert('Please enter a search term.');
    }
}
