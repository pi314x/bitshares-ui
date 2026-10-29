// TypeScript/functional-component port of the legacy PendingBlock.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(PendingBlock)` HOC (resolving the `dynGlobalObject`
// prop, default `"2.1.0"`, via `ChainStore.getObject`) is replaced by a
// small container component doing the same resolution directly under
// `useChainStoreTick()`, per this migration's established
// `BindToChainState` replacement pattern.
//
// `shouldComponentUpdate` (Immutable.is comparison on `dynGlobalObject`) is
// a pure equality performance guard - not replicated, per this migration's
// established treatment of pure perf guards.
//
// `<Translate content="operation.pending" .../>` is left unchanged - Phase
// 8's counterpart-shim/webpack-alias approach (see AGENTS.md, "i18n (Phase
// 8)") makes call-site rewrites unnecessary.
import * as React from "react";
import Translate from "react-translate-component";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface PendingBlockContainerProps {
    blockNumber: number;
    dynGlobalObject?: string;
}

interface PendingBlockProps {
    blockNumber: number;
    dynGlobalObject: any;
}

function PendingBlock({blockNumber, dynGlobalObject}: PendingBlockProps) {
    const lastIrreversibleBlockNum = dynGlobalObject.get(
        "last_irreversible_block_num"
    );

    return blockNumber > lastIrreversibleBlockNum ? (
        <span>
            {" - "}(
            <Translate
                content="operation.pending"
                blocks={blockNumber - lastIrreversibleBlockNum}
            />
            )
        </span>
    ) : null;
}

function PendingBlockContainer({
    blockNumber,
    dynGlobalObject = "2.1.0"
}: PendingBlockContainerProps) {
    useChainStoreTick();
    const dynGlobalObjectResolved = ChainStore.getObject(dynGlobalObject);

    if (!dynGlobalObjectResolved) {
        return <span />;
    }

    return (
        <PendingBlock
            blockNumber={blockNumber}
            dynGlobalObject={dynGlobalObjectResolved}
        />
    );
}

export default PendingBlockContainer;
