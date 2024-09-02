const data = {
    nodes: [
        { id: "Lymphoid", group: 0 },
        { id: "Lymphoid neoplasms", group: 1 },
        { id: "NHL", group: 2 },
        { id: "Precursor B-cell neoplasm", group: 3 },
        { id: "B-cell lymphoblastic leukemias/lymphomas", group: 4 },
        { id: "B-ALL / LBL,NOS", group: 5 },
        { id: "B-ALL or LBL,NOS", group: 6 },
        // Add more nodes from your table here...
    ],
    links: [
        { source: "Lymphoid", target: "Lymphoid neoplasms" },
        { source: "Lymphoid neoplasms", target: "NHL" },
        { source: "NHL", target: "Precursor B-cell neoplasm" },
        { source: "Precursor B-cell neoplasm", target: "B-cell lymphoblastic leukemias/lymphomas" },
        { source: "B-cell lymphoblastic leukemias/lymphomas", target: "B-ALL / LBL,NOS" },
        { source: "B-ALL / LBL,NOS", target: "B-ALL or LBL,NOS" },
        // Add more links from your table here...
    ]
};
