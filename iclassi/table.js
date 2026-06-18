function initializeDataTable(jsonUrl, tableId, columnsConfig, toggleConfig, options = {}) {
    $(document).ready(function() {
        $.getJSON(jsonUrl, function(data) {
            const tableData = typeof options.filterData === 'function'
                ? data.filter(options.filterData)
                : data;
            const table = $(tableId).DataTable({
                data: tableData,
                paging: options.paging || false,
                scrollY: options.scrollY || 'calc(100vh - 320px)',
                scrollX: options.scrollX !== undefined ? options.scrollX : false,
                scrollCollapse: true,
                autoWidth: false,
                columns: columnsConfig,
                orderCellsTop: true,
                dom: options.dom || 'Bfrtip',
                buttons: options.buttons || ['copy', 'csv', 'excel', 'pdf', 'print'],
                initComplete: function () {
                    if (typeof options.initComplete === 'function') {
                        options.initComplete.call(this, this.api(), tableData);
                    }
                }
            });

            for (const [checkboxId, columnIndex] of Object.entries(toggleConfig || {})) {
                $(checkboxId).on('change', function () {
                    table.column(columnIndex).visible(this.checked);
                    syncTopHorizontalScrollbar(table);
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
                syncTopHorizontalScrollbar(table);
            });

            attachTopHorizontalScrollbar(table);

            if (typeof options.onTableReady === 'function') {
                options.onTableReady(table, tableData);
            }
        }).fail(function() {
            const colspan = columnsConfig.length;
            $(tableId).find('tbody').html(
                `<tr><td colspan="${colspan}">Data could not be loaded from ${jsonUrl}.</td></tr>`
            );
        });
    });
}

function attachTopHorizontalScrollbar(table) {
    const wrapper = $(table.table().container());
    const scrollContainer = wrapper.find('.dataTables_scroll');
    const scrollBody = wrapper.find('.dataTables_scrollBody');
    if (!scrollContainer.length || !scrollBody.length || wrapper.find('.table-top-scroll').length) {
        return;
    }

    const topScroll = $('<div class="table-top-scroll" aria-hidden="true"><div></div></div>');
    scrollContainer.prepend(topScroll);

    let syncing = false;
    topScroll.on('scroll', function () {
        if (syncing) return;
        syncing = true;
        scrollBody.scrollLeft(topScroll.scrollLeft());
        syncing = false;
    });
    scrollBody.on('scroll', function () {
        if (syncing) return;
        syncing = true;
        topScroll.scrollLeft(scrollBody.scrollLeft());
        syncing = false;
    });

    table.on('draw column-sizing column-visibility', function () {
        syncTopHorizontalScrollbar(table);
    });
    setTimeout(function () {
        syncTopHorizontalScrollbar(table);
    }, 0);
}

function syncTopHorizontalScrollbar(table) {
    const wrapper = $(table.table().container());
    const topScroll = wrapper.find('.table-top-scroll');
    const scrollBody = wrapper.find('.dataTables_scrollBody');
    const tableElement = scrollBody.find('table');
    if (!topScroll.length || !scrollBody.length || !tableElement.length) {
        return;
    }
    const tableWidth = tableElement.outerWidth();
    const bodyWidth = scrollBody.innerWidth();
    topScroll.toggleClass('is-hidden', tableWidth <= bodyWidth + 1);
    topScroll.children('div').width(tableWidth);
    topScroll.scrollLeft(scrollBody.scrollLeft());
}
