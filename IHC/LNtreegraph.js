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
            ['Lymphoid Neoplasms', 'LN', 1],
            ['Lymphoid Neoplasms', 'LN-ID', 1],
            ['LN', 'NHL', 2],
            ['LN', 'HL', 2],
            ['LN', 'LPD', 2],
            ['LN', 'HL/NHL', 2],
            ['LN-ID', 'LPD', 2],
            ['LN-ID', 'NHL', 2],
            ['LN-ID', 'HL', 2],
            ['NHL', 'Precursor B-cell neoplasm', 3],
            ['NHL', 'Mature B-cell neoplasms', 3],
            ['HL', 'Mature B-cell neoplasms', 3],
            ['NHL', 'Plasma cell neoplasms and other diseases with paraproteins', 3],
            ['NHL', 'Precursor T-cell neoplasms', 3],
            ['NHL', 'Mature T-cell and NK-cell neoplasms', 3],
            ['LPD', 'Mature T-cell and NK-cell neoplasms', 3],
            ['HL/NHL', 'Mature B-cell neoplasms', 3],
            ['LPD', 'Mature B-LPD', 3],
            ['NHL', 'Mature B-NHL', 3],
            ['HL', 'Precursor B-cell neoplasm', 3],
            ['Precursor B-cell neoplasm', 'Reactive B-cell-rich lymphoid proliferations that can mimic lymphoma', 4],
            ['Precursor B-cell neoplasm', 'IgG4-related disease', 4],
            ['Precursor B-cell neoplasm', 'Unicentric Castleman disease', 4],
            ['Precursor B-cell neoplasm', 'Idiopathic multicentric Castleman disease', 4],
            ['Precursor B-cell neoplasm', 'KSHV/HHV8-associated multicentric Castleman disease', 4],
            ['Precursor B-cell neoplasm', 'B-cell lymphoblastic leukemias/lymphomas', 4],
            ['Mature B-cell neoplasms', 'Pre-neoplastic and neoplastic small lymphocytic proliferations', 4],
            ['Mature B-cell neoplasms', 'Splenic B-cell lymphomas and leukemias', 4],
            ['Mature B-cell neoplasms', 'LPL', 4],
            ['Mature B-cell neoplasms', 'MZL', 4],
            ['Mature B-cell neoplasms', 'FL', 4],
            ['Mature B-cell neoplasms', 'MCL', 4],
            ['Mature B-cell neoplasms', 'Transformation of Indolent B-cell lymphomas', 4],
            ['Mature B-cell neoplasms', 'Large B-cell lymphomas', 4],
            ['Mature B-cell neoplasms', 'BL', 4],
            ['Mature B-cell neoplasms', 'KSHV/HHV8 associated', 4],
            ['Mature B-cell neoplasms', 'LP/LPL-IDD', 4],
            ['Mature B-cell neoplasms', 'LP/LPL-IDD-IEI', 4],
            ['Mature B-cell neoplasms', 'HL', 4],
            ['Plasma cell neoplasms and other diseases with paraproteins', 'Monoclonal gammopathies', 4],
            ['Plasma cell neoplasms and other diseases with paraproteins', 'Diseases with monoclonal Immunoglobulin deposition', 4],
            ['Plasma cell neoplasms and other diseases with paraproteins', 'Heavy chain diseases', 4],
            ['Plasma cell neoplasms and other diseases with paraproteins', 'PCN', 4],
            ['Precursor T-cell neoplasms', 'T-lymphoblastic leukemia/lymphoma', 4],
            ['Mature T-cell and NK-cell neoplasms', 'Mature T-cell and NK-cell leukemias', 4],
            ['Mature T-cell and NK-cell neoplasms', 'CTCL', 4],
            ['Mature T-cell and NK-cell neoplasms', 'Intestinal T-cell and NK-cell lymphoid proliferations and lymphomas', 4],
            ['Mature T-cell and NK-cell neoplasms', 'Hepatosplenic T-cell lymphoma', 4],
            ['Mature T-cell and NK-cell neoplasms', 'ALCL', 4],
            ['Mature T-cell and NK-cell neoplasms', 'nTFHL', 4],
            ['Mature T-cell and NK-cell neoplasms', 'PTCL', 4],
            ['Mature T-cell and NK-cell neoplasms', 'EBV-positive NK/T-cell lymphomas', 4],
            ['Mature T-cell and NK-cell neoplasms', 'EBV positive T- and NK-cell lymphoid proliferations and lymphomas of childhood', 4],
            ['Mature B-LPD', 'PTLD', 4],
            ['Mature B-NHL', 'PTLD', 4],
            ['Mature T-cell and NK-cell neoplasms', 'PTLD', 4],
            ['Precursor B-cell neoplasm', 'PTLD', 4],
            ['Mature B-LPD', 'PID-LPD', 4],
            ['Mature B-NHL', 'PID-LPD', 4],
            ['Mature T-cell and NK-cell neoplasms', 'PID-LPD', 4],
            ['Precursor T-cell neoplasms', 'PID-LPD', 4],
            ['Precursor B-cell neoplasm', 'PID-LPD', 4],
            ['Mature B-LPD', 'HIV-LPD', 4],
            ['Mature B-NHL', 'HIV-LPD', 4],
            ['Mature T-cell and NK-cell neoplasms', 'HIV-LPD', 4],
            ['Precursor B-cell neoplasm', 'HIV-LPD', 4],
            ['Mature B-LPD', 'IAT-LPD', 4],
            ['Mature B-NHL', 'IAT-LPD', 4],
            ['Mature T-cell and NK-cell neoplasms', 'IAT-LPD', 4],
            ['Precursor B-cell neoplasm', 'IAT-LPD', 4],
            
            
            

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
