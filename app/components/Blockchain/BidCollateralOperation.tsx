// TypeScript/functional-component port of the legacy
// BidCollateralOperation.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Non-security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `ApplicationApi`, `.add_type_operation`, `process_transaction`
// - none appear. `_onBidCollateral`/`removeBid` only call
// `AssetActions.bidCollateral(...)` (a flux action creator dispatching to
// `AssetStore`, which - out of scope for this file - itself builds/signs
// the real transaction) and are otherwise identical to any other
// non-sensitive display/dispatch component in this migration.
//
// A plain class (no `BindToChainState`), wrapped only in the unchanged,
// out-of-scope `AssetWrapper(Component, {propNames: ["asset", "core"],
// withDynamic: true})` HOC - kept as-is around the new functional
// component, same as `SettleModal.tsx`'s treatment of the identical HOC.
//
// `initialState()`/`reset()` (recomputing `account` from the current
// `funderAccountName` prop via `ChainStore.getAccount`) becomes a plain
// closure read directly off `props` on each call, matching the original's
// own `this.props` read (not stale, since a fresh closure is created per
// render). `_collateralBidInput`/`_debtBidInput`/`_onBidCollateral`
// become plain closures using a local `mergeState` helper for the two
// partial-state updates the original does via `setState({...})` with a
// single key. `funderAccountName`/`core`/`asset`/`onUpdate` are the only
// props ever read (grep-verified); the real caller (`Asset.tsx`'s
// `renderCollateralBid`) also passes `hideBalance`, which - exactly as in
// the original - is accepted but never read anywhere in this component.
//
// Dropped as confirmed dead (grepped): `removeBid()` - fully defined
// (identical body to `_onBidCollateral` but with hard-coded `0, 0`
// amounts), never called anywhere in the file - not bound to any button,
// not referenced anywhere else.
import React from "react";
import classnames from "classnames";
import Translate from "react-translate-component";
import FormattedPrice from "../Utility/FormattedPrice";
import AmountSelector from "../Utility/AmountSelector";
import FormattedAsset from "../Utility/FormattedAsset";
import AssetActions from "actions/AssetActions";
import AssetWrapper from "../Utility/AssetWrapper";
import {ChainStore} from "bitsharesjs";

interface BidCollateralOperationProps {
    asset: any;
    core: any;
    funderAccountName: any;
    onUpdate: () => void;
    [key: string]: any;
}

interface BidCollateralOperationState {
    account: any;
    collateralAmount: string;
    debtAmount: string;
}

function initialState(
    props: BidCollateralOperationProps
): BidCollateralOperationState {
    return {
        account: (ChainStore as any).getAccount(props.funderAccountName),
        collateralAmount: "0",
        debtAmount: "0"
    };
}

function BidCollateralOperation(props: BidCollateralOperationProps) {
    const {asset, core, onUpdate} = props;

    const [state, setState] = React.useState<BidCollateralOperationState>(
        () => initialState(props)
    );

    const mergeState = (patch: Partial<BidCollateralOperationState>) => {
        setState(prev => ({...prev, ...patch}));
    };

    const reset = () => {
        setState(initialState(props));
    };

    const collateralBidInput = (value: any) => {
        mergeState({collateralAmount: value.amount});
    };

    const debtBidInput = (value: any) => {
        mergeState({debtAmount: value.amount});
    };

    const onBidCollateral = () => {
        let {collateralAmount, debtAmount} = state;

        collateralAmount =
            (collateralAmount as any) == 0
                ? collateralAmount
                : collateralAmount.replace(/,/g, "");
        debtAmount =
            (debtAmount as any) == 0 ? debtAmount : debtAmount.replace(/,/g, "");

        (AssetActions as any).bidCollateral(
            state.account ? state.account.get("id") : null,
            core,
            asset,
            collateralAmount,
            debtAmount
        );
        setTimeout(() => {
            onUpdate();
        }, 6000);
    };

    let tabIndex = 1;
    let balance: any = 0;
    const {account, collateralAmount, debtAmount} = state;
    const backingBalanceID = account
        ? account.getIn(["balances", core.get("id")])
        : null;
    if (backingBalanceID) {
        const balanceObject = (ChainStore as any).getObject(backingBalanceID);
        if (balanceObject) {
            balance = balanceObject.get("balance");
        }
    }

    const balanceText = (
        <span>
            <Translate component="span" content="transfer.available" />
            :&nbsp;
            <FormattedAsset amount={balance} asset={core.get("id")} />
        </span>
    );

    return (
        <div>
            <AmountSelector
                label="transaction.collateral"
                display_balance={balanceText}
                amount={collateralAmount}
                onChange={collateralBidInput}
                asset={core.get("id")}
                assets={[core.get("id")]}
                placeholder="0.0"
                tabIndex={tabIndex++}
                style={{width: "100%", paddingTop: 16}}
            />

            <AmountSelector
                label="transaction.borrow_amount"
                amount={debtAmount}
                onChange={debtBidInput}
                asset={asset.get("id")}
                assets={[asset.get("id")]}
                placeholder="0.0"
                tabIndex={tabIndex++}
                style={{width: "100%", paddingTop: 16}}
            />

            {collateralAmount !== "0" && debtAmount !== "0" && (
                <div
                    style={{
                        paddingTop: "1rem"
                    }}
                >
                    <Translate content="explorer.asset.collateral.bid_price" />
                    &nbsp;
                    <FormattedPrice
                        base_amount={(collateralAmount as any) / 1}
                        base_asset={core.get("id")}
                        quote_amount={(debtAmount as any) / 1}
                        quote_asset={asset.get("id")}
                        noPopOver
                        ignorePriceFeed
                    />
                </div>
            )}

            <div style={{paddingTop: "1rem"}} className="button-group">
                <button
                    className={classnames("button")}
                    onClick={onBidCollateral}
                    tabIndex={tabIndex++}
                >
                    <Translate content="transaction.trxTypes.bid_collateral" />
                </button>
                <button
                    className="button outline"
                    onClick={reset}
                    tabIndex={tabIndex++}
                >
                    <Translate content="account.perm.reset" />
                </button>
            </div>
        </div>
    );
}

export default AssetWrapper(BidCollateralOperation as any, {
    propNames: ["asset", "core"],
    withDynamic: true
} as any);
