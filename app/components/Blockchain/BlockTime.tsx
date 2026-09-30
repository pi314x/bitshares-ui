// TypeScript/functional-component port of the legacy BlockTime.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: grepped this file for
// `WalletApi`/`WalletDb`/`ApplicationApi`/`.add_type_operation`/
// `process_transaction` - none appear. It only reads a cached block
// header and formats a timestamp.
//
// Structural change (not a behavior change): `connect(Component,
// {listenTo: [BlockchainStore], getProps})` replaced by a thin
// Container using `useAltStore(BlockchainStore)`, computing
// `blockHeader = blockchainState.blockHeaders.get(block_number)`
// directly in the Container's render body - this recomputes on every
// prop change (a plain function re-render) *and* on every
// `BlockchainStore` change (via the hook), a superset of the original's
// `getProps()` (recomputed by alt-react whenever either the wrapped
// component's own props or the store changed).
//
// `UNSAFE_componentWillMount`'s `BlockchainActions.getHeader.defer(...)`
// (fired only if no `blockHeader` is available yet) is replicated as a
// mount-only `useEffect` (`[]` deps) in the Core component - preserving
// the original's quirk of only firing once, on mount, and never again
// even if `block_number` changes on a later prop update (there was no
// `componentWillReceiveProps` re-fetch in the original either).
//
// `shouldComponentUpdate` was a pure boolean performance guard (no side
// effects beyond the gating) comparing `block_number`/`blockHeader` -
// dropped entirely per this migration's convention: a function
// component simply re-renders on every prop/state change, a superset of
// what the guard allowed through, so the rendered output is unchanged.
//
// The `key={block_number}` on the outer `<span>` is preserved verbatim
// even though it's inert here (a `key` prop only matters when React is
// reconciling siblings in a list, not on a single returned element) -
// harmless, so kept rather than silently dropped.
import * as React from "react";
import TimeAgo from "../Utility/TimeAgo";
import counterpart from "counterpart";
import BlockchainActions from "actions/BlockchainActions";
import BlockchainStore from "stores/BlockchainStore";
import {useAltStore} from "../../next/hooks/useAltStore";

interface BlockTimeCoreProps {
    block_number: number;
    blockHeader?: any;
    fullDate?: boolean;
}

function BlockTime({block_number, blockHeader, fullDate}: BlockTimeCoreProps) {
    React.useEffect(() => {
        if (!blockHeader) {
            (BlockchainActions as any).getHeader.defer(block_number);
        }
        // Mount-only: see header comment.
    }, []);

    return (
        <span className="time" key={block_number}>
            {blockHeader ? (
                fullDate ? (
                    counterpart.localize(blockHeader.timestamp, {
                        type: "date",
                        format: "full"
                    })
                ) : (
                    <TimeAgo time={blockHeader.timestamp} />
                )
            ) : null}
        </span>
    );
}

interface BlockTimeContainerProps {
    block_number: number;
    fullDate?: boolean;
}

function BlockTimeContainer({
    block_number,
    fullDate
}: BlockTimeContainerProps) {
    const blockchainState = useAltStore<any>(BlockchainStore);
    const blockHeader = blockchainState.blockHeaders.get(block_number);

    return (
        <BlockTime
            block_number={block_number}
            blockHeader={blockHeader}
            fullDate={fullDate}
        />
    );
}

export default BlockTimeContainer;
