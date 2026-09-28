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
import * as React from "react";
import ReactDOM from "react-dom";
import {Table} from "bitshares-ui-style-guide";

interface CollapsibleTableProps {
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

    const tableRef = React.useRef<any>(null);

    React.useEffect(() => {
        // This quite ugly way of tracking animation is required to add display: none at the end of the animation
        // otherwise collapsed element will take place on the page at the end of the animation
        // There's no possibility to manipulate with display property on animation directly in CSS
        // eslint-disable-next-line react/no-find-dom-node
        const dom = ReactDOM.findDOMNode(tableRef.current) as Element | null;
        const tbody = dom && dom.querySelector(".ant-table-tbody");
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
            const className = event.target.getAttribute("class");
            if (className && className.includes("ant-checkbox-input")) {
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
        <Table
            ref={tableRef}
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
    );
}
