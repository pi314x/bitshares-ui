// TypeScript/functional-component port of the legacy
// SimpleDepositBlocktradesBridge.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md,
// `Dashboard/` batch 2). Mechanical class-to-hooks translation; every
// judgment call is documented below.
//
// Not security-sensitive in the direct sense per AGENTS.md: grepped for
// `AccountActions.transfer`/`WalletDb`/`.add_type_operation`/
// `process_transaction`/signing calls - none appear anywhere in this file.
// It only requests/displays a gateway deposit address and shows estimated
// bridge-conversion amounts. Every `console.log`/`console.error` call is
// preserved verbatim (logs error objects/API responses only, no secrets).
//
// `class SimpleDepositBlocktradesBridge extends React.Component` is a
// plain, real base (unlike `SimpleDepositWithdraw.jsx`'s live
// `DecimalChecker` extension or the outer `SimpleDepositWithdrawModal`'s
// dead `extends React.Component` pattern) - nothing extends-specific to
// port here.
//
// **`BindToChainState` -> Container translation**: `propTypes` are
// `sender: ChainTypes.ChainAccount.isRequired`,
// `asset: ChainTypes.ChainAsset.isRequired` - both required, no
// not-required `balance`-style case, no dead `coreAsset`/`globalObject`
// gating props (unlike `SimpleDepositWithdraw.jsx`). `
// SimpleDepositBlocktradesBridgeContainer` below replicates
// `BindToChainState`'s resolution (`ChainStore.getAccount`/`getAsset`,
// plus `useChainStoreTick()`) and its "don't render until every required
// chain prop has resolved" fallback (`options.show_loader` wasn't passed
// in the original, so the fallback is a bare `<span />`) - same
// established pattern as `Modal/WithdrawModalNew.tsx`'s
// `WithdrawModalAccountContainer` and `SimpleDepositWithdraw.tsx`'s own
// Container (this batch's sibling file).
//
// A subtle, genuine pre-existing bug in the constructor, preserved in
// *effect* but not litereally reproducible in a function component: the
// original's `constructor(props) { super(); ... inputCoinType:
// props.inputCoinType || this.props.preferredBridge, ... }` calls
// `super()` WITHOUT `props` - meaning `this.props` is `undefined` inside
// the constructor (a well-known React footgun) until React assigns it
// after the constructor returns. Referencing `this.props.preferredBridge`
// there would throw `TypeError: Cannot read properties of undefined
// (reading 'preferredBridge')` - UNLESS `props.inputCoinType` (the
// constructor's own parameter, unaffected by the `super()` bug) is
// already truthy, short-circuiting the `||` before `this.props` is ever
// touched. Grepped the real call chain: `StoreWrapper` (below) always
// spreads `...currentBridge.toJS()` onto this component's props *after*
// its own `inputCoinType`, so by the time `SimpleDepositBlocktradesBridge`
// actually mounts, `props.inputCoinType` is always already set and the
// crash path is never actually reached - but it is a latent landmine in
// the original (any future caller that omits an `inputCoinType`-bearing
// bridge object would crash). Function components have no equivalent
// "props not yet assigned" phase to replicate - `props` is simply the
// function's own argument throughout - so this port computes
// `inputCoinType: props.inputCoinType || props.preferredBridge` using the
// real, always-valid `props` both times, which behaves identically to the
// original for every real call path (the only one that exists) while
// removing a bug that could never manifest in hooks form anyway.
//
// The constructor's `this.deposit_address_cache = new
// BlockTradesDepositAddressCache();` (a persistent instance across
// renders) becomes a lazily-initialized `useRef`, the same established
// pattern already used for the very same class in
// `Modal/DepositModal.tsx` (`depositAddressCacheRef`). The constructor's
// own synchronous `this._validateAddress(this.state.toAddress, props)`
// call becomes a mount-only effect validating the lazily-computed initial
// `toAddress`, same treatment as `SimpleDepositWithdraw.tsx`.
//
// `onClose()` is grep-confirmed dead: defined but never bound to any
// `onClick`/similar anywhere in this file, and no ref-based external
// caller exists either. Dropped entirely.
//
// **Lifecycle side effects** (the trickiest part of this port -
// `UNSAFE_componentWillMount`/`componentDidMount`/
// `UNSAFE_componentWillReceiveProps`/`shouldComponentUpdate` all embed
// real side effects, not pure performance guards):
// - `UNSAFE_componentWillMount() { this._getDepositAddress(this.props); }`
//   and `componentDidMount() { this._getDepositLimit(this.props);
//   this._estimateOutput(this.props); }` are folded into ONE mount-only
//   effect (same "WillMount + DidMount both fire once on mount, only their
//   relative pre/post-first-render timing differs, which is immaterial
//   here since neither affects the first paint synchronously" reasoning
//   already used for `SimpleDepositWithdraw.tsx`), calling
//   `_getDepositAddress`, then `_getDepositLimit`, then `_estimateOutput`,
//   preserving the original relative call order across both methods.
// - `UNSAFE_componentWillReceiveProps(np)` (fires `_getDepositLimit(np)`/
//   `_estimateOutput(np)`/`_getDepositAddress(np)` and
//   `this.setState({inputCoinType: np.inputCoinType, outputCoinType:
//   np.outputCoinType})` whenever `np.inputCoinType`/`.outputCoinType`
//   differ from `this.props`'s current values) becomes a mount-skip
//   `useEffect` keyed on `[props.inputCoinType, props.outputCoinType]`.
// - `shouldComponentUpdate(np, ns)` has a real embedded side effect
//   (`this._getDepositLimit(ns); this._estimateOutput(ns);
//   this._getDepositAddress(ns);`, fired whenever
//   `this.state.inputCoinType`/`.outputCoinType` differ from the PENDING
//   next state `ns`) that is independent of, and in addition to,
//   `UNSAFE_componentWillReceiveProps`'s own three calls - both are kept
//   as two SEPARATE effects (per the task's explicit instruction), the
//   second one a mount-skip `useEffect` keyed on `[state.inputCoinType,
//   state.outputCoinType]`. `shouldComponentUpdate`'s own boolean return
//   (`np.inputCoinType !== this.props.inputCoinType || ... ||
//   !utils.are_equal_shallow(ns, this.state)`) is a pure re-render gate,
//   dropped per this migration's established rule.
// - **A carefully-verified, genuine pre-existing quirk in
//   `_estimateOutput()`/`_estimateInput()`**: unlike `_getDepositLimit(data)`/
//   `_getDepositAddress(data)` (which both take a `data` argument and read
//   `inputCoinType`/`outputCoinType` FROM it), `_estimateOutput()`/
//   `_estimateInput()` take NO parameter at all and always read
//   `this.state` directly - so every call site that "passes" `this.props`,
//   `np`, or `ns` to them (componentDidMount, WRC, SCU) is silently
//   ignored; they always read whatever `this.state` currently holds. Since
//   `this.state` in a class component is never updated synchronously
//   within the same method invocation that just called `this.setState(...)`
//   (React batches the commit), every WRC/SCU call to
//   `_estimateOutput()`/`_estimateInput()` actually reads the OLD (pre-
//   update) `inputAmount`/`inputCoinType`/`outputCoinType`, not the
//   just-`setState`'d new coin types - a real, if obscure, staleness bug,
//   preserved here (not "fixed") via an optional `src` parameter on both
//   functions that DEFAULTS to the ambient, this-render's `state` closure
//   (a function component's `state` never updates mid-render either,
//   matching `this.state`'s pre-commit-read behavior exactly for these
//   default-argument call sites). The one place `_estimateOutput`/
//   `_estimateInput` DOES need the freshly-committed value -
//   `_onAmountChange`'s `this.setState({inputAmount: value},
//   this._estimateOutput.bind(this))` (a genuine setState 2nd-argument
//   callback, guaranteed to run AFTER the commit, unlike the synchronous
//   WRC/SCU calls) - explicitly passes `stateRef.current` (this file's
//   `mergeState` mirrors `state` into `stateRef.current` SYNCHRONOUSLY,
//   same convention as `SimpleDepositWithdraw.tsx`/`Utility/
//   FeeAssetSelector.tsx`), reproducing the "fresh, post-commit" read a
//   true setState callback gets. One small, explicitly-documented,
//   unavoidable divergence: `shouldComponentUpdate`'s mirroring effect
//   (keyed on `[state.inputCoinType, state.outputCoinType]`) necessarily
//   runs on a LATER render than the WRC-mirroring effect's own
//   `mergeState`, so by the time it fires, the ambient `state` closure it
//   reads via `_estimateOutput()`'s default argument already reflects the
//   NEW coin types (in the original, `shouldComponentUpdate` runs before
//   ANY commit, so `this.state` is stale there too) - hooks provide no
//   equivalent of "read state before this render's own commit" across two
//   independently-keyed effects reacting to the same underlying change.
//   This does not change final displayed behavior: both effects still
//   fire, both still call `_getDepositLimit`/`_getDepositAddress` with the
//   correct new coin types, and `_estimateOutput`/`_estimateInput`'s own
//   `.then()` handler always ends up calling `mergeState` again with
//   authoritative, freshly-fetched values regardless of which snapshot
//   triggered the request.
// - `componentDidUpdate() { ReactTooltip.rebuild(); }` runs
//   unconditionally on every update - becomes a mount-skip `useEffect`
//   with NO dependency array, same treatment as `SimpleDepositWithdraw.tsx`
//   and `Modal/BorrowModal.tsx`.
//
// `_getDepositAddress(data)`'s `let receive_address;` is declared but
// never assigned (the caching branch that would assign it is entirely
// commented out - "Always generate new address/memo for increased
// security") - so `if (!receive_address)` is ALWAYS true and the `else`
// branch is permanently dead, a genuine pre-existing quirk (deliberately
// disabled caching), preserved verbatim, not simplified away.
//
// **`StoreWrapper` translation**: the original's
// `connect(StoreWrapper, {listenTo: [SettingsStore], getProps() {...}})`
// is replaced by `useAltStore(SettingsStore)` in
// `SimpleDepositBlocktradesBridgeContainer` below (folded into the same
// Container as the chain-state resolution, mirroring
// `SimpleDepositWithdraw.tsx`'s own combined Container). `currentBridge`
// is picked from `props.bridges` (an Immutable Map of gateway-name ->
// bridge-info Map, passed down from whichever caller supplies `bridges` -
// `Exchange/Exchange.tsx` passes `bridgeCoins.get(...)`,
// `Account/AccountPortfolioList.tsx` passes `currentBridges`), falling
// back to `props.bridges.first()` if the SettingsStore-derived preferred
// bridge isn't present in it, exactly as the original - then
// `currentBridge.toJS()` is spread as additional props into
// `SimpleDepositBlocktradesBridge`, same override order as the original
// (`{...others} {preferredBridge} {...currentBridge.toJS()}`, spread
// last-wins).
//
// `export default class SimpleDepositBlocktradesBridgeModal`: trivial -
// `if (!this.props.bridges) return null;` then renders `<Modal>` wrapping
// the Container/`StoreWrapper` chain. No internal state, no lifecycle
// methods beyond `render()` - transcribed as a plain function component.
import * as React from "react";
import Translate from "react-translate-component";
import utils from "common/utils";
import ReactTooltip from "react-tooltip";
import counterpart from "counterpart";
import {
    requestDepositAddress,
    validateAddress,
    WithdrawAddresses,
    getDepositLimit,
    estimateOutput,
    estimateInput
} from "common/gatewayMethods";
import BlockTradesDepositAddressCache from "common/BlockTradesDepositAddressCache";
import CopyButton from "../Utility/CopyButton";
import LoadingIndicator from "../LoadingIndicator";
import {blockTradesAPIs} from "api/apiConfig";
import SettingsStore from "stores/SettingsStore";
import SettingsActions from "actions/SettingsActions";
import QRCode from "qrcode.react";
import {
    Form,
    Modal,
    Button,
    Tooltip,
    Input,
    Select
} from "bitshares-ui-style-guide";
import {ChainStore} from "bitsharesjs";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface SimpleDepositBlocktradesBridgeProps {
    sender: any;
    asset: any;
    bridges: any;
    preferredBridge?: string;
    inputCoinType?: string;
    outputCoinType?: string;
    walletType?: string;
    hideModal?: () => void;
    isDown?: boolean;
    isAvailable?: boolean;
    modalId?: string;
    open?: boolean;
    [key: string]: any;
}

interface SimpleDepositBlocktradesBridgeState {
    inputCoinType: string;
    outputCoinType: string;
    receiveAmount: number;
    depositLimit: any;
    sendAmount: number | string;
    toAddress: string;
    withdrawValue: string;
    amountError: string | null;
    inputAmount: number | string;
    outputAmount?: number | string;
    receiveLoading: boolean;
    limitLoading: boolean;
    apiError: boolean;
    receive_address?: any;
    withdraw_address_check_in_progress?: boolean;
    validAddress?: boolean | null;
}

function getInitialState(
    props: SimpleDepositBlocktradesBridgeProps
): SimpleDepositBlocktradesBridgeState {
    return {
        inputCoinType: props.inputCoinType || (props.preferredBridge as string),
        outputCoinType: props.outputCoinType as string,
        receiveAmount: 0,
        depositLimit: 0,
        sendAmount: 0,
        toAddress: WithdrawAddresses.getLast(props.walletType),
        withdrawValue: "",
        amountError: null,
        inputAmount: 0,
        receiveLoading: false,
        limitLoading: true,
        apiError: false
    };
}

function SimpleDepositBlocktradesBridge(
    props: SimpleDepositBlocktradesBridgeProps
) {
    const [state, setState] = React.useState<
        SimpleDepositBlocktradesBridgeState
    >(() => getInitialState(props));
    const stateRef = React.useRef(state);
    const mergeState = (
        patch: Partial<SimpleDepositBlocktradesBridgeState>
    ) => {
        setState(prev => {
            const next = {...prev, ...patch};
            stateRef.current = next;
            return next;
        });
    };

    const depositAddressCacheRef = React.useRef<any>(null);
    if (!depositAddressCacheRef.current) {
        depositAddressCacheRef.current = new (BlockTradesDepositAddressCache as any)();
    }

    function _getDepositObject(data: {
        inputCoinType: string;
        outputCoinType: string;
    }) {
        const {inputCoinType, outputCoinType} = data;
        return {
            inputCoinType: inputCoinType.toLowerCase(),
            outputCoinType: outputCoinType.toLowerCase(),
            outputAddress: props.sender.get("name"),
            url: blockTradesAPIs.BASE,
            stateCallback: (receive_address: any) => {
                addDepositAddress(
                    inputCoinType.toLowerCase(),
                    outputCoinType.toLowerCase(),
                    props.sender.get("name"),
                    receive_address
                );
            }
        };
    }

    function _getDepositAddress(data: {
        inputCoinType: string;
        outputCoinType: string;
    }) {
        // Always undefined: the caching branch that would assign this is
        // entirely commented out in the original ("Always generate new
        // address/memo for increased security"), so `if (!receive_address)`
        // is always true and the `else` branch is permanently dead -
        // preserved verbatim.
        let receive_address;

        if (!receive_address) {
            mergeState({receive_address: null});
            (requestDepositAddress as any)(_getDepositObject(data));
        } else {
            mergeState({receive_address});
        }
    }

    function _getDepositLimit(data: {
        inputCoinType: string;
        outputCoinType: string;
    }) {
        const {inputCoinType, outputCoinType} = data;

        mergeState({limitLoading: true});
        getDepositLimit(inputCoinType.toLowerCase(), outputCoinType.toLowerCase())
            .then((res: any) => {
                mergeState({
                    depositLimit: res.depositLimit,
                    limitLoading: false
                });
            })
            .catch((err: any) => {
                console.log("deposit limit error:", err);
                mergeState({
                    depositLimit: null,
                    limitLoading: false
                });
            });
    }

    // Reads `this.state` in the original (no parameter at all) - see the
    // header comment for why `src` defaults to the ambient `state`
    // closure (replicating the WRC/SCU staleness bug) while
    // `_onAmountChange` explicitly passes `stateRef.current` (replicating
    // the one genuine setState-callback call site).
    function _estimateOutput(
        src: SimpleDepositBlocktradesBridgeState = state
    ) {
        const {inputAmount, inputCoinType, outputCoinType} = src;

        mergeState({receiveAmount: 0, sendAmount: inputAmount});
        if (!inputAmount) return;

        mergeState({receiveLoading: true});
        estimateOutput(
            inputAmount as any,
            inputCoinType.toLowerCase(),
            outputCoinType.toLowerCase()
        )
            .then((res: any) => {
                mergeState({
                    inputAmount: res.inputAmount,
                    receiveAmount: res.outputAmount,
                    receiveLoading: false
                });
            })
            .catch((err: any) => {
                console.log("receive amount err:", err);
                mergeState({receiveLoading: false, apiError: true});
            });
    }

    function _estimateInput(
        src: SimpleDepositBlocktradesBridgeState = state
    ) {
        const {outputAmount, inputCoinType, outputCoinType} = src;

        mergeState({receiveAmount: outputAmount as any, sendAmount: 0});
        if (!outputAmount) return;

        mergeState({receiveLoading: true});
        estimateInput(
            outputAmount as any,
            inputCoinType.toLowerCase(),
            outputCoinType.toLowerCase()
        )
            .then((res: any) => {
                console.log(res);
                mergeState({
                    inputAmount: res.inputAmount,
                    sendAmount: (utils as any).limitByPrecision(
                        res.inputAmount,
                        8
                    ),
                    receiveLoading: false
                });
            })
            .catch((err: any) => {
                console.log("send amount err:", err);
                mergeState({receiveLoading: false, apiError: true});
            });
    }

    function addDepositAddress(
        input_coin_type: string,
        output_coin_type: string,
        account: string,
        receive_address: any
    ) {
        depositAddressCacheRef.current.cacheInputAddress(
            "blocktrades",
            account,
            input_coin_type,
            output_coin_type,
            receive_address.address,
            receive_address.memo
        );
        mergeState({
            receive_address
        });
    }

    function _validateAddress(
        address: string,
        walletType: string | undefined = props.walletType
    ) {
        (validateAddress as any)({walletType, newAddress: address})
            .then((isValid: any) => {
                if (stateRef.current.toAddress === address) {
                    mergeState({
                        withdraw_address_check_in_progress: false,
                        validAddress: isValid
                    });
                }
            })
            .catch((err: any) => {
                console.error("Error when validating address:", err);
            });
    }

    function _setDepositAsset(value: string) {
        mergeState({
            inputCoinType: value
        });

        (SettingsActions as any).changeViewSetting({preferredBridge: value});
    }

    function _onAmountChange(type: "input" | "output", e: any) {
        let value = e.target.value;

        const regexp_numeral = new RegExp(/[[:digit:]]/);

        // Ensure input is valid
        if (!regexp_numeral.test(value)) {
            value = value.replace(/[^0-9.]/g, "");
        }

        // Catch initial decimal input
        if (value.charAt(0) == ".") {
            value = "0.";
        }

        // Catch double decimal and remove if invalid
        if (value.charAt(value.length) != value.search(".")) {
            value.substr(1);
        }

        value = (utils as any).limitByPrecision(value, 8);

        switch (type) {
            case "input":
                mergeState({inputAmount: value});
                _estimateOutput(stateRef.current);
                break;

            case "output":
                mergeState({outputAmount: value} as any);
                _estimateInput(stateRef.current);
                break;
        }
    }

    // Constructor's synchronous `this._validateAddress(this.state.
    // toAddress, props)` call, plus `UNSAFE_componentWillMount()`
    // (`_getDepositAddress(this.props)`) and `componentDidMount()`
    // (`_getDepositLimit(this.props)`/`_estimateOutput(this.props)`),
    // folded into a single mount-only effect - see header comment.
    const didMountEffect = React.useRef(false);
    React.useEffect(() => {
        if (didMountEffect.current) return;
        didMountEffect.current = true;
        _validateAddress(state.toAddress, props.walletType);
        _getDepositAddress({
            inputCoinType: props.inputCoinType as string,
            outputCoinType: props.outputCoinType as string
        });
        _getDepositLimit({
            inputCoinType: props.inputCoinType as string,
            outputCoinType: props.outputCoinType as string
        });
        _estimateOutput();
        // eslint-disable-next-line
    }, []);

    // UNSAFE_componentWillReceiveProps(np)
    const prevPropsRef = React.useRef({
        inputCoinType: props.inputCoinType,
        outputCoinType: props.outputCoinType
    });
    const isMountRefWRP = React.useRef(true);
    React.useEffect(() => {
        if (isMountRefWRP.current) {
            isMountRefWRP.current = false;
            prevPropsRef.current = {
                inputCoinType: props.inputCoinType,
                outputCoinType: props.outputCoinType
            };
            return;
        }
        const prev = prevPropsRef.current;
        prevPropsRef.current = {
            inputCoinType: props.inputCoinType,
            outputCoinType: props.outputCoinType
        };
        if (
            props.inputCoinType !== prev.inputCoinType ||
            props.outputCoinType !== prev.outputCoinType
        ) {
            mergeState({
                inputCoinType: props.inputCoinType as string,
                outputCoinType: props.outputCoinType as string
            });
            _getDepositLimit({
                inputCoinType: props.inputCoinType as string,
                outputCoinType: props.outputCoinType as string
            });
            _estimateOutput();
            _getDepositAddress({
                inputCoinType: props.inputCoinType as string,
                outputCoinType: props.outputCoinType as string
            });
        }
        // eslint-disable-next-line
    }, [props.inputCoinType, props.outputCoinType]);

    // componentDidUpdate() { ReactTooltip.rebuild(); }
    const isMountRefCDU = React.useRef(true);
    React.useEffect(() => {
        if (isMountRefCDU.current) {
            isMountRefCDU.current = false;
            return;
        }
        ReactTooltip.rebuild();
    });

    // shouldComponentUpdate(np, ns)'s embedded side effect (independent of
    // UNSAFE_componentWillReceiveProps's own three calls above - see
    // header comment).
    const isMountRefSCU = React.useRef(true);
    React.useEffect(() => {
        if (isMountRefSCU.current) {
            isMountRefSCU.current = false;
            return;
        }
        _getDepositLimit({
            inputCoinType: state.inputCoinType,
            outputCoinType: state.outputCoinType
        });
        _estimateOutput();
        _getDepositAddress({
            inputCoinType: state.inputCoinType,
            outputCoinType: state.outputCoinType
        });
        // eslint-disable-next-line
    }, [state.inputCoinType, state.outputCoinType]);

    function _renderDeposit() {
        const {name: assetName, prefix} = (utils as any).replaceName(
            props.asset
        );
        const {receive_address, apiError} = state;
        const hasMemo =
            receive_address &&
            "memo" in receive_address &&
            receive_address.memo;
        const addressValue = (receive_address && receive_address.address) || "";
        const QR = (
            <div className="QR" style={{textAlign: "center"}}>
                <QRCode size={140} value={addressValue} />
            </div>
        );

        const bridgeAssets = Object.keys(props.bridges.toJS());

        const inputName = state.inputCoinType.toUpperCase();
        const receiveName = (prefix ? prefix : "") + assetName;

        const price = ((state.receiveAmount as any) / (state.inputAmount as any)).toFixed(
            4
        );
        const priceSuffix = receiveName + "/" + inputName;

        const aboveLimit =
            (state.inputAmount as any) > parseFloat(state.depositLimit) ||
            (state.sendAmount as any) > parseFloat(state.depositLimit);

        return (
            <div className="modal__body" style={{paddingTop: 0}}>
                <Form className="full-width" layout="vertical">
                    <Form.Item label={counterpart.translate("modal.buy.asset")}>
                        <Input disabled value={receiveName} />
                    </Form.Item>
                    <Form.Item
                        label={counterpart.translate("modal.buy.bridge")}
                    >
                        <Tooltip
                            title={counterpart.translate(
                                "tooltip.bridge_TRADE"
                            )}
                        >
                            <Input
                                disabled
                                type="text"
                                defaultValue={"BLOCKTRADES"}
                            />
                        </Tooltip>
                    </Form.Item>
                </Form>
                {!apiError ? (
                    <span>
                        <div className="grid-block no-overflow wrap shrink">
                            <div
                                className="small-12 medium-6"
                                style={{paddingRight: 5}}
                            >
                                <Form className="full-width" layout="vertical">
                                    <Form.Item
                                        label={counterpart.translate(
                                            "transfer.send"
                                        )}
                                        validateStatus={
                                            aboveLimit ? "error" : ""
                                        }
                                        help={
                                            aboveLimit
                                                ? counterpart.translate(
                                                      "gateway.over_limit"
                                                  )
                                                : ""
                                        }
                                    >
                                        <Input
                                            value={state.sendAmount}
                                            onChange={(e: any) =>
                                                _onAmountChange("input", e)
                                            }
                                            addonAfter={
                                                <Select
                                                    defaultValue={state.inputCoinType.toUpperCase()}
                                                    value={state.inputCoinType.toUpperCase()}
                                                    style={{width: 100}}
                                                    onChange={_setDepositAsset}
                                                >
                                                    {bridgeAssets.map(asset => (
                                                        <Select.Option
                                                            key={asset.toUpperCase()}
                                                        >
                                                            {asset.toUpperCase()}
                                                        </Select.Option>
                                                    ))}
                                                </Select>
                                            }
                                        />
                                    </Form.Item>
                                </Form>
                            </div>
                            <div
                                className="small-12 medium-6"
                                style={{paddingRight: 5}}
                            >
                                <Form className="full-width" layout="vertical">
                                    <Form.Item
                                        label={counterpart.translate(
                                            "gateway.deposit_limit"
                                        )}
                                    >
                                        <Input
                                            value={state.depositLimit}
                                            disabled={true}
                                            addonAfter={
                                                <Select
                                                    defaultValue={state.inputCoinType.toUpperCase()}
                                                    value={state.inputCoinType.toUpperCase()}
                                                    style={{width: 100}}
                                                    disabled
                                                    showArrow={false}
                                                >
                                                    {bridgeAssets.map(asset => (
                                                        <Select.Option
                                                            key={asset.toUpperCase()}
                                                        >
                                                            {asset.toUpperCase()}
                                                        </Select.Option>
                                                    ))}
                                                </Select>
                                            }
                                        />
                                    </Form.Item>
                                </Form>
                            </div>
                        </div>

                        <div className="grid-block no-overflow wrap shrink">
                            <div
                                className="small-12 medium-6"
                                style={{paddingRight: 5}}
                            >
                                <Form className="full-width" layout="vertical">
                                    <Form.Item
                                        label={counterpart.translate(
                                            "exchange.receive"
                                        )}
                                    >
                                        <Input
                                            value={state.receiveAmount}
                                            onChange={(e: any) =>
                                                _onAmountChange("output", e)
                                            }
                                            addonAfter={
                                                <Select
                                                    defaultValue={receiveName}
                                                    value={receiveName}
                                                    style={{width: 100}}
                                                    disabled
                                                    showArrow={false}
                                                >
                                                    <Select.Option
                                                        key={receiveName}
                                                    >
                                                        {receiveName}
                                                    </Select.Option>
                                                </Select>
                                            }
                                        />
                                    </Form.Item>
                                </Form>
                            </div>
                            <div
                                className="small-12 medium-6"
                                style={{paddingRight: 5}}
                            >
                                <Form className="full-width" layout="vertical">
                                    <Form.Item
                                        label={counterpart.translate(
                                            "exchange.price"
                                        )}
                                    >
                                        <Input
                                            value={
                                                aboveLimit || isNaN(price as any)
                                                    ? 0
                                                    : price
                                            }
                                            disabled={true}
                                            addonAfter={
                                                <Select
                                                    defaultValue={priceSuffix}
                                                    value={priceSuffix}
                                                    style={{width: 125}}
                                                    disabled
                                                    showArrow={false}
                                                >
                                                    <Select.Option
                                                        key={priceSuffix}
                                                    >
                                                        {priceSuffix}
                                                    </Select.Option>
                                                </Select>
                                            }
                                        />
                                    </Form.Item>
                                </Form>
                            </div>
                        </div>

                        {!addressValue ? (
                            <div style={{textAlign: "center"}}>
                                <LoadingIndicator type="three-bounce" />
                            </div>
                        ) : (
                            <div className="container-row">
                                {hasMemo ? null : QR}
                                <div className="grid-block">
                                    <div className="copyIcon">
                                        <CopyButton
                                            text={addressValue}
                                            className="copyIcon"
                                        />
                                    </div>
                                    <div>
                                        <Translate
                                            component="div"
                                            style={{
                                                fontSize: "0.8rem",
                                                fontWeight: "bold",
                                                paddingBottom: "0.3rem"
                                            }}
                                            content="gateway.purchase_notice"
                                            inputAsset={inputName}
                                            outputAsset={receiveName}
                                        />

                                        <div className="modal__highlight">
                                            {addressValue}
                                        </div>
                                    </div>
                                </div>
                                {hasMemo ? (
                                    <div
                                        className="grid-block"
                                        style={{marginTop: "10px"}}
                                    >
                                        <div className="copyIcon">
                                            <CopyButton
                                                text={receive_address.memo}
                                                className="copyIcon"
                                            />
                                        </div>
                                        <div>
                                            <Translate
                                                unsafe
                                                content="gateway.purchase_notice_memo"
                                                component="div"
                                                style={{
                                                    fontSize: "0.8rem",
                                                    fontWeight: "bold",
                                                    paddingBottom: "0.3rem"
                                                }}
                                            />
                                            <div className="modal__highlight">
                                                {receive_address.memo}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </span>
                ) : (
                    <Translate content="modal.deposit.address_generation_error" />
                )}
            </div>
        );
    }

    const {asset} = props;

    if (!asset) {
        return null;
    }

    return (
        <div className="grid-block vertical no-overflow">
            {props.isDown ? (
                <div style={{textAlign: "center"}}>
                    <Translate
                        className="txtlabel cancel"
                        content="gateway.unavailable_TRADE"
                        component="p"
                    />
                </div>
            ) : !props.isAvailable ? (
                <div style={{textAlign: "center"}}>
                    <Translate
                        className="txtlabel cancel"
                        content="gateway.unavailable"
                        component="p"
                    />
                </div>
            ) : (
                _renderDeposit()
            )}
        </div>
    );
}

function SimpleDepositBlocktradesBridgeContainer(
    props: SimpleDepositBlocktradesBridgeProps
) {
    useChainStoreTick();
    const sender = (ChainStore as any).getAccount(props.sender);
    const asset = (ChainStore as any).getAsset(props.asset);

    // Matches BindToChainState's fallback for an unresolved *required*
    // prop when `options.show_loader` isn't set (it wasn't, here): render
    // an inert placeholder until both have resolved.
    if (!sender || !asset) return <span />;

    return (
        <SimpleDepositBlocktradesBridge {...props} sender={sender} asset={asset} />
    );
}

function StoreWrapperContainer(props: any) {
    const settingsState = useAltStore<any>(SettingsStore as any);
    const preferredBridgeFromStore = settingsState.viewSettings.get(
        "preferredBridge",
        "btc"
    );

    let currentBridge = props.bridges.get(preferredBridgeFromStore);
    let preferredBridge = preferredBridgeFromStore;
    if (!currentBridge) {
        currentBridge = props.bridges.first();
        preferredBridge = currentBridge.inputCoinType;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {preferredBridge: _ignoredIncomingPreferredBridge, ...others} = props;

    return (
        <SimpleDepositBlocktradesBridgeContainer
            hideModal={props.hideModal}
            {...others}
            preferredBridge={preferredBridge}
            {...currentBridge.toJS()}
        />
    );
}

export default function SimpleDepositBlocktradesBridgeModal(props: any) {
    if (!props.bridges) return null;

    return (
        <Modal
            title={counterpart.translate("modal.buy.title")}
            visible={props.visible}
            onCancel={props.hideModal}
            footer={[
                <Button key="cancel" onClick={props.hideModal}>
                    {counterpart.translate("modal.close")}
                </Button>
            ]}
        >
            <StoreWrapperContainer {...props} open={props.visible} />
        </Modal>
    );
}
