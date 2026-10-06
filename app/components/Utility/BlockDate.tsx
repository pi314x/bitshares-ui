// TypeScript/functional-component port of the legacy BlockDate.jsx (Phase
// 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's
// `connect(BlockDate, {listenTo, getProps})` alt-react HOC is replaced by
// `useAltStore(BlockchainStore)`, per this migration's established
// Alt.js-store adapter pattern (see app/next/hooks/useAltStore.ts).
//
// The default `format` (`"market_history_us"` vs `"market_history"` based
// on `browser-locale`) was a `static defaultProps` value, computed once at
// class-definition time - replicated as a module-scope constant computed
// once at import time (not recomputed per render).
//
// `UNSAFE_componentWillMount`'s "fetch header if missing" call is
// replicated with a mount-only `useEffect` (empty dependency array,
// matching the original's mount-only, not prop-update-reactive, timing).
//
// `shouldComponentUpdate` is NOT a pure perf guard here - it has a real
// side effect (`setTimeout(ReactTooltip.rebuild, 1000)` when `blockHeader`
// transitions from falsy to truthy) - replicated with a `useEffect` keyed
// on `blockHeader`, comparing against the previous value via a ref.
import * as React from "react";
import counterpart from "counterpart";
import BlockchainStore from "stores/BlockchainStore";
import BlockchainActions from "actions/BlockchainActions";
import ReactTooltip from "react-tooltip";
import getLocale from "browser-locale";
import {Tooltip} from "../../design-system/Tooltip";
import {useAltStore} from "../../next/hooks/useAltStore";

const DEFAULT_FORMAT =
    getLocale()
        .toLowerCase()
        .indexOf("en-us") !== -1
        ? "market_history_us"
        : "market_history";

interface BlockDateContainerProps {
    block_number: number;
    format?: string;
    tooltip?: boolean;
    component?: string;
}

interface BlockDateProps {
    blockHeader: any;
    format: string;
    tooltip: boolean;
    component: string;
}

function BlockDate({
    blockHeader,
    tooltip,
    component,
    format
}: BlockDateProps) {
    const prevBlockHeaderRef = React.useRef(blockHeader);
    React.useEffect(() => {
        if (blockHeader && !prevBlockHeaderRef.current) {
            setTimeout(ReactTooltip.rebuild, 1000);
        }
        prevBlockHeaderRef.current = blockHeader;
    }, [blockHeader]);

    if (!blockHeader) return React.createElement(component);
    return React.createElement(
        component,
        {
            className: tooltip ? "tooltip" : ""
        },
        <Tooltip
            title={tooltip ? blockHeader.timestamp.toString() : ""}
            placement="left"
        >
            <span>
                {counterpart.localize(blockHeader.timestamp, {
                    type: "date",
                    format
                })}
            </span>
        </Tooltip>
    );
}

function BlockDateContainer({
    block_number,
    format = DEFAULT_FORMAT,
    tooltip = false,
    component = "span"
}: BlockDateContainerProps) {
    const blockchainState = useAltStore<any>(BlockchainStore);
    const blockHeader = blockchainState.blockHeaders.get(block_number);

    React.useEffect(() => {
        if (!blockHeader) {
            BlockchainActions.getHeader.defer(block_number);
        }
    }, []);

    return (
        <BlockDate
            blockHeader={blockHeader}
            format={format}
            tooltip={tooltip}
            component={component}
        />
    );
}

export default BlockDateContainer;
