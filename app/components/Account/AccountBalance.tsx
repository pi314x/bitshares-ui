// TypeScript/functional-component port of the legacy AccountBalance.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(AccountBalance)` HOC (resolving the two required
// props `account`/`asset` via `ChainStore.getAccount`/`getAsset`) is
// replaced by a Container doing the same resolution directly under
// `useChainStoreTick()`, per this migration's established pattern.
//
//  Given a balance_object, displays it in a pretty way
//
//  Expects one property, 'balance' which should be a balance_object id
import * as React from "react";
import AssetName from "../Utility/AssetName";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import BalanceComponent from "../Utility/BalanceComponent";

interface AccountBalanceProps {
    account: string;
    asset: string;
    replace?: any;
}

interface AccountBalanceCoreProps {
    account: any;
    asset: any;
    replace?: any;
}

function AccountBalance({account, asset, replace}: AccountBalanceCoreProps) {
    const asset_id = asset.get("id");
    const balance_id = account.getIn(["balances", asset_id]);

    if (balance_id) return <BalanceComponent balance={balance_id} replace={replace} />;
    else
        return (
            <span>
                0&nbsp;
                <AssetName name={asset.get("symbol")} replace={replace} />
            </span>
        );
}

function AccountBalanceContainer({account, asset, replace}: AccountBalanceProps) {
    useChainStoreTick();
    const resolvedAccount = (ChainStore as any).getAccount(account, false);
    const resolvedAsset = ChainStore.getAsset(asset);

    if (!resolvedAccount || !resolvedAsset) {
        return <span />;
    }

    return (
        <AccountBalance
            account={resolvedAccount}
            asset={resolvedAsset}
            replace={replace}
        />
    );
}

export default AccountBalanceContainer;
