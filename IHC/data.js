const data = {
    nodes: [
        { "id": "root" },
        { "id": "Lymphoid" },
        { "id": "Lymphoid neoplasms" },
        { "id": "NHL" },
        { "id": "Precursor B-cell neoplasm" },
        { "id": "B-cell lymphoblastic leukemias/lymphomas" },
        { "id": "B-ALL / LBL,NOS" },
        { "id": "B-ALL or LBL,NOS" },
        { "id": "B-ALL / LBL-RGA (b)" },
        { "id": "B-ALL with other defined genetic abnormalities (examples)" },
        { "id": "Mature B-cell neoplasms" },
        { "id": "MZL" },
        { "id": "EMZL" },
        { "id": "EMZL-type, MALT (e)" },
        // Add more nodes as needed...
    ],
    links: [
        { "source": "root", "target": "Lymphoid" },
        { "source": "Lymphoid", "target": "Lymphoid neoplasms" },
        { "source": "Lymphoid neoplasms", "target": "NHL" },
        { "source": "NHL", "target": "Precursor B-cell neoplasm" },
        { "source": "Precursor B-cell neoplasm", "target": "B-cell lymphoblastic leukemias/lymphomas" },
        { "source": "B-cell lymphoblastic leukemias/lymphomas", "target": "B-ALL / LBL,NOS" },
        { "source": "B-ALL / LBL,NOS", "target": "B-ALL or LBL,NOS" },
        { "source": "B-cell lymphoblastic leukemias/lymphomas", "target": "B-ALL / LBL-RGA (b)" },
        { "source": "B-ALL / LBL-RGA (b)", "target": "B-ALL with other defined genetic abnormalities (examples)" },
        { "source": "NHL", "target": "Mature B-cell neoplasms" },
        { "source": "Mature B-cell neoplasms", "target": "MZL" },
        { "source": "MZL", "target": "EMZL" },
        { "source": "EMZL", "target": "EMZL-type, MALT (e)" },
        // Add more links as needed...
    ]
};
