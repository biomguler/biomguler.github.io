// table.js

// Function to initialize the DataTable
function initializeDataTable(jsonUrl, tableId, columnsConfig, toggleConfig) {
    $(document).ready(function() {
        $.getJSON(jsonUrl, function(data) {
            var table = $(tableId).DataTable({
                data: data,
                scrollCollapse: true,  // Collapse the table if fewer rows
                paging: true,          // Keep pagination
                lengthMenu: [ [10, 25, 50, -1], [10, 25, 50, "All"] ],
                columns: columnsConfig,
                orderCellsTop: true,
                dom: 'lBfrtip',
                buttons: [
                    'copy', 'csv', 'excel', 'pdf', 'print'
                ]
            });

            // Add toggle column functionality
            for (const [checkboxId, columnIndex] of Object.entries(toggleConfig)) {
                $(checkboxId).on('change', function () {
                    table.column(columnIndex).visible(this.checked);
                });
            }
        });
    });
}
