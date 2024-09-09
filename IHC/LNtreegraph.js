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
        keys: ['parent', 'id', 'level'],
        clip: false,
        data: [
            [undefined, 'Lymphoid Neoplasms'], 
            ['Lymphoid Neoplasms', 'LN'], 
            ['Lymphoid Neoplasms', 'LN-ID'], 
            ['LN', 'NHL'],
            ['LN', 'HL'],
            ['LN', 'LPD'],
            ['LN', 'HL/NHL'],
            ['LN-ID', 'NHL'],
            ['LN-ID', 'HL'],
            ['LN-ID', 'LPD'],
            ['NHL', 'Precursor B-cell neoplasm']
            ['NHL', 'Mature B-cell neoplasms'], 
            ['Mature B-cell neoplasms', 'Splenic B-cell lymphomas and leukemias'],
            ['Splenic B-cell lymphomas and leukemias', 'HCL', 6],
            ['Splenic B-cell lymphomas and leukemias', 'SMZL', 6],
            // Add more data rows as needed...
        ],
        marker: {
            symbol: 'circle',
            radius: 6,
            fillColor: '#ffffff',
            lineWidth: 3
        },
        dataLabels: {
            align: 'left',
            pointFormat: '{point.id}',
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
