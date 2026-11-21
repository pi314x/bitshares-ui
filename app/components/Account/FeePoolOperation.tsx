// TypeScript/functional-component port of the legacy FeePoolOperation.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md (submits on-chain fee-pool
// fund/claim operations via `AssetActions`): `onFundPool`, `onClaimPool`,
// `onClaimFees`, `onClaimCollateralFees` transcribed verbatim.
//
// `AssetWrapper(Component, {propNames: ["asset", "core"], defaultProps,
// withDynamic: true})` kept as-is (shared HOC, out of scope).
//
// Preserved verbatim (not "fixed"): the stray `console.log(dynamicObject)`
// in `renderClaimCollateralFees` (matches the project's established
// practice elsewhere of keeping pre-existing debug logs, e.g.
// `AccountWhitelist.tsx`, `FeeAssetSelector.tsx`); `onClaimInput` and
// `onClaimCollateralInput` remain two near-identical functions rather
// than being consolidated, matching the original's own duplication.
//
// The original's `state[key + "Asset"].setAmount(...)` (mutating an
// `Asset` instance already held in state, then `setState`-ing a
// *different* key to trigger the re-render) is replicated as-is: the
// `Asset` instances are never replaced across renders (only mutated in
// place), and `mergeState` on a sibling primitive key still triggers the
// re-render that picks up the mutation, exactly like the original's
// `this.setState({[key]: ...})` on a class instance whose other fields
// were mutated directly.
import * as React from "react";
import classnames from "classnames";
import Translate from "react-translate-component";
import {Asset} from "common/MarketClasses";
import AccountSelector from "../Account/AccountSelector";
import AmountSelector from "../Utility/AmountSelector";
import FormattedAsset from "../Utility/FormattedAsset";
import AssetActions from "actions/AssetActions";
import AssetWrapper from "../Utility/AssetWrapper";
import {ChainStore} from "bitsharesjs";

interface FeePoolOperationState {
    funderAccountName?: any;
    newFunderAccount?: any;
    fundPoolAmount: any;
    fundPoolAsset: any;
    claimPoolAmount: any;
    claimPoolAmountAsset: any;
    claimFeesAmount: any;
    claimFeesAmountAsset: any;
    claimCollateralFeesAmount: any;
    claimCollateralFeesAmountAsset: any;
    backingAsset: any;
}

interface FeePoolOperationCoreProps {
    type?: string;
    asset: any;
    core: any;
    hideBalance?: boolean;
    getDynamicObject: (id: any) => any;
    funderAccountName?: any;
}

function FeePoolOperation({
    type = "fund",
    asset,
    core,
    hideBalance,
    getDynamicObject,
    funderAccountName: funderAccountNameProp
}: FeePoolOperationCoreProps) {
    const buildInitialState = (): FeePoolOperationState => ({
        funderAccountName: funderAccountNameProp,
        fundPoolAmount: 0,
        fundPoolAsset: new (Asset as any)({
            amount: 0,
            precision: core.get("precision"),
            asset_id: core.get("id")
        }),
        claimPoolAmount: 0,
        claimPoolAmountAsset: new (Asset as any)({
            amount: 0,
            precision: core.get("precision"),
            asset_id: core.get("id")
        }),
        claimFeesAmount: 0,
        claimFeesAmountAsset: new (Asset as any)({
            amount: 0,
            precision: asset.get("precision"),
            asset_id: asset.get("id")
        }),
        claimCollateralFeesAmount: 0,
        claimCollateralFeesAmountAsset: new (Asset as any)({
            amount: 0,
            precision: asset.get("precision"),
            asset_id: asset.get("id")
        }),
        backingAsset: new (Asset as any)({
            amount: 0,
            asset_id: asset.has("bitasset")
                ? asset.getIn(["bitasset", "options", "short_backing_asset"])
                : "1.3.0"
        })
    });

    const [state, setState] = React.useState<FeePoolOperationState>(
        buildInitialState
    );

    const mergeState = (partial: Partial<FeePoolOperationState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const reset = () => {
        setState(buildInitialState());
    };

    const onAccountNameChanged = (value: any) =>
        mergeState({funderAccountName: value});
    const onAccountChanged = (value: any) =>
        mergeState({newFunderAccount: value});
    const onPoolInput = (value: any) =>
        mergeState({fundPoolAmount: value.amount});

    const onClaimInput = (key: string, {amount}: any) => {
        (state as any)[key + "Asset"].setAmount({real: amount});
        mergeState({[key]: amount} as any);
    };

    const onClaimCollateralInput = (key: string, {amount}: any) => {
        (state as any)[key + "Asset"].setAmount({real: amount});
        mergeState({[key]: amount} as any);
    };

    const onFundPool = () =>
        (AssetActions as any).fundPool(
            state.newFunderAccount ? state.newFunderAccount.get("id") : null,
            core,
            asset,
            state.fundPoolAmount.replace(/,/g, "")
        );

    const onClaimCollateralFees = () => {
        const account = (ChainStore as any).getAccount(state.funderAccountName);
        if (!account) return;
        (AssetActions as any).claimCollateralFees(
            account.get("id"),
            asset,
            state.backingAsset,
            state.claimCollateralFeesAmountAsset
        );
    };

    const onClaimFees = () => {
        const account = (ChainStore as any).getAccount(state.funderAccountName);
        if (!account) return;
        (AssetActions as any).claimPoolFees(
            account.get("id"),
            asset,
            state.claimFeesAmountAsset
        );
    };

    const onClaimPool = () =>
        (AssetActions as any).claimPool(asset, state.claimPoolAmountAsset);

    const renderFundPool = () => {
        const {funderAccountName, fundPoolAmount, newFunderAccount} = state;
        let dynamicObject = null;
        if (!hideBalance)
            dynamicObject = getDynamicObject(
                asset.get("dynamic_asset_data_id")
            );
        const coreID = core.get("id") || "1.3.0";
        let balance = 0;
        if (newFunderAccount) {
            const coreBalanceID = newFunderAccount.getIn(["balances", coreID]);
            if (coreBalanceID) {
                const balanceObject = ChainStore.getObject(coreBalanceID);
                if (balanceObject) {
                    balance = (balanceObject as any).get("balance");
                }
            }
        }
        const balanceText = (
            <span>
                <Translate component="span" content="transfer.available" />
                :&nbsp;
                <FormattedAsset amount={balance} asset={coreID} />
            </span>
        );
        return (
            <div>
                {hideBalance || (
                    <div style={{paddingBottom: "1.5rem"}}>
                        <Translate content="explorer.asset.fee_pool.pool_balance" />
                        <span>: </span>
                        {dynamicObject ? (
                            <FormattedAsset
                                amount={(dynamicObject as any).get("fee_pool")}
                                asset={coreID}
                            />
                        ) : null}
                    </div>
                )}

                <AccountSelector
                    label="transaction.funding_account"
                    accountName={funderAccountName}
                    onChange={onAccountNameChanged}
                    onAccountChanged={onAccountChanged}
                    account={funderAccountName}
                    error={null}
                    tabIndex={1}
                />

                <AmountSelector
                    label="transfer.amount"
                    display_balance={balanceText}
                    amount={fundPoolAmount}
                    onChange={onPoolInput}
                    asset={coreID}
                    assets={[coreID]}
                    placeholder="0.0"
                    tabIndex={2}
                    style={{width: "100%", paddingTop: 16}}
                />

                <div style={{paddingTop: "1rem"}} className="button-group">
                    <button
                        className={classnames("button", {
                            disabled: fundPoolAmount <= 0
                        })}
                        onClick={onFundPool}
                    >
                        <Translate content="transaction.trxTypes.asset_fund_fee_pool" />
                    </button>
                    <button className="button outline" onClick={reset}>
                        <Translate content="account.perm.reset" />
                    </button>
                </div>
            </div>
        );
    };

    const renderClaimPool = () => {
        const {claimPoolAmount} = state;
        const dynamicObject: any = getDynamicObject(
            asset.get("dynamic_asset_data_id")
        );
        const coreID = core.get("id") || "1.3.0";

        const balanceText = !!dynamicObject ? (
            <span
                onClick={() => {
                    state.claimPoolAmountAsset.setAmount({
                        sats: dynamicObject.get("fee_pool")
                    });
                    mergeState({
                        claimPoolAmount: state.claimPoolAmountAsset.getAmount({
                            real: true
                        })
                    });
                }}
            >
                <Translate component="span" content="transfer.available" />
                :&nbsp;
                <FormattedAsset
                    amount={dynamicObject.get("fee_pool")}
                    asset={coreID}
                />
            </span>
        ) : null;

        return (
            <div>
                <Translate
                    component="p"
                    content="explorer.asset.fee_pool.claim_pool_text"
                />
                <AmountSelector
                    label="transfer.amount"
                    display_balance={balanceText}
                    amount={claimPoolAmount}
                    onChange={(value: any) =>
                        onClaimInput("claimPoolAmount", value)
                    }
                    asset={coreID}
                    assets={[coreID]}
                    placeholder="0.0"
                    tabIndex={2}
                    style={{width: "100%", paddingTop: 16}}
                />

                <div style={{paddingTop: "1rem"}} className="button-group">
                    <button
                        className={classnames("button", {
                            disabled: claimPoolAmount <= 0
                        })}
                        onClick={onClaimPool}
                    >
                        <Translate content="transaction.trxTypes.asset_claim_fee_pool" />
                    </button>
                    <button className="button outline" onClick={reset}>
                        <Translate content="account.perm.reset" />
                    </button>
                </div>
            </div>
        );
    };

    const renderClaimFees = () => {
        const {claimFeesAmount} = state;
        const dynamicObject: any = getDynamicObject(
            asset.get("dynamic_asset_data_id")
        );

        const unclaimedBalance = dynamicObject
            ? dynamicObject.get("accumulated_fees")
            : 0;
        const validClaim =
            claimFeesAmount > 0 &&
            state.claimFeesAmountAsset.getAmount() <= unclaimedBalance;

        const unclaimedBalanceText = (
            <span
                onClick={() => {
                    state.claimFeesAmountAsset.setAmount({
                        sats: dynamicObject.get("accumulated_fees")
                    });
                    mergeState({
                        claimFeesAmount: state.claimFeesAmountAsset.getAmount({
                            real: true
                        })
                    });
                }}
            >
                <Translate component="span" content="transfer.available" />
                :&nbsp;
                <FormattedAsset
                    amount={unclaimedBalance}
                    asset={asset.get("id")}
                />
            </span>
        );

        return (
            <div>
                <Translate
                    component="p"
                    content="explorer.asset.fee_pool.claim_text"
                    asset={asset.get("symbol")}
                />
                <div style={{paddingBottom: "1rem"}}>
                    <Translate content="explorer.asset.fee_pool.unclaimed_issuer_income" />
                    :&nbsp;
                    {dynamicObject ? (
                        <FormattedAsset
                            amount={dynamicObject.get("accumulated_fees")}
                            asset={asset.get("id")}
                        />
                    ) : null}
                </div>

                <AmountSelector
                    label="transfer.amount"
                    display_balance={unclaimedBalanceText}
                    amount={claimFeesAmount}
                    onChange={(value: any) =>
                        onClaimInput("claimFeesAmount", value)
                    }
                    asset={asset.get("id")}
                    assets={[asset.get("id")]}
                    placeholder="0.0"
                    tabIndex={1}
                    style={{width: "100%", paddingTop: 16}}
                />

                <div style={{paddingTop: "1rem"}} className="button-group">
                    <button
                        className={classnames("button", {
                            disabled: !validClaim
                        })}
                        onClick={onClaimFees}
                    >
                        <Translate content="explorer.asset.fee_pool.claim_fees" />
                    </button>
                    <button className="button outline" onClick={reset}>
                        <Translate content="account.perm.reset" />
                    </button>
                </div>
            </div>
        );
    };

    const renderClaimCollateralFees = () => {
        const {claimCollateralFeesAmount} = state;
        const dynamicObject: any = getDynamicObject(
            asset.get("dynamic_asset_data_id")
        );
        console.log(dynamicObject);
        const backingAsset = asset.has("bitasset")
            ? asset.getIn(["bitasset", "options", "short_backing_asset"])
            : "1.3.0";
        const unclaimedCollateralBalance = dynamicObject
            ? dynamicObject.get("accumulated_collateral_fees")
            : 0;
        const validClaim =
            claimCollateralFeesAmount > 0 &&
            state.claimCollateralFeesAmountAsset.getAmount() <=
                unclaimedCollateralBalance;

        const unclaimedCollateralBalanceText = (
            <span
                onClick={() => {
                    state.claimCollateralFeesAmountAsset.setAmount({
                        sats: dynamicObject.get("accumulated_collateral_fees")
                    });
                    mergeState({
                        claimCollateralFeesAmount: state.claimCollateralFeesAmountAsset.getAmount(
                            {
                                real: true
                            }
                        )
                    });
                }}
            >
                <Translate component="span" content="transfer.available" />
                :&nbsp;
                <FormattedAsset
                    amount={unclaimedCollateralBalance}
                    asset={backingAsset}
                />
            </span>
        );
        return (
            <div>
                <Translate
                    component="p"
                    content="explorer.asset.fee_pool.claim_text"
                    asset={backingAsset}
                />
                <div style={{paddingBottom: "1rem"}}>
                    <Translate content="explorer.asset.fee_pool.unclaimed_issuer_income" />
                    :&nbsp;
                    {dynamicObject ? (
                        <FormattedAsset
                            amount={dynamicObject.get(
                                "accumulated_collateral_fees"
                            )}
                            asset={backingAsset}
                        />
                    ) : null}
                </div>

                <AmountSelector
                    label="transfer.amount"
                    display_balance={unclaimedCollateralBalanceText}
                    amount={claimCollateralFeesAmount}
                    onChange={(value: any) =>
                        onClaimCollateralInput(
                            "claimCollateralFeesAmount",
                            value
                        )
                    }
                    asset={backingAsset}
                    assets={[backingAsset]}
                    placeholder="0.0"
                    tabIndex={1}
                    style={{width: "100%", paddingTop: 16}}
                />

                <div style={{paddingTop: "1rem"}} className="button-group">
                    <button
                        className={classnames("button", {
                            disabled: !validClaim
                        })}
                        onClick={onClaimCollateralFees}
                    >
                        <Translate content="explorer.asset.fee_pool.claim_collateral_fees" />
                    </button>
                    <button className="button outline" onClick={reset}>
                        <Translate content="account.perm.reset" />
                    </button>
                </div>
            </div>
        );
    };

    if (type === "fund") {
        return renderFundPool();
    } else if (type === "claim") {
        return renderClaimPool();
    } else if (type === "claim_fees") {
        return renderClaimFees();
    } else if (type === "claim_collateral_fees") {
        return renderClaimCollateralFees();
    }
    return null;
}

const WrappedFeePoolOperation = AssetWrapper(FeePoolOperation, {
    propNames: ["asset", "core"],
    defaultProps: {
        core: "1.3.0"
    },
    withDynamic: true
} as any);

export default WrappedFeePoolOperation;
