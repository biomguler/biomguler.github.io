console.log('handleSearch.js is loaded');

function handleSearch() {
    console.log('Search button clicked');
    
    const query = document.getElementById('search-input').value.toLowerCase();
    const chart = Highcharts.charts[0];

    if (!chart) {
        console.error('Chart is not available');
        return;
    }

    if (query) {
        let found = false;
        chart.series[0].points.forEach(function (point) {
            if (point.name.toLowerCase().includes(query)) {
                point.update({
                    color: '#FF0000'
                });
                chart.tooltip.refresh(point);
                found = true;
            } else {
                point.update({
                    color: '#23a6d5'
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
