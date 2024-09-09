    function handleSearch() {
        const query = document.getElementById('search-input').value.toLowerCase();

        // Access the chart instance
        const chart = Highcharts.charts[0];  // Assuming it's the first (and only) chart on the page
        
        if (query) {
            // Check if there's a match in the chart's series data
            let found = false;
            chart.series[0].points.forEach(function (point) {
                if (point.name.toLowerCase().includes(query)) {
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
