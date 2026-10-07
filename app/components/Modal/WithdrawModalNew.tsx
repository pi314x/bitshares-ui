// TypeScript/functional-component port of the legacy WithdrawModalNew.jsx
// (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes to
// the actual gateway-withdrawal flow.
//
// Security-sensitive per AGENTS.md: `onSubmit` still calls the real
// `AccountActions.transfer(...)` with the amount/asset/address/memo
// exactly as before, reading them from current component state at submit
// time.
//
// Structural change (not a behavior change): the original's 4-layer
// class-component wrapper chain - `BindToChainState(WithdrawModalWrapper)`
// (resolves the current account via `ChainTypes.ChainAccount`) wrapping
// `BalanceWrapper` (via `BindToChainState` again, resolves the account's
// balance objects into a list) wrapping `connect(WithdrawModalNew, {...})`
// (subscribes to GatewayStore/AssetStore/SettingsStore/MarketsStore) -
// collapses into one container component resolving the same data
// directly via `ChainStore` calls under `useChainStoreTick()` plus
// `useAltStore()`, per this migration's established BindToChainState
// replacement pattern (see e.g. `Brainkey.tsx`). `BalanceWrapper`'s own
// `orders`/`balanceAssets` computation is not carried over: grepped, and
// `WithdrawModalNew` never actually reads either prop - both were already
// dead from this component's perspective.
//
// `UNSAFE_componentWillReceiveProps` had two real side effects tied
// specifically to *prop* changes, not this component's own state changes
// (a distinction hooks don't give for free the way class lifecycle
// methods do): recomputing the derived asset-pair variables, and - if an
// address was already entered - re-running address validation. Both are
// replicated by comparing this render's freshly-read external values
// (account/assets/balances/backedCoins/preferredCurrency/marketStats/
// intermediateAccounts/initialSymbol) against refs holding the previous
// render's, so they fire on prop changes only, not on every
// `mergeState()`-driven re-render from this component's own handlers.
// `UNSAFE_componentWillUpdate`'s `MarketsActions.getMarketStats(...)`
// call (whenever `preferredCurrency`/`selectedAsset`/`quantity` are all
// set and at least one changed) is replicated the same way.
import * as React from "react";
import DepositWithdrawAssetSelector from "../DepositWithdraw/DepositWithdrawAssetSelector";
import Translate from "react-translate-component";
import ExchangeInput from "components/Exchange/ExchangeInput";
import AssetName from "../Utility/AssetName";
import GatewayStore from "stores/GatewayStore";
import AssetStore from "stores/AssetStore";
import MarketsStore from "stores/MarketsStore";
import MarketsActions from "actions/MarketsActions";
import SettingsStore from "stores/SettingsStore";
import Immutable from "immutable";
import {Asset, Price} from "common/MarketClasses";
import utils from "common/utils";
import MarketUtils from "common/market_utils";
import AccountActions from "actions/AccountActions";
import AccountStore from "stores/AccountStore";
import FormattedAsset from "../Utility/FormattedAsset";
import BalanceComponent from "../Utility/BalanceComponent";
import QRScanner from "../QRAddressScanner";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import {Select} from "../../design-system/Select";
import {Input} from "../../design-system/Input";
import counterpart from "counterpart";
import {
    gatewaySelector,
    _getNumberAvailableGateways,
    _onAssetSelected,
    _getCoinToGatewayMapping
} from "lib/common/assetGatewayMixin";
import {getGatewayStatusByAsset} from "common/gatewayUtils";
import {availableGateways} from "common/gateways";
import {
    validateAddress as blocktradesValidateAddress,
    WithdrawAddresses
} from "lib/common/gatewayMethods";
import FeeAssetSelector from "components/Utility/FeeAssetSelector";
import {checkBalance} from "common/trxHelper";
import AccountSelector from "components/Account/AccountSelector";
import {ChainStore} from "bitsharesjs";
import {getAssetAndGateway, getIntermediateAccount} from "common/gatewayUtils";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const gatewayBoolCheck = "withdrawalAllowed";

interface WithdrawState {
    selectedAsset: string;
    selectedAssetId: string;
    selectedGateway: string;
    fee: number;
    feeAmount: any;
    hasBalance: any;
    hasPoolBalance: any;
    feeError: any;
    fee_asset_id: string;
    gateFee: number;
    quantity: number;
    address: string;
    tag: string;
    memo: string;
    withdraw_publicKey: string;
    withdraw_publicKey_not_empty: boolean;
    userEstimate: any;
    addressError: boolean;
    gatewayStatus: any;
    withdrawalCurrencyId: any;
    withdrawalCurrencyBalance: any;
    withdrawalCurrencyBalanceId: any;
    withdrawalCurrencyPrecision: any;
    preferredCurrencyPrecision: any;
    precisionDifference: any;
    coreAsset: any;
    convertedBalance: any;
    estimatedValue: any;
    options_is_valid: boolean;
    btsAccountName: string;
    btsAccount: any;
    btsAccountError?: any;
    coinToGatewayMapping?: any;
    withdrawalCurrency?: any;
    nAvailableGateways?: number;
    assetAndGateway?: any;
    isBTS?: boolean;
    canCoverWithdrawal?: any;
    fee_asset_types?: string[];
}

function getInitialWithdrawState(): WithdrawState {
    return {
        selectedAsset: "",
        selectedAssetId: "",
        selectedGateway: "",
        fee: 0,
        feeAmount: new (Asset as any)({amount: 0}),
        hasBalance: null,
        hasPoolBalance: null,
        feeError: null,
        fee_asset_id: "1.3.0",
        gateFee: 0,
        quantity: 0,
        address: "",
        tag: "",
        memo: "",
        withdraw_publicKey: "",
        withdraw_publicKey_not_empty: false,
        userEstimate: null,
        addressError: false,
        gatewayStatus: availableGateways,
        withdrawalCurrencyId: "",
        withdrawalCurrencyBalance: null,
        withdrawalCurrencyBalanceId: "",
        withdrawalCurrencyPrecision: "",
        preferredCurrencyPrecision: "",
        precisionDifference: "",
        coreAsset: "",
        convertedBalance: "",
        estimatedValue: "",
        options_is_valid: false,
        btsAccountName: "",
        btsAccount: ""
    };
}

function getAssetAndGatewayFromInitialSymbol(
    initialSymbol: string,
    backedCoins: any
) {
    const {selectedAsset, selectedGateway} = (getAssetAndGateway as any)(
        initialSymbol
    );
    let gateFee = 0;

    if (selectedGateway) {
        backedCoins.get(selectedGateway).forEach((item: any) => {
            if (
                item.symbol == [selectedGateway, selectedAsset].join(".") ||
                item.backingCoinType == selectedAsset
            ) {
                gateFee = item.gateFee;
            }
        });
    }

    return {selectedAsset, selectedGateway, gateFee};
}

function getAvailableAssets(btsAccount: any): {fee_asset_types: string[]} {
    let fee_asset_types: string[] = [];
    if (!(btsAccount && btsAccount.get("balances"))) {
        return {fee_asset_types};
    }
    const account_balances = btsAccount.get("balances").toJS();
    fee_asset_types = Object.keys(account_balances).sort((utils as any).sortID);
    for (const key in account_balances) {
        const asset = (ChainStore as any).getObject(key);
        const balanceObject = (ChainStore as any).getObject(
            account_balances[key]
        );
        if (balanceObject && balanceObject.get("balance") === 0) {
            if (fee_asset_types.indexOf(key) !== -1) {
                fee_asset_types.splice(fee_asset_types.indexOf(key), 1);
            }
        }

        if (asset) {
            // Remove any assets that do not have valid core exchange rates
            let priceIsValid = false;
            try {
                const p = new (Price as any)({
                    base: new (Asset as any)(
                        asset
                            .getIn(["options", "core_exchange_rate", "base"])
                            .toJS()
                    ),
                    quote: new (Asset as any)(
                        asset
                            .getIn(["options", "core_exchange_rate", "quote"])
                            .toJS()
                    )
                });
                priceIsValid = p.isValid();
            } catch (err) {
                priceIsValid = false;
            }

            if (asset.get("id") !== "1.3.0" && !priceIsValid) {
                fee_asset_types.splice(fee_asset_types.indexOf(key), 1);
            }
        }
    }
    return {fee_asset_types};
}

function getAssetPairVariables(
    props: {
        assets: any;
        marketStats: any;
        balances: any;
        preferredCurrency: any;
    },
    state: WithdrawState,
    btsAccount: any,
    backedCoins: any
) {
    const {assets, marketStats, balances, preferredCurrency} = props;
    const {selectedAsset, selectedGateway} = state;
    let gateFee: any = state.gateFee;
    let quantity: any = state.quantity;
    if (isNaN(gateFee)) gateFee = 0;
    quantity = Number(quantity);
    if (isNaN(quantity)) quantity = 0;
    gateFee = Number(gateFee);
    let fullSymbol = selectedGateway
        ? selectedGateway + "." + selectedAsset
        : selectedAsset;

    if (selectedGateway === "RUDEX" && selectedAsset === "PPY")
        fullSymbol = "PPY";

    let withdrawalCurrencyBalance: any = 0;
    let withdrawalCurrencyBalanceId = null;
    let withdrawalCurrencyPrecision: any = null;
    let preferredCurrencyPrecision: any = null;
    let precisionDifference: any = 0;
    let coreAsset: any = null;
    let convertedBalance: any = null;
    let estimatedValue: any = 0;

    const withdrawalCurrency = assets.find((item: any) => {
        return item.symbol === fullSymbol;
    });

    let withdrawBalance: any, fromAsset: any;

    if (balances) {
        balances.forEach((balance: any) => {
            if (balance && balance.toJS) {
                if (
                    withdrawalCurrency &&
                    balance.get("asset_type") == withdrawalCurrency.id
                ) {
                    withdrawBalance = balance;
                    withdrawalCurrencyBalanceId = balance.get("id");
                    withdrawalCurrencyBalance = balance.get("balance");
                }
            }
        });
    }

    if (!withdrawalCurrencyBalance) {
        //In case does not exist in balances
        withdrawalCurrencyBalance = 0;
    }

    if (preferredCurrency && selectedAsset) {
        let toAsset: any = null;

        assets.forEach((item: any) => {
            item = item.get ? item : Immutable.fromJS(item);
            if (item.get("id") == "1.3.0") coreAsset = item;
            if (item.get("symbol") == preferredCurrency) {
                toAsset = item;
                preferredCurrencyPrecision = item.get("precision");
            }
            if (item.get("symbol") == selectedGateway + "." + selectedAsset) {
                fromAsset = item;
                withdrawalCurrencyPrecision = item.get("precision");
            }
            if (item.get("symbol") == selectedAsset) {
                fromAsset = item;
                withdrawalCurrencyPrecision = item.get("precision");
            }
        });

        if (preferredCurrencyPrecision && withdrawalCurrencyPrecision) {
            precisionDifference =
                withdrawalCurrencyPrecision - preferredCurrencyPrecision;
        }

        if (quantity && fromAsset && toAsset) {
            estimatedValue =
                quantity *
                (MarketUtils as any).getFinalPrice(
                    coreAsset,
                    fromAsset,
                    toAsset,
                    marketStats,
                    true,
                    true
                );
            if (precisionDifference > 0) {
                //Need to compensate for different precisions between currencies
                estimatedValue =
                    estimatedValue * Math.pow(10, precisionDifference);
            } //No need to compensate for precision difference < 0
        }
    }

    if (
        Number.isFinite(withdrawalCurrencyBalance) &&
        withdrawalCurrencyPrecision
    ) {
        let withdrawalCurrencyBalanceString = String(withdrawalCurrencyBalance);
        let l = withdrawalCurrencyBalanceString.length;

        while (l < withdrawalCurrencyPrecision) {
            //Zero pad
            withdrawalCurrencyBalanceString =
                "0" + withdrawalCurrencyBalanceString;
            ++l;
        }

        let decimalPart = withdrawalCurrencyBalanceString.substr(
            0,
            l - withdrawalCurrencyPrecision
        );
        let mantissa = withdrawalCurrencyBalanceString.substr(
            l - withdrawalCurrencyPrecision
        );

        if (!decimalPart) {
            decimalPart = "0";
            mantissa = withdrawalCurrencyBalanceString;
        }

        convertedBalance = Number(decimalPart + "." + mantissa);
    }

    const nAvailableGateways = (_getNumberAvailableGateways as any).call({
        props: {backedCoins},
        state
    });
    const assetAndGateway = selectedAsset && selectedGateway;

    let isBTS = false;
    if (coreAsset) {
        if (selectedAsset == coreAsset.get("symbol")) isBTS = true;
    } else if (selectedAsset == "BTS") {
        isBTS = true;
    }

    const canCoverWithdrawal =
        quantity === 0
            ? true
            : (checkBalance as any)(
                  quantity,
                  fromAsset,
                  state.feeAmount,
                  withdrawBalance
              );

    const {fee_asset_types} = getAvailableAssets(btsAccount);
    return {
        withdrawalCurrency,
        withdrawalCurrencyId: withdrawalCurrency ? withdrawalCurrency.id : null,
        withdrawalCurrencyBalance,
        withdrawalCurrencyBalanceId,
        withdrawalCurrencyPrecision,
        preferredCurrencyPrecision,
        precisionDifference,
        coreAsset,
        convertedBalance,
        estimatedValue,
        nAvailableGateways,
        assetAndGateway,
        isBTS,
        canCoverWithdrawal,
        fee_asset_types
    };
}

function getBackingAssetProps(
    backedCoins: any,
    selectedGateway: string,
    selectedAsset: string
) {
    return backedCoins.get(selectedGateway.toUpperCase(), []).find((c: any) => {
        let backingCoin = c.backingCoinType || c.backingCoin;

        // Gateway has EOS.* asset names
        if (backingCoin.toUpperCase().indexOf("EOS.") !== -1) {
            const [, _coin] = backingCoin.split(".");
            backingCoin = _coin;
        }

        return backingCoin === selectedAsset;
    });
}

interface WithdrawModalCoreProps {
    account: any;
    assets: any;
    balances: any;
    backedCoins: any;
    intermediateAccounts: any[];
    initialSymbol?: string;
    visible?: boolean;
    modalId?: string;
    hideModal?: () => void;
    close?: () => void;
}

function WithdrawModalCore({
    account,
    assets,
    balances,
    backedCoins,
    intermediateAccounts,
    initialSymbol,
    visible,
    modalId,
    hideModal,
    close
}: WithdrawModalCoreProps) {
    const gatewayState = useAltStore<any>(GatewayStore as any);
    useAltStore<any>(AssetStore as any);
    const settingsState = useAltStore<any>(SettingsStore as any);
    const marketsState = useAltStore<any>(MarketsStore as any);
    const preferredCurrency = (SettingsStore as any).getSetting("unit");
    const marketStats = marketsState.allMarketStats;
    // `backedCoins` prop is passed straight through from the top-level
    // WithdrawModal (itself from GatewayStore) - kept for compatibility
    // with the assetGatewayMixin helpers below, which read `this.props
    // .backedCoins`.
    void gatewayState;
    void settingsState;

    const [state, setState] = React.useState<WithdrawState>(() => {
        const baseState = getInitialWithdrawState();
        const initialState: any = {};
        initialState.coinToGatewayMapping = (_getCoinToGatewayMapping as any).call(
            {props: {backedCoins}},
            gatewayBoolCheck
        );

        if (initialSymbol) {
            Object.assign(
                initialState,
                getAssetAndGatewayFromInitialSymbol(initialSymbol, backedCoins)
            );
            initialState.gatewayStatus = (getGatewayStatusByAsset as any).call(
                {props: {backedCoins}, state: baseState},
                initialState.selectedAsset,
                gatewayBoolCheck
            );
        }

        return {...baseState, ...initialState};
    });
    const mergeState = (patch: Partial<WithdrawState>) =>
        setState(prev => ({...prev, ...patch}));

    // The initial getAssetPairVariables merge (originally a *second*
    // this.setState call in UNSAFE_componentWillMount) - computed once,
    // synchronously, on the same first render (mirrors the original's
    // pre-paint timing: both setState calls in the constructor-adjacent
    // componentWillMount apply before the first paint).
    const didInitPairVarsRef = React.useRef(false);
    if (!didInitPairVarsRef.current) {
        didInitPairVarsRef.current = true;
        Object.assign(
            state,
            getAssetPairVariables(
                {assets, marketStats, balances, preferredCurrency},
                state,
                account,
                backedCoins
            )
        );
    }

    const validateAddressFn = (address: string) => {
        const {selectedGateway, gatewayStatus} = state;
        const backingAsset = getBackingAssetProps(
            backedCoins,
            selectedGateway,
            state.selectedAsset
        );

        (blocktradesValidateAddress as any)({
            url: gatewayStatus[selectedGateway].baseAPI.BASE,
            walletType: backingAsset.walletType,
            newAddress: address,
            output_coin_type: gatewayStatus[selectedGateway]
                .addressValidatorAsset
                ? state.selectedGateway.toLowerCase() +
                  "." +
                  state.selectedAsset.toLowerCase()
                : null,
            method:
                gatewayStatus[selectedGateway].addressValidatorMethod || null
        }).then((json: any) => {
            if (typeof json === "undefined") {
                json = {isValid: false};
            }

            mergeState({addressError: json.isValid ? false : true});
            mergeState({
                withdraw_publicKey: json.hasOwnProperty("publicKey")
                    ? json.publicKey
                    : "",
                withdraw_publicKey_not_empty: json.hasOwnProperty("publicKey")
                    ? true
                    : false
            });
        });
    };

    const onAddressSelected = (inputAddress: string) => {
        validateAddressFn(inputAddress);
        mergeState({address: inputAddress});
    };

    // Mirrors UNSAFE_componentWillReceiveProps: only fires on *prop*
    // changes (account/assets/balances/backedCoins/preferredCurrency/
    // marketStats/intermediateAccounts/initialSymbol), not on this
    // component's own state-driven re-renders. See file header.
    const prevExternalRef = React.useRef<any>(null);
    const isFirstExternalRenderRef = React.useRef(true);
    const currentExternal = {
        account,
        assets,
        balances,
        backedCoins,
        preferredCurrency,
        marketStats,
        intermediateAccounts,
        initialSymbol
    };
    if (isFirstExternalRenderRef.current) {
        isFirstExternalRenderRef.current = false;
    } else {
        const prev = prevExternalRef.current;
        const externalChanged =
            !prev ||
            prev.account !== currentExternal.account ||
            prev.assets !== currentExternal.assets ||
            prev.balances !== currentExternal.balances ||
            prev.backedCoins !== currentExternal.backedCoins ||
            prev.preferredCurrency !== currentExternal.preferredCurrency ||
            prev.marketStats !== currentExternal.marketStats ||
            prev.intermediateAccounts !== currentExternal.intermediateAccounts;
        if (externalChanged) {
            Object.assign(
                state,
                getAssetPairVariables(
                    {assets, marketStats, balances, preferredCurrency},
                    state,
                    account,
                    backedCoins
                )
            );

            if (state.address != "") {
                onAddressSelected(state.address);
            }

            if (prev && prev.initialSymbol !== currentExternal.initialSymbol) {
                const newState: any = getAssetAndGatewayFromInitialSymbol(
                    initialSymbol as string,
                    backedCoins
                );
                newState.gatewayStatus = (getGatewayStatusByAsset as any).call(
                    {props: {backedCoins}, state},
                    newState.selectedAsset,
                    gatewayBoolCheck
                );
                newState.address = "";
                newState.quantity = 0;
                mergeState(newState);
            }
        }
    }
    prevExternalRef.current = currentExternal;

    // Mirrors UNSAFE_componentWillUpdate's MarketsActions.getMarketStats
    // trigger, comparing against the previous render's values.
    const prevMarketTriggerRef = React.useRef<{
        preferredCurrency: any;
        selectedAsset: any;
        quantity: any;
    } | null>(null);
    {
        const trigger = {
            preferredCurrency,
            selectedAsset: state.selectedAsset,
            quantity: state.quantity
        };
        const prevTrigger = prevMarketTriggerRef.current;
        if (
            prevTrigger &&
            trigger.preferredCurrency &&
            trigger.selectedAsset &&
            trigger.quantity &&
            !(
                trigger.preferredCurrency === prevTrigger.preferredCurrency &&
                trigger.selectedAsset === prevTrigger.selectedAsset &&
                trigger.quantity === prevTrigger.quantity
            )
        ) {
            let toAsset: any = null;
            let fromAsset: any = null;
            const fullFromAssetSymbol =
                state.selectedGateway + "." + state.selectedAsset;

            assets.forEach((item: any) => {
                item = item.get ? item : Immutable.fromJS(item);
                if (item.get("symbol") === preferredCurrency) toAsset = item;
                if (item.get("symbol") === fullFromAssetSymbol)
                    fromAsset = item;
            });

            if (fromAsset && toAsset) {
                (MarketsActions as any).getMarketStats(
                    toAsset,
                    fromAsset,
                    true
                );
            }
        }
        prevMarketTriggerRef.current = trigger;
    }

    const onFeeChanged = (asset: any) => {
        mergeState({
            fee_asset_id: asset.asset_id,
            feeAmount: asset
        });
    };

    const onAssetSelected = (asset: any) => {
        // `_onAssetSelected` internally calls `this.setState({selectedAsset,
        // selectedGateway, gatewayStatus})` as a side effect (separate from
        // its return value, which only carries `{selectedAsset,
        // selectedGateway}`) - captured here via a fake `this` so the
        // `gatewayStatus` it computes (via `getGatewayStatusByAsset`,
        // itself mutating `this.state.gatewayStatus` in place) isn't lost,
        // matching how the original's two setState calls (this mixin's
        // internal one, and this function's own below) get shallow-merged
        // together by React.
        const capturedPatch: any = {};
        const mixinThis = {
            props: {backedCoins, balances, assets},
            state,
            setState: (patch: any) => {
                Object.assign(capturedPatch, patch);
            }
        };
        const {selectedAsset, selectedGateway} = (_onAssetSelected as any).call(
            mixinThis,
            asset.id,
            gatewayBoolCheck
        );
        const address = (WithdrawAddresses as any).getLast(
            asset.id.toLowerCase()
        );
        const nextState: WithdrawState = {
            ...state,
            ...capturedPatch,
            selectedAsset,
            selectedGateway,
            gateFee: asset.gateFee,
            address,
            isBTS: false
        };
        Object.assign(
            nextState,
            getAssetPairVariables(
                {assets, marketStats, balances, preferredCurrency},
                nextState,
                account,
                backedCoins
            )
        );
        setState(nextState);
        // Original's `this.setState(this._getAssetPairVariables(),
        // this.updateFee)` passed `this.updateFee` as the setState
        // callback - but `updateFee` is never actually defined anywhere
        // in that class, so `this.updateFee` was always `undefined`;
        // React silently skips a non-function setState callback, making
        // this a confirmed no-op. Dropped.
    };

    const onAssetChanged = (value: string) => {
        value = value.toUpperCase();

        let stateObj: any = {};

        if (value == "BTS") {
            stateObj = {isBTS: true};
        }

        if (!value) {
            stateObj = {
                selectedAsset: "",
                selectedGateway: "",
                addressError: false,
                fee: 0,
                isBTS: false
            };
        }

        stateObj.estimatedValue = 0;
        stateObj.tag = "";
        stateObj.memo = "";
        stateObj.address = "";

        mergeState(stateObj);
    };

    const updateGatewayFee = (fromState: WithdrawState = state) => {
        const {selectedGateway, selectedAsset} = fromState;
        let gateFee = 0;

        if (selectedGateway && selectedAsset) {
            backedCoins.get(selectedGateway).forEach((item: any) => {
                if (
                    item.symbol ===
                        [selectedGateway, selectedAsset].join(".") ||
                    item.backingCoinType === selectedAsset
                ) {
                    gateFee = item.gateFee || 0;
                }
            });
        }

        mergeState({gateFee});
    };

    const onGatewayChanged = (selectedGateway: string) => {
        const nextState = {...state, selectedGateway};
        Object.assign(
            nextState,
            getAssetPairVariables(
                {assets, marketStats, balances, preferredCurrency},
                nextState,
                account,
                backedCoins
            )
        );
        setState(nextState);
        updateGatewayFee(nextState);
    };

    const onQuantityChanged = (e: any) => {
        let input: any = null;
        if (parseFloat(e.target.value) == e.target.value) {
            input = e.target.value.trim();
        } else {
            let pasteValue = e.target.value.trim().replace(/[^\d.,-]/g, "");
            const decimal = pasteValue.match(/(\,\d{1,2})$/g);
            const decimalCount = decimal ? decimal.length : 0;
            if (decimal && decimalCount) {
                pasteValue = pasteValue.replace(",", ".");
            }
            input = parseFloat(pasteValue.replace(",", "")) || 0;
        }
        mergeState({quantity: Number(input)});
    };

    const onFocusAmount = (e: any) => {
        const {value} = e.target;

        if (String(value) == "0") {
            e.target.value = "";
        }
    };

    const onBlurAmount = (e: any) => {
        const {value} = e.target;

        if (value == "") {
            e.target.value = 0;
        }
    };

    // Don't validate address on change.
    // Validation is done when address is selected
    const onAddressChanged = (inputAddress: string) => {
        mergeState({address: inputAddress});
    };

    // Original also defined `onSelectedAddressChanged` and
    // `_renderStoredAddresses()` (a click list of previously-used
    // addresses) - confirmed dead, dropped: `_renderStoredAddresses` is
    // never called anywhere in `render()` (the inline `<Select>` above
    // already covers stored-address selection via `onAddressSelected`),
    // and `onSelectedAddressChanged` was itself only ever referenced from
    // inside that same dead method.

    const onMemoChanged = (e: any) => {
        mergeState({memo: e.target.value});
    };

    const onTagChanged = (e: any) => {
        mergeState({tag: e.target.value});
    };

    const onWithdrawPublicKeyChanged = (e: any) => {
        const new_withdraw_publicKey = e.target.value.trim();
        mergeState({
            withdraw_publicKey: new_withdraw_publicKey,
            withdraw_publicKey_not_empty:
                new_withdraw_publicKey != "" ? true : false
        });
    };

    const onClickAvailableBalance = (available: any) => {
        mergeState({quantity: Number(available)});
    };

    const onSubmit = () => {
        const {
            withdrawalCurrencyId,
            withdrawalCurrencyBalance,
            withdrawalCurrencyPrecision,
            quantity,
            withdrawalCurrency,
            selectedGateway,
            selectedAsset,
            address,
            isBTS,
            gateFee,
            tag,
            memo,
            btsAccount,
            feeAmount
        } = state;

        const gatewayStatus = state.gatewayStatus[selectedGateway];
        let assetName = !!gatewayStatus.assetWithdrawlAlias
            ? gatewayStatus.assetWithdrawlAlias[selectedAsset.toLowerCase()] ||
              selectedAsset.toLowerCase()
            : selectedAsset.toLowerCase();

        const intermediateAccountNameOrId = (getIntermediateAccount as any)(
            withdrawalCurrency.symbol,
            backedCoins
        );
        const intermediateAccount = intermediateAccounts.find((a: any) => {
            return (
                a &&
                (a.get("id") === intermediateAccountNameOrId ||
                    a.get("name") === intermediateAccountNameOrId)
            );
        });
        if (!intermediateAccount)
            throw new Error("Unable to find intermediateAccount");
        if (!(WithdrawAddresses as any).has(assetName)) {
            const withdrawals = [];
            withdrawals.push(address);
            (WithdrawAddresses as any).set({
                wallet: assetName,
                addresses: withdrawals
            });
        } else {
            const withdrawals = (WithdrawAddresses as any).get(assetName);
            if (withdrawals.indexOf(address) == -1) {
                withdrawals.push(address);
                (WithdrawAddresses as any).set({
                    wallet: assetName,
                    addresses: withdrawals
                });
            }
        }
        (WithdrawAddresses as any).setLast({wallet: assetName, address});

        let sendAmount = new (Asset as any)({
            asset_id: withdrawalCurrencyId,
            precision: withdrawalCurrencyPrecision,
            real: quantity
        });

        let balanceAmount = new (Asset as any)({
            asset_id: withdrawalCurrencyId,
            precision: withdrawalCurrencyPrecision,
            real: 0
        });

        if (withdrawalCurrencyBalance != null) {
            balanceAmount = sendAmount.clone(withdrawalCurrencyBalance);
        }

        const gateFeeAmount = new (Asset as any)({
            asset_id: withdrawalCurrencyId,
            precision: withdrawalCurrencyPrecision,
            real: gateFee
        });

        sendAmount.plus(gateFeeAmount);

        /* Insufficient balance */
        if (balanceAmount.lt(sendAmount)) {
            sendAmount = balanceAmount;
        }

        let descriptor: any = "";
        let to = "";

        if (isBTS) {
            descriptor = memo ? new Buffer(memo, "utf-8") : "";
            to = btsAccount.get("id");
        } else {
            assetName = gatewayStatus.useFullAssetName
                ? selectedGateway.toLowerCase() + "." + assetName
                : assetName;
            descriptor =
                assetName +
                ":" +
                address +
                (state.withdraw_publicKey_not_empty
                    ? ":" + state.withdraw_publicKey
                    : "") +
                (tag ? ":tag:" + new Buffer(tag, "utf-8") : "") +
                (memo ? ":" + new Buffer(memo, "utf-8") : "");
            to = intermediateAccount.get("id");
        }

        const args = [
            account.get("id"),
            to,
            sendAmount.getAmount(),
            withdrawalCurrencyId,
            descriptor,
            null,
            feeAmount ? feeAmount.asset_id : "1.3.0"
        ];

        (AccountActions as any).transfer(...args).then(() => {
            if (hideModal) hideModal();
        });
    };

    const onBTSAccountNameChanged = (btsAccountName: string) => {
        if (!btsAccountName) mergeState({btsAccount: null});
        mergeState({btsAccountName, btsAccountError: null});
    };

    const onBTSAccountChanged = (btsAccount: any) => {
        mergeState({btsAccount, btsAccountError: null});
    };

    const handleQrScanSuccess = (data: any) => {
        // if user don't put quantity on field by himself
        // use amount detected on QR code
        if (!state.quantity) {
            mergeState({
                address: data.address,
                quantity: data.amount
            });
        } else {
            mergeState({
                address: data.address
            });
        }

        onAddressSelected(data.address);
    };

    const {
        selectedAsset,
        selectedGateway,
        gatewayStatus,
        addressError,
        withdrawalCurrencyBalanceId,
        convertedBalance,
        nAvailableGateways,
        assetAndGateway,
        isBTS,
        canCoverWithdrawal,
        quantity,
        address,
        btsAccount,
        coinToGatewayMapping
    } = state;
    const symbolsToInclude: string[] = [];

    // Get Backing Asset for Gateway
    const backingAsset = getBackingAssetProps(
        backedCoins,
        selectedGateway,
        selectedAsset
    );

    let minWithdraw: any = null;
    let maxWithdraw: any = null;
    if (backingAsset && backingAsset.minAmount) {
        minWithdraw = !!backingAsset.precision
            ? (utils as any).format_number(
                  backingAsset.minAmount /
                      (utils as any).get_asset_precision(
                          backingAsset.precision
                      ),
                  backingAsset.precision,
                  false
              )
            : backingAsset.minAmount;
    } else if (backingAsset) {
        minWithdraw =
            "gateFee" in backingAsset
                ? backingAsset.gateFee * 2 ||
                  0 + backingAsset.transactionFee ||
                  0
                : 0;
    }

    if (backingAsset && backingAsset.maxAmount) {
        maxWithdraw = backingAsset.maxAmount;
    }

    balances.forEach((item: any) => {
        const id = item.get("asset_type");
        const asset = assets.get(id);

        if (asset && item.get("balance") > 0) {
            const [_gateway, _asset] = asset.symbol.split(".");
            const find = !!_asset ? _asset : _gateway;
            symbolsToInclude.push(find);
        }
    });

    const onFocus = onFocusAmount;
    const onBlur = onBlurAmount;

    const shouldDisable = isBTS
        ? !quantity || !btsAccount
        : !assetAndGateway ||
          !quantity ||
          !address ||
          !canCoverWithdrawal ||
          addressError ||
          quantity < minWithdraw;

    const storedAddresses = (WithdrawAddresses as any).get(
        selectedAsset.toLowerCase()
    );

    const maxAvailable =
        convertedBalance && state.withdrawalCurrency
            ? new (Asset as any)({
                  real: convertedBalance,
                  asset_id: state.withdrawalCurrency.id,
                  precision: state.withdrawalCurrency.precision
              })
            : new (Asset as any)({
                  amount: 0,
                  asset_id: state.withdrawalCurrency
                      ? state.withdrawalCurrency.id
                      : undefined
              });
    if (state.feeAmount.asset_id === maxAvailable.asset_id) {
        maxAvailable.minus(state.feeAmount);
    }

    return (
        <Modal
            title={counterpart.translate("modal.withdraw.header")}
            visible={!!visible}
            wrapClassName={modalId}
            onCancel={hideModal}
            footer={[
                <Button
                    key={"submit"}
                    onClick={onSubmit}
                    disabled={shouldDisable}
                >
                    {counterpart.translate("modal.withdraw.withdraw")}
                </Button>,
                <Button key={"cancel"} onClick={close}>
                    {counterpart.translate("modal.withdraw.cancel")}
                </Button>
            ]}
        >
            <div className="grid-block vertical no-overflow">
                <div className="modal__body" style={{paddingTop: 0}}>
                    <div style={{marginBottom: "1em"}}>
                        {/*ASSET SELECTION*/}
                        <DepositWithdrawAssetSelector
                            onSelect={onAssetSelected}
                            onChange={onAssetChanged}
                            include={symbolsToInclude}
                            selectOnBlur
                            defaultValue={selectedAsset}
                            includeBTS={false}
                            usageContext="withdraw"
                        />
                    </div>

                    {!isBTS && selectedAsset && !selectedGateway ? (
                        <Translate content="modal.withdraw.no_gateways" />
                    ) : null}

                    {/*GATEWAY SELECTION*/}
                    <div style={{marginBottom: "1em"}}>
                        {selectedGateway
                            ? (gatewaySelector as any).call(
                                  {props: {backedCoins}},
                                  {
                                      selectedGateway,
                                      gatewayStatus,
                                      nAvailableGateways,
                                      availableGateways:
                                          coinToGatewayMapping[selectedAsset],
                                      error: false,
                                      onGatewayChanged,
                                      selectedAsset,
                                      balances,
                                      assets
                                  }
                              )
                            : null}
                    </div>

                    {/*QUANTITY*/}
                    {assetAndGateway || isBTS ? (
                        <div style={{marginBottom: "1em"}}>
                            {preferredCurrency ? (
                                <div
                                    style={{
                                        fontSize: "0.8em",
                                        float: "right"
                                    }}
                                >
                                    <Translate content="modal.withdraw.available" />
                                    <span
                                        style={{
                                            color: canCoverWithdrawal
                                                ? undefined
                                                : "red",
                                            cursor: "pointer",
                                            textDecoration: "underline"
                                        }}
                                        onClick={() =>
                                            onClickAvailableBalance(
                                                maxAvailable.getAmount({
                                                    real: true
                                                })
                                            )
                                        }
                                    >
                                        {/*Some currencies do not appear in balances, display zero balance if not found*/}
                                        {withdrawalCurrencyBalanceId ? (
                                            <BalanceComponent
                                                balance={
                                                    withdrawalCurrencyBalanceId
                                                }
                                            />
                                        ) : (
                                            <span>
                                                0.00{" "}
                                                <FormattedAsset
                                                    hide_amount
                                                    amount={0}
                                                    asset={
                                                        maxAvailable.asset_id
                                                    }
                                                />
                                            </span>
                                        )}
                                    </span>
                                </div>
                            ) : null}
                            <label className="left-label">
                                <Translate content="modal.withdraw.quantity" />
                            </label>
                            <ExchangeInput
                                value={quantity ? quantity : ""}
                                onChange={onQuantityChanged}
                                onFocus={onFocus}
                                onBlur={onBlur}
                                allowNaN={true}
                                placeholder={counterpart.translate(
                                    "gateway.limit_withdraw_asset",
                                    {
                                        min: !minWithdraw ? 0 : minWithdraw,
                                        max: !maxWithdraw
                                            ? counterpart.translate(
                                                  "gateway.limit_withdraw_asset_none"
                                              )
                                            : maxWithdraw
                                    }
                                )}
                            />
                            {canCoverWithdrawal &&
                            minWithdraw &&
                            quantity &&
                            +quantity < +minWithdraw ? (
                                <Translate
                                    component="div"
                                    className="error-msg"
                                    style={{
                                        position: "absolute",
                                        right: 0,
                                        textTransform: "uppercase",
                                        fontSize: 13
                                    }}
                                    content="gateway.limit_withdraw_asset_min"
                                    min={minWithdraw}
                                    coin={selectedGateway + "." + selectedAsset}
                                />
                            ) : null}
                            {canCoverWithdrawal &&
                            maxWithdraw &&
                            quantity &&
                            +quantity > +maxWithdraw ? (
                                <Translate
                                    component="div"
                                    className="error-msg"
                                    style={{
                                        position: "absolute",
                                        right: 0,
                                        textTransform: "uppercase",
                                        fontSize: 13
                                    }}
                                    content="gateway.limit_withdraw_asset_max"
                                    max={maxWithdraw}
                                    coin={selectedGateway + "." + selectedAsset}
                                />
                            ) : null}
                            {(assetAndGateway || isBTS) &&
                            !canCoverWithdrawal ? (
                                <Translate
                                    content="modal.withdraw.cannot_cover"
                                    component="div"
                                    className="error-msg"
                                    style={{
                                        position: "absolute",
                                        right: 0,
                                        textTransform: "uppercase",
                                        fontSize: 13
                                    }}
                                />
                            ) : null}
                        </div>
                    ) : null}

                    {/*ESTIMATED VALUE*/}
                    {/*
                (assetAndGateway || quantity) && !isBTS ?
                <div>
                <label className="left-label"><Translate content="modal.withdraw.estimated_value" /> ({preferredCurrency})</label>
                <ExchangeInput value={userEstimate != null ? userEstimate : estimatedValue} onChange={this.onEstimateChanged.bind(this)} onFocus={onFocus} onBlur={onBlur} />
                </div> :
                null
            */}

                    {/*WITHDRAW ADDRESS*/}
                    {assetAndGateway && !isBTS ? (
                        <div style={{marginBottom: "1em"}}>
                            <label className="left-label">
                                <Translate
                                    component="span"
                                    content="modal.withdraw.address"
                                />
                            </label>
                            {addressError ? (
                                <div
                                    className="has-error"
                                    style={{
                                        position: "absolute",
                                        right: "1em",
                                        marginTop: "-30px"
                                    }}
                                >
                                    <Translate content="modal.withdraw.address_not_valid" />
                                </div>
                            ) : null}
                            <div>
                                <div className="inline-label">
                                    <Select
                                        showSearch
                                        style={{width: "100%"}}
                                        value={address}
                                        onSearch={onAddressChanged}
                                        onSelect={value =>
                                            onAddressSelected(value as string)
                                        }
                                    >
                                        {address &&
                                        storedAddresses.indexOf(address) ==
                                            -1 ? (
                                            <Select.Option value={address}>
                                                {address}
                                            </Select.Option>
                                        ) : null}
                                        {storedAddresses.map((addr: string) => (
                                            <Select.Option
                                                key={addr}
                                                value={addr}
                                            >
                                                {addr}
                                            </Select.Option>
                                        ))}
                                    </Select>
                                    <span>
                                        <QRScanner
                                            label="Scan"
                                            onSuccess={handleQrScanSuccess}
                                            submitBtnText={counterpart.translate(
                                                "qr_address_scanner.use_address"
                                            )}
                                            dataFoundText={
                                                counterpart.translate(
                                                    "qr_address_scanner.address_found"
                                                ) + ":"
                                            }
                                        />
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {isBTS ? (
                        <div style={{marginBottom: "1em"}}>
                            <AccountSelector
                                label="transfer.to"
                                accountName={state.btsAccountName}
                                onChange={onBTSAccountNameChanged}
                                onAccountChanged={onBTSAccountChanged}
                                account={state.btsAccountName}
                                size={60}
                                error={state.btsAccountError}
                            />
                        </div>
                    ) : null}

                    {/*PUBLIC key - custom field (PRIZM) */}
                    {backingAsset &&
                    backingAsset.supportsPublicKey !== undefined ? (
                        <div style={{marginBottom: "1em"}}>
                            <label className="left-label">
                                <Translate content="modal.withdraw.public_key" />
                            </label>
                            {
                                <Input.TextArea
                                    value={state.withdraw_publicKey}
                                    onChange={onWithdrawPublicKeyChanged}
                                    onInput={onWithdrawPublicKeyChanged}
                                />
                            }
                        </div>
                    ) : null}

                    {/*TAG*/}
                    {isBTS ||
                    (backingAsset && backingAsset.memoType === "tagid") ? (
                        <div style={{marginBottom: "1em"}}>
                            <label className="left-label">
                                <Translate content="modal.withdraw.tag" />
                            </label>
                            <Input.TextArea
                                value={state.tag}
                                onChange={onTagChanged}
                            />
                        </div>
                    ) : null}

                    {/*MEMO*/}
                    {isBTS || (backingAsset && backingAsset.supportsMemos) ? (
                        <div style={{marginBottom: "1em"}}>
                            <label className="left-label">
                                <Translate content="modal.withdraw.memo" />
                            </label>
                            <Input.TextArea
                                value={state.memo}
                                onChange={onMemoChanged}
                            />
                        </div>
                    ) : null}

                    {/*FEE & GATEWAY FEE*/}
                    {assetAndGateway || isBTS ? (
                        <div className="grid-block no-overflow wrap shrink">
                            <div
                                className="small-12 medium-6 withdraw-fee-selector"
                                style={{paddingRight: 5}}
                            >
                                <FeeAssetSelector
                                    account={account}
                                    transaction={{
                                        type: "transfer",
                                        options: ["price_per_kbyte"],
                                        data: {
                                            type: "memo",
                                            content:
                                                state.selectedAsset.toLowerCase() +
                                                ":" +
                                                state.address +
                                                (state.tag
                                                    ? ":" + state.tag
                                                    : "") +
                                                (state.memo
                                                    ? ":" + state.memo
                                                    : "")
                                        }
                                    }}
                                    onChange={onFeeChanged}
                                />
                            </div>
                            <div className="small-12 medium-6 ant-form-item-label withdraw-fee-selector">
                                <label className="amount-selector-field--label">
                                    <Translate content="gateway.fee" />
                                </label>
                                <div className="grid-block no-overflow wrap shrink">
                                    <ExchangeInput
                                        placeholder="0.0"
                                        id="baseMarketFee"
                                        value={
                                            !!backingAsset &&
                                            "gateFee" in backingAsset
                                                ? backingAsset.gateFee
                                                : 0
                                        }
                                        disabled
                                        addonAfter={
                                            <span>
                                                <AssetName
                                                    noTip
                                                    name={backingAsset.symbol}
                                                />
                                            </span>
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </Modal>
    );
}

interface WithdrawModalAccountContainerProps {
    backedCoins: any;
    intermediateAccounts: any[];
    initialSymbol?: string;
    visible?: boolean;
    modalId?: string;
    hideModal?: () => void;
    close?: () => void;
}

function WithdrawModalAccountContainer(
    props: WithdrawModalAccountContainerProps
) {
    useChainStoreTick();
    const accountState = useAltStore<any>(AccountStore as any);
    const currentAccountName = accountState.currentAccount;
    const account = currentAccountName
        ? (ChainStore as any).getAccount(currentAccountName)
        : undefined;

    // Matches BindToChainState's fallback for an unresolved *required*
    // prop when `options.show_loader` isn't set (it wasn't, for this
    // wrapper chain): render an inert placeholder until it resolves.
    if (!account) return <span />;

    const balancesMap = account.get("balances");
    let assets: any = Immutable.fromJS({});
    balancesMap.forEach((_balanceId: any, assetId: any) => {
        try {
            const asset = (ChainStore as any).getAsset(assetId).toJS();
            assets = assets.set(assetId, asset);
        } catch (e) {}
    });

    props.backedCoins.forEach((gateway: any) => {
        gateway.forEach((coin: any) => {
            if (coin.withdrawalAllowed) {
                try {
                    const asset = (ChainStore as any)
                        .getAsset(coin.symbol)
                        .toJS();
                    if (!assets.has(asset.id))
                        assets = assets.set(asset.id, asset);
                } catch (e) {}
            }
        });
    });

    const balances: any[] = [];
    balancesMap.forEach((balanceId: any) => {
        if (balanceId) {
            const obj = (ChainStore as any).getObject(balanceId);
            if (obj) balances.push(obj);
        }
    });

    return (
        <WithdrawModalCore
            account={account}
            assets={assets}
            balances={balances}
            backedCoins={props.backedCoins}
            intermediateAccounts={props.intermediateAccounts}
            initialSymbol={props.initialSymbol}
            visible={props.visible}
            modalId={props.modalId}
            hideModal={props.hideModal}
            close={props.close}
        />
    );
}

export default function WithdrawModal({
    backedCoins,
    modalId,
    hideModal,
    visible,
    initialSymbol
}: {
    backedCoins: any;
    modalId?: string;
    hideModal?: () => void;
    // Accepted but unused, matching the original: `showModal` is never
    // read anywhere in WithdrawModalNew.jsx (grepped), even though
    // NextShellContainer.tsx passes one (mirroring the sibling
    // DepositModal's prop shape, which does use it).
    showModal?: () => void;
    visible?: boolean;
    initialSymbol?: string;
}) {
    useChainStoreTick();
    // Original also computed `withdrawAssets` here via repeated
    // `Immutable.List().push(...)` calls whose results were never
    // reassigned (`Immutable.List` is persistent/immutable - `.push()`
    // returns a *new* list rather than mutating in place) - preserved
    // verbatim, not "fixed": `withdrawAssets` was always an empty list in
    // the original too. It's also never actually read anywhere
    // downstream (grepped `WithdrawModalWrapper`/`WithdrawModalNew`), so
    // it isn't threaded through this port at all.
    const intermediateAccounts: any[] = [];
    backedCoins.forEach((gateway: any) => {
        gateway.forEach((coin: any) => {
            if (coin.withdrawalAllowed) {
                const withdrawAccount = (getIntermediateAccount as any)(
                    coin.symbol,
                    backedCoins
                );
                if (
                    withdrawAccount &&
                    intermediateAccounts.indexOf(withdrawAccount) === -1
                )
                    intermediateAccounts.push(withdrawAccount);
            }
        });
    });

    const resolvedIntermediateAccounts: any[] = [];
    intermediateAccounts.forEach(idOrName => {
        const obj = (ChainStore as any).getAccount(idOrName);
        if (obj) resolvedIntermediateAccounts.push(obj);
    });

    return (
        <WithdrawModalAccountContainer
            backedCoins={backedCoins}
            intermediateAccounts={resolvedIntermediateAccounts}
            initialSymbol={initialSymbol}
            visible={visible}
            modalId={modalId}
            hideModal={hideModal}
            close={hideModal}
        />
    );
}
