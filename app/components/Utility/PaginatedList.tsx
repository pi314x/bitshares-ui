// TypeScript/functional-component port of the legacy PaginatedList.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Preserved verbatim (not "fixed"): the constructor's `pageSize` state is
// computed once from the initial `pageSize` prop and never updated on
// later prop changes - replicated with a `useState` lazy initializer.
// Also preserved: the stray `uns` prop passed to `<Table>` with no value
// (`uns={true}` shorthand) - an inert, harmless leftover the underlying
// `Table` component silently ignores.
import * as React from "react";
import counterpart from "counterpart";
import {Table} from "bitshares-ui-style-guide";
import "./paginated-list.scss";

interface PaginatedListProps {
    rows?: any[];
    pageSize?: number;
    className?: string;
    extraRow?: React.ReactNode;
    style?: React.CSSProperties;
    loading?: boolean;
    totalLabel?: string | {key: string; args?: any};
    label?: string | null;
    header?: any;
    toggleSortOrder?: any;
    rowClassName?: (record: any, index: number) => string;
    rowSelection?: any;
    children?: React.ReactNode;
    [key: string]: any;
}

export default function PaginatedList({
    rows = [],
    pageSize: pageSizeProp = 20,
    extraRow = null,
    style = {paddingBottom: "1rem"},
    loading = false,
    totalLabel = "utility.total_x_items",
    label = null,
    header,
    toggleSortOrder,
    rowClassName,
    rowSelection,
    children
}: PaginatedListProps) {
    const [pageSize] = React.useState(pageSizeProp);

    const pageSizeOptions = [10, 20, 30, 40, 50, 100].filter(
        item => item < Math.max(pageSizeProp, rows.length)
    );
    pageSizeOptions.push(Math.max(pageSizeProp, rows.length));

    let totalColumnsLabel: ((total: number) => string) | null = null;
    if (label !== null) {
        totalColumnsLabel = total => {
            return counterpart.translate(label, {
                count: total
            });
        };
    } else if (typeof totalLabel === "string") {
        totalColumnsLabel = total => {
            return counterpart.translate(totalLabel as string, {
                count: total
            });
        };
    } else if (typeof totalLabel === "object") {
        totalColumnsLabel = total => {
            return counterpart.translate(totalLabel.key, {
                count: total,
                ...totalLabel.args
            });
        };
    }

    return (
        <div className="paginated-list" style={style}>
            <Table
                loading={loading}
                dataSource={rows}
                uns
                columns={Array.isArray(header) ? header : []}
                footer={() => (extraRow ? extraRow : <span>&nbsp;</span>)}
                onChange={toggleSortOrder}
                pagination={{
                    showSizeChanger: true,
                    hideOnSinglePage: false,
                    defaultPageSize: pageSize,
                    pageSizeOptions: pageSizeOptions.map(o => o.toString()),
                    showTotal: (total: number) =>
                        (totalColumnsLabel as (total: number) => string)(total)
                }}
                rowClassName={
                    rowClassName == null
                        ? undefined
                        : (record: any, index: number) =>
                              rowClassName(record, index)
                }
                rowSelection={rowSelection}
            />
            {children}
        </div>
    );
}
