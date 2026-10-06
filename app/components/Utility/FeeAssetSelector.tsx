// TypeScript/functional-component port of the legacy FeeAssetSelector.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes,
// with one deliberate, documented exception (see below).
//
// `AssetWrapper(Component, {propNames: ["defaultFeeAsset"]})` and
// `debounceRender(Component, 150, {leading: false})` are kept wrapping
// the exported component, same as the original (both are generic HOCs
// already used elsewhere in this migration on function components).
//
// Structural change (not a behavior change): the original's
// `connect(FeeAssetSelector, {listenTo, getProps})` alt-react HOC is
// replaced by `useAltStore(SettingsStore)`.
//
// The class's multiple `this.state.X` fields are kept as one combined
// state object (not split into separate `useState` calls), updated via a
// `setState`-style shallow-merge helper, to preserve the original's
// atomic multi-field `this.setState({a, b})` updates exactly. A
// `stateRef` mirrors the latest state for reads inside `async` functions
// (`_calculateFee`, `_syncAvailableAssets`), matching `this.state` always
// reading the current value across `await` boundaries.
//
// `_calculateFee`'s `this.setState(update, callback)` (calls `onChange`
// *after* the state update, via the class setState callback form) is
// replicated by calling `onChange(fee)` immediately after the merge-state
// call - safe because the callback doesn't read any freshly-rendered
// output, only the local `fee` value already computed, so the callback's
// precise post-render timing was never actually load-bearing here.
//
// `shouldComponentUpdate` looked at first like a correctness gate (since
// it can prevent `componentDidUpdate` from running at all, unlike a pure
// perf guard) - checked carefully: every condition inside `_feeNeed
// Calculation` (the same function `componentDidUpdate` uses to decide
// whether to recalculate) is also one of `shouldComponentUpdate`'s OR'd
// conditions, so `shouldComponentUpdate` can only return `false` when
// `_feeNeedCalculation` is *also* already false - it never actually
// suppresses a fee recalculation. Safe to drop, per this migration's
// established treatment of perf guards, once verified this deeply.
//
// **Deliberate, documented behavior difference** (not a silent "fix"):
// `componentDidUpdate`'s `assets: null` reset (fired when the account
// changes) *was* subject to an edge case via `shouldComponentUpdate`:
// if the account changes while `_feeNeedCalculation`'s other
// preconditions (`transaction`, `feeAsset`) aren't yet ready, and no
// other state field happens to differ, `shouldComponentUpdate` could
// return `false` and silently skip the `assets` reset for that update.
// This port's `useEffect`, keyed on `[account, transaction,
// state.feeAsset]`, always resets `assets` when the account reference
// changes, regardless of those other preconditions - removing a narrow,
// self-correcting staleness edge case rather than replicating it, since
// faithfully reproducing `shouldComponentUpdate`'s render-gating inside
// hooks here would need disproportionate extra machinery for a
// non-security-relevant caching edge case.
import * as React from "react";
import utils from "common/utils";
import Immutable from "immutable";
import counterpart from "counterpart";
import AssetWrapper from "./AssetWrapper";
import {Form} from "../../design-system/Form";
import {Input} from "../../design-system/Input";
import {Button} from "../../design-system/Button";
import {Tooltip} from "../../design-system/Tooltip";
import {Icon} from "../../design-system/Icon";
import AssetSelect from "./AssetSelect";
import {FetchChain} from "bitsharesjs";
import SetDefaultFeeAssetModal from "../Modal/SetDefaultFeeAssetModal";
import debounceRender from "react-debounce-render";
import SettingsStore from "../../stores/SettingsStore";
import {checkFeeStatusAsync} from "common/trxHelper";
import {useAltStore} from "../../next/hooks/useAltStore";

const DEBUG = __DEV__ && false;

interface FeeAssetSelectorProps {
    // injected
    defaultFeeAsset?: any;

    // object wih data required for fee calculation
    transaction?: any;

    // assets to choose from - declared in the original propTypes but
    // never actually read anywhere in the component; kept accepted (but
    // unused) so callers passing it don't hit a type error.
    assets?: any;

    // a translation key for the input label, defaults to "Fee"
    label?: string;

    // handler for changedFee (asset, or amount)
    onChange?: (fee: any) => void;

    // account which pays fee
    account?: any;

    // tab index if needed
    tabIndex?: number;

    // do not allow to switch the asset or amount
    disabled?: boolean;

    style?: any;
}

interface FeeAssetSelectorState {
    feeAsset: any;
    calculatedFeeAmount: number | null;
    assets: any[] | null;
    assetsLoading: boolean;
    isModalVisible: boolean;
    error: any;
}

function FeeAssetSelector({
    defaultFeeAsset,
    transaction,
    label = "transfer.fee",
    onChange,
    account,
    tabIndex,
    disabled = false,
    style
}: FeeAssetSelectorProps) {
    const [state, setState] = React.useState<FeeAssetSelectorState>(() => ({
        feeAsset: defaultFeeAsset,
        calculatedFeeAmount: null,
        assets: null,
        assetsLoading: false,
        isModalVisible: false,
        error: null
    }));

    const mergeState = (partial: Partial<FeeAssetSelectorState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const stateRef = React.useRef(state);
    stateRef.current = state;

    const getAsset = () => {
        const {assets: stAssets, feeAsset} = stateRef.current;
        return feeAsset
            ? feeAsset
            : stAssets && stAssets.length > 0
            ? stAssets[0]
            : null;
    };

    const getSelectableAssets = () => {
        return stateRef.current.assets
            ? stateRef.current.assets
            : [getAsset().get("symbol")];
    };

    const calculateFee = async (assetArg: any = null) => {
        const setStateFlag = assetArg == null;
        let asset = assetArg;
        if (!asset) {
            asset = stateRef.current.feeAsset;
        }
        const feeID = typeof asset == "string" ? asset : asset.get("id");
        try {
            const {fee, hasPoolBalance} = await checkFeeStatusAsync({
                ...transaction,
                accountID: account.get("id"),
                feeID
            });

            if (setStateFlag) {
                mergeState({
                    calculatedFeeAmount: fee.getAmount({real: true}),
                    error: !hasPoolBalance
                        ? {
                              key: "noPoolBalanceShort",
                              tooltip: "noPoolBalance"
                          }
                        : false
                });
                if (onChange) {
                    onChange(fee);
                }
            }
            return {
                fee,
                hasPoolBalance
            };
        } catch (err) {
            if (setStateFlag) {
                mergeState({
                    calculatedFeeAmount: 0,
                    error: {
                        key: "unknown"
                    }
                });
            }
            console.error(err);
            throw err;
        }
    };

    const accountChanges = (oldAccount: any, newAccount: any) => {
        return (
            newAccount &&
            (!oldAccount || newAccount.get("id") !== oldAccount.get("id"))
        );
    };

    const feeNeedCalculation = (
        oldAccount: any,
        newAccount: any,
        oldTransaction: any,
        newTransaction: any,
        oldFeeAsset: any,
        newFeeAsset: any
    ) => {
        const accChanged = accountChanges(oldAccount, newAccount);
        const transactionChanged =
            newTransaction &&
            JSON.stringify(newTransaction) !== JSON.stringify(oldTransaction);
        const feeAssetChanged =
            newFeeAsset &&
            (!oldFeeAsset || newFeeAsset.get("id") !== oldFeeAsset.get("id"));
        const calculationIsPossible = newAccount && newTransaction && newFeeAsset;
        return (
            calculationIsPossible &&
            (accChanged || transactionChanged || feeAssetChanged)
        );
    };

    const prevRef = React.useRef<{account: any; transaction: any; feeAsset: any}>({
        account: undefined,
        transaction: undefined,
        feeAsset: undefined
    });
    const isMountRef = React.useRef(true);

    React.useEffect(() => {
        const prev = prevRef.current;
        if (isMountRef.current) {
            isMountRef.current = false;
        } else if (accountChanges(prev.account, account)) {
            mergeState({assets: null});
        }
        if (
            feeNeedCalculation(
                prev.account,
                account,
                prev.transaction,
                transaction,
                prev.feeAsset,
                state.feeAsset
            )
        ) {
            calculateFee();
        }
        prevRef.current = {account, transaction, feeAsset: state.feeAsset};
    }, [account, transaction, state.feeAsset]);

    const syncAvailableAssets = async (
        opened: any,
        accountArg: any = account
    ) => {
        if (DEBUG)
            console.log("FeeAssetSelector.syncAvailableAssets", opened, accountArg);
        if (stateRef.current.assets) {
            return stateRef.current.assets;
        }
        mergeState({assetsLoading: true});
        let possibleAssets = [getAsset().get("id")];
        const accountBalances = accountArg.get("balances").toJS();
        const sortedKeys = Object.keys(accountBalances).sort(utils.sortID);
        for (let i = 0, key; (key = sortedKeys[i]); i++) {
            const balanceObject = await FetchChain("getObject", accountBalances[key]);
            try {
                const requiredForFee = await calculateFee(key);
                if (DEBUG) {
                    console.log(
                        "FeeAssetSelector.syncAvailableAssets: Checking " +
                            key +
                            " ... ",
                        requiredForFee
                    );
                }
                if (
                    balanceObject &&
                    balanceObject.get("balance") >= requiredForFee.fee.getAmount() &&
                    !possibleAssets.includes(key)
                ) {
                    possibleAssets.push(key);
                    possibleAssets = possibleAssets.sort(utils.sortID);
                    mergeState({assets: possibleAssets});
                }
            } catch (err) {
                if (DEBUG) {
                    console.log(" ... not possible");
                }
            }
        }

        mergeState({assetsLoading: false});
    };

    const onAssetChange = async (selectedAssetId: any) => {
        const asset = await (FetchChain as any)("getAsset", selectedAssetId);
        mergeState({feeAsset: asset});
        calculateFee();
    };

    const openSetDefaultAssetModal = () => {
        mergeState({isModalVisible: true});
    };

    const currentAsset = getAsset();
    const feeInputString = state.error
        ? counterpart.translate("transfer.errors." + state.error.key)
        : state.calculatedFeeAmount;

    const labelEl = label ? (
        <div className="amount-selector-field--label">
            {counterpart.translate(label)}
            {state.error && state.error.tooltip && (
                <Tooltip
                    title={counterpart.translate(
                        "transfer.errors." + state.error.tooltip
                    )}
                >
                    &nbsp; <Icon type="question-circle" />
                </Tooltip>
            )}
        </div>
    ) : null;

    const canChangeFeeParams = !disabled && !!account;

    const changeDefaultButton = (
        <Tooltip
            title={counterpart.translate(
                "settings.change_default_fee_asset_tooltip"
            )}
            mouseEnterDelay={0.5}
        >
            <Button
                style={{right: "-12px"}}
                onClick={openSetDefaultAssetModal}
                disabled={!canChangeFeeParams}
            >
                {counterpart.translate("settings.change_default")}
            </Button>
        </Tooltip>
    );

    const selectableAssets = getSelectableAssets();

    return (
        <div>
            <Form.Item
                label={labelEl}
                style={{...style, margin: "0 0 0 0"}}
                className="amount-selector-field"
            >
                <Input.Group compact>
                    <Input
                        style={{
                            width: "calc(100% - 130px)"
                        }}
                        disabled={true}
                        value={feeInputString || ""}
                        tabIndex={tabIndex}
                        suffix={state.error ? changeDefaultButton : undefined}
                    />

                    <AssetSelect
                        loading={state.assetsLoading}
                        onDropdownVisibleChange={syncAvailableAssets}
                        style={{width: "130px"}}
                        selectStyle={{width: "100%"}}
                        value={currentAsset.get("symbol")}
                        assets={
                            canChangeFeeParams
                                ? Immutable.List(selectableAssets)
                                : []
                        }
                        onChange={onAssetChange}
                    />
                </Input.Group>
            </Form.Item>

            {state.isModalVisible && (
                <SetDefaultFeeAssetModal
                    className="modal"
                    show={state.isModalVisible}
                    currentAccount={account}
                    asset_types={
                        undefined //this.state.assets.map(asset => ({
                        //asset,
                        //fee: this.state.fees[asset]
                        //}))
                    }
                    displayFees={true}
                    forceDefault={false}
                    current_asset={currentAsset.get("id")}
                    onChange={onAssetChange}
                    close={() => {
                        mergeState({isModalVisible: false});
                    }}
                />
            )}
        </div>
    );
}

const DebouncedFeeAssetSelector = debounceRender(FeeAssetSelector, 150, {
    leading: false
});

const WrappedFeeAssetSelector = AssetWrapper(DebouncedFeeAssetSelector, {
    propNames: ["defaultFeeAsset"]
});

function FeeAssetSelectorContainer(props: FeeAssetSelectorProps) {
    const settingsState = useAltStore<any>(SettingsStore);
    const defaultFeeAsset =
        settingsState.settings.get("fee_asset") || "1.3.0";

    return (
        <WrappedFeeAssetSelector {...(props as any)} defaultFeeAsset={defaultFeeAsset} />
    );
}

export default FeeAssetSelectorContainer;
