// Sample data for treegraph (Include names for filtering)
const data = [
    [undefined, 'LN', 'Lymphoid Neoplasms'], 
    ['LN', 'NHL', 'Non-Hodgkin Lymphoma'], 
    ['NHL', 'Precursor B-cell neoplasm', 'Precursor B-cell neoplasm'], 
    ['Precursor B-cell neoplasm', 'B-cell lymphoblastic leukemias/lymphomas', 'B-cell lymphoblastic leukemias'],
    ['B-cell lymphoblastic leukemias/lymphomas', 'B-ALL / LBL, NOS', 'B-ALL / LBL, NOS'],
    ['B-ALL / LBL, NOS', 'B-ALL or LBL, NOS', 6],
    ['NHL', 'Mature B-cell neoplasms', 'Mature B-cell neoplasms'], 
    ['Mature B-cell neoplasms', 'Splenic B-cell lymphomas and leukemias', 'Splenic B-cell lymphomas'],
    ['Splenic B-cell lymphomas and leukemias', 'HCL', 'Hairy Cell Leukemia'],
    ['Splenic B-cell lymphomas and leukemias', 'SMZL', 'Splenic Marginal Zone Lymphoma'],
    // Add more data rows as needed...
];

// Function to filter data based on search input
function filterData(searchTerm) {
    return data.filter(node => {
        const nodeName = node[2] ? node[2].toLowerCase() : '';  // Use the name for filtering
        return nodeName.includes(searchTerm.toLowerCase());
    });
}

// Function to update the chart with filtered data
function updateChart(filteredData) {
    window.myTreeGraphChart.series[0].setData(filteredData);
}

// Create the chart and store it in a global variable
window.myTreeGraphChart = Highcharts.chart('container', {
    chart: {
        spacingBottom: 30,
        marginRight: 120,
        height: 600
    },
    title: {
        text: 'LN Hierarchical Classification'
    },
    series: [{
        type: 'treegraph',
        keys: ['parent', 'id', 'name', 'level'],
        clip: false,
        data: data,
        marker: {
            symbol: 'circle',
            radius: 6,
            fillColor: '#ffffff',
            lineWidth: 3
        },
        dataLabels: {
            align: 'left',
            format: '{point.name}',  // Use the name in the data labels
            style: {
                color: '#000000',
                textOutline: '3px #ffffff',
                whiteSpace: 'nowrap'
            },
            x: 24,
            crop: false,
            overflow: 'none'
        },
        levels: [
            {
                level: 1,
                levelIsConstant: false
            },
            {
                level: 2,
                colorByPoint: true
            },
            {
                level: 3,
                colorVariation: {
                    key: 'brightness',
                    to: -0.5
                }
            },
            {
                level: 4,
                colorVariation: {
                    key: 'brightness',
                    to: 0.5
                }
            },
            {
                level: 6,
                dataLabels: {
                    x: 10
                },
                marker: {
                    radius: 4
                }
            }
        ]
    }]
});

// Event listener for the search input
document.getElementById('search-input').addEventListener('input', function() {
    const searchTerm = this.value;
    const filteredData = filterData(searchTerm);
    updateChart(filteredData);
});
