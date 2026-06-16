function initializeDataTable(jsonUrl, tableId, columnsConfig, toggleConfig, options = {}) {
    $(document).ready(function() {
        $.getJSON(jsonUrl, function(data) {
            const table = $(tableId).DataTable({
                data: data,
                paging: options.paging || false,
                scrollY: options.scrollY || 'calc(100vh - 320px)',
                scrollX: true,
                scrollCollapse: true,
                autoWidth: false,
                columns: columnsConfig,
                orderCellsTop: true,
                dom: options.dom || 'Bfrtip',
                buttons: options.buttons || ['copy', 'csv', 'excel', 'pdf', 'print'],
                initComplete: function () {
                    if (typeof options.initComplete === 'function') {
                        options.initComplete.call(this, this.api(), data);
                    }
                }
            });

            for (const [checkboxId, columnIndex] of Object.entries(toggleConfig || {})) {
                $(checkboxId).on('change', function () {
                    table.column(columnIndex).visible(this.checked);
                });
            }

            if (typeof options.onRowClick === 'function') {
                $(`${tableId} tbody`).on('click', 'tr', function () {
                    const rowData = table.row(this).data();
                    if (!rowData) return;
                    $(`${tableId} tbody tr`).removeClass('selected');
                    $(this).addClass('selected');
                    options.onRowClick(rowData, table, this);
                });
            }

            $(window).on('resize', function () {
                const newHeight = window.innerHeight - (options.heightOffset || 320);
                table.settings()[0].oScroll.sY = `${Math.max(newHeight, 320)}px`;
                table.columns.adjust().draw(false);
            });

            if (typeof options.onTableReady === 'function') {
                options.onTableReady(table, data);
            }
        }).fail(function() {
            const colspan = columnsConfig.length;
            $(tableId).find('tbody').html(
                `<tr><td colspan="${colspan}">Data could not be loaded from ${jsonUrl}.</td></tr>`
            );
        });
    });
}
