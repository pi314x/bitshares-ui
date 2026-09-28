// TypeScript/functional-component port of the legacy VestingBalance.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(VestingBalance)` HOC (resolving the required `balance`
// prop via `ChainStore.getObject`) is replaced by a small container
// component doing the same resolution directly under `useChainStoreTick()`,
// per this migration's established `BindToChainState` replacement pattern.
import * as React from "react";
import FormattedAsset from "./FormattedAsset";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface VestingBalanceContainerProps {
    balance: string;
    hide_asset?: boolean;
    decimalOffset?: number;
}

interface VestingBalanceProps {
    balance: any;
    hide_asset?: boolean;
    decimalOffset?: number;
}

function VestingBalance({
    balance,
    hide_asset,
    decimalOffset
}: VestingBalanceProps) {
    const amount = Number(balance.getIn(["balance", "amount"]));
    const type = balance.getIn(["balance", "asset_id"]);
    return (
        <FormattedAsset
            hide_asset={hide_asset}
            amount={amount}
            asset={type}
            decimalOffset={decimalOffset || 0}
        />
    );
}

function VestingBalanceContainer({
    balance,
    hide_asset,
    decimalOffset
}: VestingBalanceContainerProps) {
    useChainStoreTick();
    const balanceResolved = balance ? ChainStore.getObject(balance) : balance;

    if (!balanceResolved) {
        return <span />;
    }

    return (
        <VestingBalance
            balance={balanceResolved}
            hide_asset={hide_asset}
            decimalOffset={decimalOffset}
        />
    );
}

export default VestingBalanceContainer;
