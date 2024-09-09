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
            ['NHL', 'Precursor B-cell neoplasm'],
            ['Precursor B-cell neoplasm', 'Reactive B-cell-rich lymphoid proliferations that can mimic lymphoma'],
            ['Precursor B-cell neoplasm', 'IgG4-related disease'],
            ['Precursor B-cell neoplasm', 'Unicentric Castleman disease'],
            ['Precursor B-cell neoplasm', 'Idiopathic multicentric Castleman disease'],
            ['Precursor B-cell neoplasm', 'KSHV/HHV8-associated multicentric Castleman disease'],
            ['Precursor B-cell neoplasm', 'B-cell lymphoblastic leukemias/lymphomas'],
            ['B-cell lymphoblastic leukemias/lymphomas', 'B-ALL / LBL,NOS'],
            ['B-ALL / LBL,NOS', 'B-ALL or LBL,NOS', 6],
            ['B-cell lymphoblastic leukemias/lymphomas', 'B-ALL / LBL-RGA (b)'],
            ['B-ALL / LBL-RGA (b)', 'B-ALL with other defined genetic abnormalities', 6],
            ['NHL', 'Mature B-cell neoplasms'],
            ['Mature B-cell neoplasms', 'Splenic B-cell lymphomas and leukemias'],
            ['Splenic B-cell lymphomas and leukemias', 'HCL'],
            ['Splenic B-cell lymphomas and leukemias', 'SMZL'],
            ['Splenic B-cell lymphomas and leukemias', 'SDRPL'],
            ['Splenic B-cell lymphomas and leukemias', 'SBLPN / B-PLL'],
            ['SBLPN / B-PLL', 'SBLPN or B-PLL', 6],
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
