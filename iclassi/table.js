// table.js

// Function to initialize the DataTable
function initializeDataTable(jsonUrl, tableId, columnsConfig, toggleConfig) {
    $(document).ready(function() {
        $.getJSON(jsonUrl, function(data) {
            var table = $(tableId).DataTable({
                data: data,
                paging: false, // disable pagination
                scrollY: 'calc(100vh - 250px)', // adjust offset for header/footer
                scrollCollapse: true,
                autoWidth: true,
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

            // Recalculate scroll height if the window is resized
            $(window).on('resize', function () {
                var newHeight = window.innerHeight - 250; // adjust offset
                table.settings()[0].oScroll.sY = newHeight + 'px';
                table.draw(false);
            });
        });
    });
}
