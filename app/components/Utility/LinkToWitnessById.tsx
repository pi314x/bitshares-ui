// TypeScript/functional-component port of the legacy LinkToWitnessById.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(LinkToWitnessById)` HOC (resolving the required
// `witness` prop via `ChainStore.getObject`) is replaced by a small
// container component doing the same resolution directly under
// `useChainStoreTick()`, per this migration's established
// `BindToChainState` replacement pattern.
import * as React from "react";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import LinkToAccountById from "./LinkToAccountById";

interface LinkToWitnessByIdProps {
    witness: string;
}

function LinkToWitnessByIdContainer({witness}: LinkToWitnessByIdProps) {
    useChainStoreTick();
    const witnessObject = witness ? ChainStore.getObject(witness) : witness;

    if (!witnessObject) {
        return <span />;
    }

    const witness_account = witnessObject.get("witness_account");
    return <LinkToAccountById account={witness_account} />;
}

export default LinkToWitnessByIdContainer;
