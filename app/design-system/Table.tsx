import * as React from "react";
import styles from "./Table.module.scss";

// Eighth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`/`Select`/`Icon`/`Notification`'s precedent. Replaces
// `bitshares-ui-style-guide`'s `Table` (antd v3), this migration's
// largest component by real API surface so far - grepped every one of
// the 23 real `<Table ...>` JSX call sites (across both direct usage and
// the `Utility/PaginatedList`/`Utility/CollapsibleTable` wrappers nearly
// every other real call site goes through) for actual prop usage rather
// than antd's full `Table` surface. Confirmed unused anywhere in the app
// and deliberately not built: `expandedRowRender`/expandable rows,
// `filters`/`onFilter` (column filter dropdowns), `scroll` (horizontal
// virtual/sticky scrolling), `bordered`/`size`/`showHeader` display
// toggles, and multi-column sort (`sorter` is applied to at most one
// column at a time everywhere in the app).
//
// `column.fixed` ("left"/"right") IS present in real column defs
// (`Blockchain/Asset.tsx`), but accepted here as a typed no-op: antd's
// sticky-fixed-column behavior only activates together with a
// `scroll={{x: ...}}` prop on `Table` itself, which no real call site
// ever sets - so in every real case `fixed` was already visually inert
// under antd too, not a feature this port needs to reproduce.
//
// `rowSelection`/`rowKey`: every real call site combining the two relies
// on antd's actual default `rowKey` behavior (`record.key`, NOT a row
// index - confirmed by reading rc-table's own `TableCell.js`) rather than
// setting an explicit `rowKey` prop, so that default is replicated
// exactly rather than substituting a row-index fallback.
export type SortOrder = "ascend" | "descend";

export interface TableColumn<T = any> {
    key: string;
    dataIndex?: string;
    title?: React.ReactNode;
    render?: (value: any, record: T, index: number) => React.ReactNode;
    sorter?: (a: T, b: T) => number;
    /** Controlled sort indicator/order - takes precedence over clicks
     * whenever present (even if a click would otherwise change it).
     * Matches the one real call site that recomputes this from external
     * state every render (`PredictionMarketDetailsTable.tsx`, via
     * `PaginatedList`'s `header` prop). */
    sortOrder?: SortOrder;
    /** Initial sort order applied on mount only; superseded by the first
     * click on this or another sortable column. */
    defaultSortOrder?: SortOrder;
    align?: "left" | "center" | "right";
    width?: number | string;
    /** Typed for real column defs that set it; a no-op here, see the
     * file header comment. */
    fixed?: "left" | "right";
    className?: string;
}

export interface TablePaginationConfig {
    pageSize?: number;
    defaultPageSize?: number;
    total?: number;
    hideOnSinglePage?: boolean;
    showSizeChanger?: boolean;
    pageSizeOptions?: string[];
    showTotal?: (total: number) => React.ReactNode;
}

export interface TableRowSelection<T = any> {
    type?: "checkbox" | "radio";
    selectedRowKeys?: Array<string | number>;
    onChange?: (
        selectedRowKeys: Array<string | number>,
        selectedRows: T[]
    ) => void;
    /** Per-row props for that row's own selection checkbox - only
     * `disabled` is read (antd's real return shape is wider, but no
     * real call site uses anything else). Real at one call site
     * (`Gateways/GatewaySelectorModal.tsx`, disabling selection for
     * rows whose on-chain config says the service isn't enabled). */
    getCheckboxProps?: (record: T) => {disabled?: boolean};
}

export interface TableSorterInfo {
    columnKey?: string;
    field?: string;
    order?: SortOrder;
}

export interface TableOnChangePagination {
    current: number;
    pageSize: number;
}

export interface TableProps<T = any> {
    columns: TableColumn<T>[];
    dataSource: T[];
    /** Defaults to `"key"`, matching antd's own default (`record.key`),
     * not a row index. */
    rowKey?: string;
    pagination?: TablePaginationConfig | false;
    rowSelection?: TableRowSelection<T> | null;
    rowClassName?: (record: T, index: number) => string;
    className?: string;
    style?: React.CSSProperties;
    locale?: {emptyText?: React.ReactNode};
    footer?: (() => React.ReactNode) | null;
    loading?: boolean;
    onRow?: (
        record: T,
        index: number
    ) => React.HTMLAttributes<HTMLTableRowElement>;
    onHeaderRow?: (
        columns: TableColumn<T>[],
        index: number
    ) => React.HTMLAttributes<HTMLTableRowElement>;
    onChange?: (
        pagination: TableOnChangePagination,
        filters: Record<string, any>,
        sorter: TableSorterInfo
    ) => void;
}

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZE_OPTIONS = ["10", "20", "50", "100"];

function getRowKeyValue<T>(record: T, rowKey: string, index: number) {
    const value = (record as any)?.[rowKey];
    return value !== undefined ? value : index;
}

export function Table<T = any>({
    columns,
    dataSource,
    rowKey = "key",
    pagination,
    rowSelection,
    rowClassName,
    className,
    style,
    locale,
    footer,
    loading,
    onRow,
    onHeaderRow,
    onChange
}: TableProps<T>): JSX.Element {
    const initialSort = React.useRef<{
        columnKey: string;
        order: SortOrder;
    } | null>(null);
    if (initialSort.current === null) {
        const withDefault = columns.find(c => c.defaultSortOrder);
        if (withDefault) {
            initialSort.current = {
                columnKey: withDefault.key,
                order: withDefault.defaultSortOrder as SortOrder
            };
        }
    }

    const [sortState, setSortState] = React.useState(initialSort.current);
    const [page, setPage] = React.useState(1);
    const [pageSizeState, setPageSizeState] = React.useState(
        (pagination && (pagination.pageSize || pagination.defaultPageSize)) ||
            DEFAULT_PAGE_SIZE
    );
    const [internalSelectedKeys, setInternalSelectedKeys] = React.useState<
        Array<string | number>
    >([]);

    const activeSort = columns.reduce<{
        column: TableColumn<T>;
        order: SortOrder;
    } | null>((found, column) => {
        if (found) return found;
        const order =
            column.sortOrder !== undefined
                ? column.sortOrder
                : sortState && sortState.columnKey === column.key
                ? sortState.order
                : undefined;
        return order ? {column, order} : found;
    }, null);

    const sortedRows =
        activeSort && activeSort.column.sorter
            ? (() => {
                  const sorted = [...dataSource].sort(
                      activeSort.column.sorter
                  );
                  return activeSort.order === "descend"
                      ? sorted.reverse()
                      : sorted;
              })()
            : dataSource;

    const paginationEnabled = pagination !== false;
    const effectivePageSize =
        (pagination && pagination.pageSize) || pageSizeState;
    const total =
        pagination && pagination.total !== undefined
            ? pagination.total
            : sortedRows.length;
    const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));
    const currentPage = Math.min(page, pageCount);
    const pagedRows = paginationEnabled
        ? sortedRows.slice(
              (currentPage - 1) * effectivePageSize,
              currentPage * effectivePageSize
          )
        : sortedRows;

    function fireOnChange(nextSort: TableSorterInfo, nextPage: number) {
        if (!onChange) return;
        onChange(
            {current: nextPage, pageSize: effectivePageSize},
            {},
            nextSort
        );
    }

    function handleSortClick(column: TableColumn<T>) {
        if (!column.sorter) return;
        const current =
            sortState && sortState.columnKey === column.key
                ? sortState.order
                : undefined;
        const next: SortOrder | undefined =
            current === "ascend"
                ? "descend"
                : current === "descend"
                ? undefined
                : "ascend";
        setSortState(next ? {columnKey: column.key, order: next} : null);
        setPage(1);
        fireOnChange(
            {columnKey: column.key, field: column.dataIndex, order: next},
            1
        );
    }

    function handlePageChange(nextPage: number) {
        setPage(nextPage);
        fireOnChange(
            sortState
                ? {columnKey: sortState.columnKey, order: sortState.order}
                : {},
            nextPage
        );
    }

    function handlePageSizeChange(nextSize: number) {
        setPageSizeState(nextSize);
        setPage(1);
        if (onChange) {
            onChange(
                {current: 1, pageSize: nextSize},
                {},
                sortState
                    ? {columnKey: sortState.columnKey, order: sortState.order}
                    : {}
            );
        }
    }

    const selectedKeys = rowSelection?.selectedRowKeys ?? internalSelectedKeys;
    const selectionType = rowSelection?.type ?? "checkbox";

    function setSelection(nextKeys: Array<string | number>) {
        if (rowSelection?.selectedRowKeys === undefined) {
            setInternalSelectedKeys(nextKeys);
        }
        const nextRows = dataSource.filter((record, index) =>
            nextKeys.includes(getRowKeyValue(record, rowKey, index))
        );
        rowSelection?.onChange?.(nextKeys, nextRows);
    }

    function toggleRow(key: string | number) {
        if (selectionType === "radio") {
            setSelection([key]);
            return;
        }
        const nextKeys = selectedKeys.includes(key)
            ? selectedKeys.filter(k => k !== key)
            : [...selectedKeys, key];
        setSelection(nextKeys);
    }

    const pageKeys = pagedRows.map((record, index) =>
        getRowKeyValue(record, rowKey, (currentPage - 1) * effectivePageSize + index)
    );
    const allPageSelected =
        pageKeys.length > 0 && pageKeys.every(k => selectedKeys.includes(k));
    const somePageSelected = pageKeys.some(k => selectedKeys.includes(k));

    function toggleAllOnPage() {
        if (allPageSelected) {
            setSelection(selectedKeys.filter(k => !pageKeys.includes(k)));
        } else {
            setSelection([
                ...selectedKeys,
                ...pageKeys.filter(k => !selectedKeys.includes(k))
            ]);
        }
    }

    const pageSizeOptions =
        (pagination && pagination.pageSizeOptions) ||
        DEFAULT_PAGE_SIZE_OPTIONS;
    const showPagination =
        paginationEnabled &&
        !(pagination && pagination.hideOnSinglePage && pageCount <= 1);

    return (
        <div
            className={[styles.wrap, className].filter(Boolean).join(" ")}
            style={style}
        >
            <div className={styles.scroller}>
                <table className={styles.table}>
                    <thead>
                        <tr {...(onHeaderRow ? onHeaderRow(columns, 0) : {})}>
                            {rowSelection ? (
                                <th className={styles.selectionCell}>
                                    {selectionType === "checkbox" ? (
                                        <input
                                            type="checkbox"
                                            aria-label="Select all"
                                            checked={allPageSelected}
                                            ref={el => {
                                                if (el)
                                                    el.indeterminate =
                                                        !allPageSelected &&
                                                        somePageSelected;
                                            }}
                                            onChange={toggleAllOnPage}
                                        />
                                    ) : null}
                                </th>
                            ) : null}
                            {columns.map(column => {
                                const order =
                                    column.sortOrder !== undefined
                                        ? column.sortOrder
                                        : sortState &&
                                          sortState.columnKey === column.key
                                        ? sortState.order
                                        : undefined;
                                return (
                                    <th
                                        key={column.key}
                                        className={[
                                            styles.th,
                                            column.sorter
                                                ? styles.thSortable
                                                : ""
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                        style={{
                                            width: column.width,
                                            textAlign: column.align
                                        }}
                                        onClick={() =>
                                            handleSortClick(column)
                                        }
                                    >
                                        <span className={styles.thContent}>
                                            {column.title}
                                            {column.sorter ? (
                                                <span
                                                    className={
                                                        styles.sortArrows
                                                    }
                                                    aria-hidden="true"
                                                >
                                                    <span
                                                        className={
                                                            order === "ascend"
                                                                ? styles.sortArrowActive
                                                                : ""
                                                        }
                                                    >
                                                        ▲
                                                    </span>
                                                    <span
                                                        className={
                                                            order ===
                                                            "descend"
                                                                ? styles.sortArrowActive
                                                                : ""
                                                        }
                                                    >
                                                        ▼
                                                    </span>
                                                </span>
                                            ) : null}
                                        </span>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {pagedRows.length === 0 ? (
                            <tr>
                                <td
                                    className={styles.empty}
                                    colSpan={
                                        columns.length + (rowSelection ? 1 : 0)
                                    }
                                >
                                    {locale?.emptyText ?? "No data"}
                                </td>
                            </tr>
                        ) : (
                            pagedRows.map((record, rowIndex) => {
                                const absoluteIndex =
                                    (currentPage - 1) * effectivePageSize +
                                    rowIndex;
                                const key = getRowKeyValue(
                                    record,
                                    rowKey,
                                    absoluteIndex
                                );
                                const extraRowProps = onRow
                                    ? onRow(record, absoluteIndex)
                                    : {};
                                return (
                                    <tr
                                        key={key}
                                        className={[
                                            styles.row,
                                            rowClassName
                                                ? rowClassName(
                                                      record,
                                                      absoluteIndex
                                                  )
                                                : ""
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                        {...extraRowProps}
                                    >
                                        {rowSelection ? (
                                            <td
                                                className={
                                                    styles.selectionCell
                                                }
                                            >
                                                <input
                                                    type={
                                                        selectionType ===
                                                        "radio"
                                                            ? "radio"
                                                            : "checkbox"
                                                    }
                                                    aria-label="Select row"
                                                    checked={selectedKeys.includes(
                                                        key
                                                    )}
                                                    disabled={
                                                        rowSelection.getCheckboxProps?.(
                                                            record
                                                        ).disabled
                                                    }
                                                    onChange={() =>
                                                        toggleRow(key)
                                                    }
                                                />
                                            </td>
                                        ) : null}
                                        {columns.map(column => {
                                            const value = column.dataIndex
                                                ? (record as any)[
                                                      column.dataIndex
                                                  ]
                                                : record;
                                            return (
                                                <td
                                                    key={column.key}
                                                    className={[
                                                        styles.td,
                                                        column.className || ""
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" ")}
                                                    style={{
                                                        textAlign:
                                                            column.align
                                                    }}
                                                >
                                                    {column.render
                                                        ? column.render(
                                                              value,
                                                              record,
                                                              absoluteIndex
                                                          )
                                                        : value}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            {footer ? <div className={styles.footer}>{footer()}</div> : null}
            {showPagination ? (
                <div className={styles.pagination}>
                    {pagination && pagination.showTotal ? (
                        <span>{pagination.showTotal(total)}</span>
                    ) : null}
                    {pagination && pagination.showSizeChanger ? (
                        <select
                            className={styles.pageSizeSelect}
                            aria-label="Page size"
                            value={effectivePageSize}
                            onChange={e =>
                                handlePageSizeChange(Number(e.target.value))
                            }
                        >
                            {pageSizeOptions.map(size => (
                                <option key={size} value={size}>
                                    {size} / page
                                </option>
                            ))}
                        </select>
                    ) : null}
                    <button
                        type="button"
                        className={styles.pageButton}
                        disabled={currentPage <= 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                    >
                        ‹
                    </button>
                    <span className={styles.pageIndicator}>
                        {currentPage} / {pageCount}
                    </span>
                    <button
                        type="button"
                        className={styles.pageButton}
                        disabled={currentPage >= pageCount}
                        onClick={() => handlePageChange(currentPage + 1)}
                    >
                        ›
                    </button>
                </div>
            ) : null}
            {loading ? (
                <div className={styles.loadingOverlay}>Loading…</div>
            ) : null}
        </div>
    );
}
