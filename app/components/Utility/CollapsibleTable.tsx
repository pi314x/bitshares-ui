// TypeScript/functional-component port of the legacy CollapsibleTable.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `componentDidMount`'s `ReactDOM.findDOMNode(this)` (locating the
// `.ant-table-tbody` element to attach animation-end listeners) is
// replicated by attaching a ref to the rendered `<Table>` and calling
// `findDOMNode` on that ref's current value instead of `this`. The
// `onAnimationEnd` handler needs to read the *current* `isCollapsed`
// value whenever it fires (not the value at mount time, since the
// mount-only effect's closure would otherwise capture a stale snapshot)
// - replicated with a ref kept in sync with the `isCollapsed` state on
// every render, read from inside the handler.
//
// Preserved verbatim (not "fixed"): the animation-end listeners are never
// removed (no `componentWillUnmount` cleanup in the original either) - a
// pre-existing listener leak, not introduced by this port.
//
// UPDATE (call-site migration, docs/UI_MIGRATION_PLAN.md §7.1): moved
// off `bitshares-ui-style-guide`'s `Table` onto the design-system one -
// this file was deferred on that move until now, since its whole
// collapse animation targets antd's own internal classnames
// (`.ant-table-tbody` etc.), which the design-system `Table` - built
// from scratch with scoped CSS Modules - never emits. Fixed by adding
// stable, un-hashed classname hooks to `Table.tsx` itself (`ds-table-
// thead`/`-tbody`/`-footer`/`-pagination`) purpose-built for this file,
// and by wrapping `<Table>` in a plain `<div ref={wrapperRef}>` instead
// of passing a `ref` into `Table` directly - the design-system `Table`
// is a plain function component, not `forwardRef`, so it can't accept
// one. That wrapper div is a real DOM node on mount, so the original's
// `ReactDOM.findDOMNode(tableRef.current)` indirection (needed only
// because the original ref pointed at a class-component instance, not a
// DOM node) is no longer needed and is dropped along with the import -
// `wrapperRef.current` already *is* the DOM node. `_collapsible_table
// .scss`'s selectors were updated to match (`.ds-table-tbody` etc.).
// The header-row click guard (skip toggling collapse when the row-
// selection "select all" checkbox is clicked - real at `Account/
// AccountOrders.tsx`'s `rowSelection` usage) checked the clicked
// element's class for antd's `ant-checkbox-input` - the design-system
// `Table`'s own select-all checkbox is a bare native `<input>` with no
// such class, so the guard now checks the tag name instead
// (`event.target.tagName === "INPUT"`), equivalent for every real
// case (the only other clickable elements in the header row are column
// headers themselves, never `<input>`s).
import * as React from "react";
import {Table} from "../../design-system/Table";

interface CollapsibleTableProps {
    // `columns`/`dataSource` are declared explicitly (not left to the
    // catch-all index signature below) so TS knows `{...rest}` spread
    // onto the design-system `Table` below actually includes its
    // required props - every real caller already passes both. Kept
    // `any` rather than `any[]`: `Account/AccountOrders.tsx`'s own
    // `getColumns()` has a pre-existing inferred return type TS widens
    // beyond a plain array in one branch, unrelated to this port.
    columns: any;
    dataSource: any;
    isCollapsed?: boolean;
    onHeaderRow?: (column: any, index: number) => any;
    [key: string]: any;
}

export default function CollapsibleTable({
    isCollapsed: isCollapsedProp,
    onHeaderRow: innerOnHeaderRow,
    ...rest
}: CollapsibleTableProps) {
    const [isCollapsed, setIsCollapsed] = React.useState(
        isCollapsedProp || false
    );
    const [
        isCollapseAnimationCompleted,
        setIsCollapseAnimationCompleted
    ] = React.useState(isCollapsedProp || false);

    const isCollapsedRef = React.useRef(isCollapsed);
    isCollapsedRef.current = isCollapsed;

    const wrapperRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        // This quite ugly way of tracking animation is required to add display: none at the end of the animation
        // otherwise collapsed element will take place on the page at the end of the animation
        // There's no possibility to manipulate with display property on animation directly in CSS
        const tbody = wrapperRef.current?.querySelector(".ds-table-tbody");
        if (!tbody) return;

        const onAnimationEnd = () => {
            setIsCollapseAnimationCompleted(isCollapsedRef.current);
        };

        tbody.addEventListener("animationend", onAnimationEnd);
        tbody.addEventListener("webkitAnimationEnd", onAnimationEnd);
        tbody.addEventListener("oAnimationEnd", onAnimationEnd);
        tbody.addEventListener("MSAnimationEnd", onAnimationEnd);
    }, []);

    // Create a wrapper which allows to call externally passed onClick function after execution of our one, preserving all the other handlers intact
    const onHeaderRow = (column: any, index: number) => {
        let handlers: any = {};

        if (innerOnHeaderRow) {
            const innerHandlers = innerOnHeaderRow(column, index);
            handlers = innerHandlers;
        }

        handlers.onClick = (event: any) => {
            // Do nothing if selectable column is clicked
            if (event.target.tagName === "INPUT") {
                return;
            }

            setIsCollapsed(!isCollapsed);
            setIsCollapseAnimationCompleted(false);

            if (innerOnHeaderRow) {
                const innerHandlers = innerOnHeaderRow(column, index);
                if (innerHandlers.onClick) {
                    innerHandlers.onClick(event);
                }
            }
        };

        return handlers;
    };

    return (
        <div ref={wrapperRef}>
            <Table
                {...rest}
                onHeaderRow={onHeaderRow}
                className={`collapsible-table ${
                    isCollapsed
                        ? "collapsible-table-collapsed"
                        : "collapsible-table-uncollapsed"
                }
                ${
                    isCollapseAnimationCompleted
                        ? "collapsible-table-collapsed-animation-completed"
                        : null
                }`}
            />
        </div>
    );
}
