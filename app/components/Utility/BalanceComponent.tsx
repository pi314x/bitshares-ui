// TypeScript/functional-component port of the legacy BalanceComponent.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(BalanceComponent)` HOC wrapping (resolving the
// required `balance` prop via `ChainStore.getObject`) is replaced by a
// small container component doing the same resolution directly under
// `useChainStoreTick()`, per this migration's established
// `BindToChainState` replacement pattern. `balance` is `.isRequired` in
// the original propTypes, so `BindToChainState` gated rendering behind a
// loading fallback until it resolved - replicated here the same way.
import * as React from "react";
import FormattedAsset from "./FormattedAsset";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface BalanceComponentProps {
    balance?: any;
    assetInfo?: React.ReactNode;
    hide_asset?: boolean;
    trimZero?: boolean;
    asPercentage?: any;
    replace?: any;
}

function BalanceComponent({
    balance,
    assetInfo,
    hide_asset = false,
    trimZero = false,
    asPercentage,
    replace
}: BalanceComponentProps) {
    if (!balance || !balance.toJS) {
        return null;
    }
    let amount: any = balance.get("balance");
    if (amount || amount == 0) {
        amount = Number(balance.get("balance"));
    } else {
        amount = null;
    }
    const type = balance.get("asset_type");
    return (
        <FormattedAsset
            amount={amount}
            asset={type}
            asPercentage={asPercentage}
            assetInfo={assetInfo}
            replace={replace}
            hide_asset={hide_asset}
            trimZero={trimZero}
        />
    );
}

function BalanceComponentContainer(props: BalanceComponentProps) {
    useChainStoreTick();
    const balance = props.balance
        ? ChainStore.getObject(props.balance)
        : props.balance;

    if (!balance) {
        return <span />;
    }

    return <BalanceComponent {...props} balance={balance} />;
}

export default BalanceComponentContainer;
