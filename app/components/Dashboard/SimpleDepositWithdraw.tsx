// TypeScript/functional-component port of the legacy SimpleDepositWithdraw.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md, `Dashboard/` batch 2). Mechanical
// class-to-hooks translation; every judgment call is documented below.
//
// Security-sensitive per AGENTS.md: `onSubmit` dispatches a real on-chain
// withdraw transaction via `AccountActions.transfer(...)`. Grepped every
// `console.*` call in the original - both log generic error objects/
// messages only (`console.error("err:", err)`, `console.error("Error when
// validating address:", err)`), no password/key/brainkey material -
// transcribed verbatim.
//
// **`DecimalChecker` inlining**: the original `class DepositWithdrawContent
// extends DecimalChecker` (`../Utility/DecimalChecker.jsx`) is a LIVE use,
// unlike most `extends X` patterns already dropped elsewhere in this
// migration (e.g. `Modal/DepositModal.tsx`'s `DepositModalContent extends
// DecimalChecker`, where nothing from the base class was actually called).
// Here, the withdraw-amount `<input>` has `onKeyPress={this.onKeyPress.bind(
// this)}`, genuinely `DecimalChecker.onKeyPress`. `DecimalChecker.onPaste`/
// `.getNumericEventValue` are grep-confirmed unused anywhere in this file
// and are NOT ported. Following the established precedent
// (`Exchange/ExchangeInput.tsx`'s header comment/body), `onKeyPress` is
// inlined as a plain local function instead of extending the class.
// `DecimalChecker.onKeyPress`'s last line, `if (this.props.onKeyPress)
// this.props.onKeyPress(e);`, refers to whatever `onKeyPress` prop THIS
// component itself receives (not a `DecimalChecker` prop) - grep confirms
// its one real caller (`Exchange/Exchange.tsx`'s `<SimpleDepositWithdraw>`
// JSX) never passes an `onKeyPress` prop, so that forwarding branch is
// always a no-op in practice - kept anyway (harmless, matches
// `ExchangeInput.tsx`'s own pattern of preserving the forward-if-present
// logic). `onKeyPress` doesn't read `allowNaN` at all (only `onPaste`
// does, and `onPaste` isn't ported here), so no `allowNaN` prop/default is
// needed for this file, unlike `ExchangeInput.tsx`.
//
// **`BindToChainState` -> Container translation**: `DepositWithdrawContent`'s
// original `propTypes` are `balance: ChainTypes.ChainObject` (not
// required), `sender: ChainTypes.ChainAccount.isRequired`,
// `asset: ChainTypes.ChainAsset.isRequired`,
// `coreAsset: ChainTypes.ChainAsset.isRequired` (default `"1.3.0"`),
// `globalObject: ChainTypes.ChainAsset.isRequired` (default `"2.0.0"`).
// `DepositWithdrawContentContainer` below replicates `BindToChainState`'s
// resolution (`ChainStore.getAccount`/`getAsset`/`getObject`, as already
// established in `Modal/WithdrawModalNew.tsx`'s
// `WithdrawModalAccountContainer`) plus its "don't render until every
// *required* chain prop has resolved" fallback (`options.show_loader`
// wasn't passed in the original, so the fallback is a bare `<span />`, not
// a loading indicator). `coreAsset`/`globalObject` are grep-confirmed
// never read anywhere else in the original file (not in `render()`, not
// in any method) - they exist purely to gate `BindToChainState`'s
// "resolved" check. `coreAsset` defaults to `"1.3.0"` (BTS, always
// resolves once synced). `globalObject` defaults to `"2.0.0"` - object-id
// space/type `"2.0.x"` is actually the chain's *global_property_object*
// (a singleton, not really an "asset"), despite being typed
// `ChainTypes.ChainAsset` in the original (a pre-existing naming/typing
// mismatch, not "fixed" here) - `ChainStore.getAsset("2.0.0")` internally
// just calls `getObject("2.0.0")` since it's a syntactically valid object
// id, so it resolves fine and gates correctly despite the semantic
// mismatch. Both are still resolved via `ChainStore.getAsset(...)` and
// still gate rendering exactly as before; since nothing downstream reads
// them, they are not forwarded as props to `DepositWithdrawContent`.
// `sender`/`asset` are resolved and passed down as explicit, overriding
// props, matching `BindToChainState`'s own render
// (`<Component {...props} {...this.state} />`, state spread last) -
// this is not a special case for the real caller (`Exchange/Exchange.tsx`)
// which already passes ALREADY-RESOLVED Immutable objects for
// `sender`/`asset`/`balance`, since `ChainStore.getAccount`/`getAsset`/
// `getObject` all accept either a raw id or an already-resolved object and
// return the resolved object either way (idempotent). `balance` (not
// required) is resolved the same way when present and passed down,
// matching `BindToChainState`'s conditional resolution; when absent it is
// passed through as `undefined`, letting `_getCurrentBalance`'s
// `this.props.balances` (plural) fallback behave exactly as before -
// `balances` (plural) is declared nowhere in the original's `propTypes`,
// so `BindToChainState` never touches it; it passes through as an
// ordinary, unresolved prop (dead at the current call site, which only
// ever passes singular `balance`, but preserved for fidelity).
//
// The original also had a second, independent wrapping layer:
// `DepositWithdrawContent = connect(DepositWithdrawContent, {listenTo:
// [SettingsStore], getProps() { return {fee_asset_symbol: SettingsStore.
// getState().settings.get("fee_asset")}; }})`, applied *before*
// `BindToChainState` wraps the result - so the final render order is
// `BindToChainStateWrapper -> connectWrapper -> DepositWithdrawContent`,
// with `fee_asset_symbol` merged in on top of the chain-resolved props
// (no naming collision between the two, so merge order is immaterial
// here). This is folded into the same `DepositWithdrawContentContainer`
// below via `useAltStore(SettingsStore)`, the established
// `connect(Component, {listenTo, getProps})` replacement.
//
// `UNSAFE_componentWillMount` (calls `_getDepositAddress()`, no args - it
// reads `props.backingCoinType`/`.account`/`.sender`/`.symbol` directly)
// becomes a mount-only `useEffect(() => {...}, [])`. The constructor's own
// synchronous `this._validateAddress(this.state.toAddress, props)` call
// (kicking off an async address-validation request before first mount)
// becomes a second mount-only effect, validating the lazily-computed
// initial `toAddress`.
//
// `UNSAFE_componentWillReceiveProps(np)` becomes a mount-skip `useEffect`
// keyed on `[asset]`, comparing the asset id captured in a ref (the
// previous render's `asset`) against the current render's `asset` - the
// hooks equivalent of `np.asset.get("id") !== this.props.asset.get("id")`.
// The original's state patch also included `gateFee: np.asset.get(
// "gateFee")` and `intermediateAccount: np.asset.get("intermediateAccount")`
// - grep-confirmed dead: every real read of a "gateFee"/"intermediateAccount"
// value in this file goes through `this.props.gateFee`/
// `this.props.intermediateAccount` (see `_getGateFee()`, `onSubmit()`),
// never `this.state.gateFee`/`this.state.intermediateAccount` - so those
// two state fields are dropped from the patch here (same treatment as
// `Modal/ReserveAssetModal.tsx`'s dropped, confirmed-dead `state.asset`
// field). The patch's remaining fields are applied via `mergeState`, and
// the original's `setState(update, callback)` pattern (callback =
// `_getDepositAddress`) is replicated by calling `_getDepositAddress()`
// directly after the merge - safe because `_getDepositAddress` only reads
// `props` (`backingCoinType`/`account`/`sender`/`symbol`), never the
// just-reset state, so React's commit-order guarantee was never actually
// load-bearing here (verified by re-reading `_getDepositAddress`'s body,
// per the task's own instruction to check rather than assume).
//
// `componentDidUpdate() { ReactTooltip.rebuild(); }` runs unconditionally
// on every update (no field comparison at all) - becomes a mount-skip
// `useEffect` with NO dependency array, matching `componentDidUpdate`'s
// "after every update, never after the first mount" semantics exactly
// (same pattern already used for this exact call in
// `Modal/BorrowModal.tsx`).
//
// Several `setState(update, callback)` calls use `this._checkBalance` as
// the callback, which reads `this.state.feeAsset`/`.to_withdraw`/
// `.balanceError` fresh off the just-committed state. Per this migration's
// established `stateRef` mirror pattern (see `Utility/FeeAssetSelector.tsx`),
// `_checkBalance` reads `stateRef.current` instead of the closed-over
// `state`. Checked carefully (per the task's instruction not to just take
// this at face value): none of the `mergeState(...)` calls immediately
// preceding a `_checkBalance()` call ever patch `feeAsset`, `to_withdraw`,
// or `balanceError` themselves (`_updateAmount`/`_onInputAmount` only
// patch `withdrawValue`/`amountError`; `to_withdraw` is a mutable
// `Asset` instance mutated in place via `.setAmount(...)` *before* the
// merge, so it's already current by reference regardless of which
// snapshot is read) - so `stateRef.current` (updated synchronously inside
// `mergeState`, same as this component's own `mergeState`, unlike
// `FeeAssetSelector.tsx`'s render-body-timed mirror) is always accurate
// here, and calling `_checkBalance()` right after `mergeState(...)`
// reproduces the original's callback-after-commit ordering exactly.
//
// `to_withdraw` (a mutable `common/MarketClasses` `Asset` instance) is
// kept as a single object reference across renders and mutated in place
// via `.setAmount(...)`/`.plus(...)`/`.minus(...)`, exactly as the class
// did via `this.state.to_withdraw` - the same "mutate the object, then
// call `mergeState` on an unrelated field to force the re-render"
// pattern already used by `Modal/ReserveAssetModal.tsx`'s
// `state.amountAsset`.
//
// `export default class SimpleDepositWithdrawModal`: grep-confirmed dead
// across the WHOLE app (not just this file) - `state.open`/`show()`/
// `onClose()`. `render()` uses `this.props.visible` for `<Modal
// visible={...}>`, never `this.state.open`; no caller anywhere holds a
// `ref` to `SimpleDepositWithdrawModal` and calls `.show()` (its one real
// caller, `Exchange/Exchange.tsx`, renders it with plain props only, no
// `ref`). Dropped entirely, keeping only the `render()` logic (which just
// renders `<Modal>` wrapping the content Container, conditional on
// `props.visible`).
//
// `getMemo()`'s `new Buffer(this.state.memo, "utf-8")` (deprecated Node
// `Buffer()` global constructor) is transcribed as-is - already used
// unmodified elsewhere in this migration's `.tsx` ports (e.g.
// `Modal/SendModal.tsx`, `Modal/WithdrawModalNew.tsx`), compiles cleanly
// under this repo's `tsconfig.json`/`@types/node` setup with no special
// handling needed.
//
// Dropped as confirmed dead: both `_renderWithdraw()`/`_renderDeposit()`
// had a large commented-out `this.props.fiatModal` JSX block (referencing
// `WithdrawFiatOpenLedger`/`DepositFiatOpenLedger`, neither of which is
// even imported by this file) whose only live reference,
// `this._openRegistrarSite`, appears exclusively inside those comments -
// grepped the whole original file, `_openRegistrarSite` is never called
// from any *live* code path. Both the commented-out blocks and the
// now-orphaned `_openRegistrarSite` method are dropped (same treatment as
// other already-commented-out dead code dropped elsewhere in this
// migration, e.g. `docs/UI_MIGRATION_PLAN.md`'s Phase 3/5 batch notes).
//
// Dropped as confirmed dead: the outer `render()`'s own `const {name:
// assetName} = utils.replaceName(asset);` computed a value never actually
// used anywhere in `render()`'s returned JSX (`_renderWithdraw()`/
// `_renderDeposit()` each independently recompute their own `assetName`
// from `props.asset`) - grepped, dropped here rather than kept as an
// unused local.
//
// TS-forced adjustment: the withdraw memo `<textarea rows="3" ...>`
// becomes `rows={3}` (a number literal) - React's `TextareaHTMLAttributes`
// types `rows` as `number`, not `string`; same adjustment already made in
// several other `.tsx` ports in this migration (e.g. `Modal/IssueModal.tsx`,
// `Modal/SendModal.tsx`).
//
// TS-forced adjustments in `common/gatewayMethods.js` call sites (a plain
// JS module TypeScript still infers parameter/return types for): (1)
// `getDepositAddress(...)` has no `return` statement, so TS infers a
// `void` return, which can't be tested with `if (!receive_address)` under
// `strict` - `as any` on the call restores the original's (always-false,
// see the inline comment at that call site) truthiness check unchanged.
// (2) `requestDepositAddress(...)`'s destructured `selectedGateway` param
// has no default, so TS infers it as required, though the original never
// passes it (it's genuinely optional at runtime; `undefined` is handled
// fine internally) - `as any` on the call. (3) `validateAddress(...)`
// similarly gets `as any` on the call. (4) `_getGateFee()`'s
// `parseFloat(gateFee ? gateFee.replace(",", "") : 0)` passes a `number`
// literal in the false branch (a pre-existing, harmless quirk - `parseFloat`
// coerces it to `"0"` at runtime either way) - the ternary result is cast
// `as any` to keep the exact original expression compiling. These
// `common/gatewayMethods.js` call sites already have this same `as any`
// treatment established elsewhere in this migration (e.g.
// `DepositWithdraw/piratecash/PiratecashWithdrawModal.tsx`,
// `Modal/DepositModal.tsx`).
import * as React from "react";
import Translate from "react-translate-component";
import {Asset} from "common/MarketClasses";
import utils from "common/utils";
import AccountActions from "actions/AccountActions";
import ReactTooltip from "react-tooltip";
import counterpart from "counterpart";
import {
    requestDepositAddress,
    validateAddress,
    WithdrawAddresses,
    getDepositAddress
} from "common/gatewayMethods";
import CopyButton from "../Utility/CopyButton";
import Icon from "../Icon/Icon";
import LoadingIndicator from "../LoadingIndicator";
import {checkBalance} from "common/trxHelper";
import SettingsStore from "stores/SettingsStore";
import {openledgerAPIs} from "api/apiConfig";
import {getWalletName} from "branding";
import {Modal} from "../../design-system/Modal";
import {Tooltip} from "../../design-system/Tooltip";
import {ChainStore} from "bitsharesjs";
import FeeAssetSelector from "components/Utility/FeeAssetSelector";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface DepositWithdrawContentProps {
    sender: any;
    asset: any;
    balance?: any;
    balances?: any;
    fee_asset_symbol?: string;
    account?: any;
    action?: string;
    hideModal?: () => void;
    modalId?: string;
    open?: boolean;
    isDown?: boolean;
    isAvailable?: boolean;
    isDepositBridge?: boolean;
    supportsMemos?: boolean;
    backingCoinType?: string;
    symbol?: string;
    walletType?: string;
    intermediateAccount?: string;
    gateFee?: string;
    onKeyPress?: (e: any) => void;
    [key: string]: any;
}

interface DepositWithdrawContentState {
    toAddress: string;
    withdrawValue: string | number;
    amountError: string | null;
    symbol: string;
    to_withdraw: any;
    feeAsset: any;
    loading: boolean;
    emptyAddressDeposit: boolean;
    memo?: string;
    receive_address?: any;
    validAddress?: boolean | null;
    withdraw_address_check_in_progress?: boolean;
    withdraw_address_selected?: string;
    balanceError?: boolean;
}

function getInitialState(
    props: DepositWithdrawContentProps
): DepositWithdrawContentState {
    return {
        toAddress: WithdrawAddresses.getLast(props.walletType),
        withdrawValue: "",
        amountError: null,
        symbol: props.asset.get("symbol"),
        to_withdraw: new (Asset as any)({
            asset_id: props.asset.get("id"),
            precision: props.asset.get("precision")
        }),
        feeAsset: {
            asset_id:
                (ChainStore as any).assets_by_symbol.get(
                    props.fee_asset_symbol
                ) || "1.3.0",
            amount: 0
        },
        loading: false,
        emptyAddressDeposit: false
    };
}

function DepositWithdrawContent(props: DepositWithdrawContentProps) {
    const [state, setState] = React.useState<DepositWithdrawContentState>(
        () => getInitialState(props)
    );
    const stateRef = React.useRef(state);
    const mergeState = (patch: Partial<DepositWithdrawContentState>) => {
        setState(prev => {
            const next = {...prev, ...patch};
            stateRef.current = next;
            return next;
        });
    };

    function _getDepositObject() {
        return {
            inputCoinType: (props.backingCoinType as string).toLowerCase(),
            outputCoinType: (props.symbol as string).toLowerCase(),
            outputAddress: props.sender.get("name"),
            stateCallback: addDepositAddress
        };
    }

    function _getDepositAddress() {
        if (!props.backingCoinType) return;

        // `getDepositAddress` (common/gatewayMethods.js) has no `return`
        // statement - it's fire-and-forget (fetches asynchronously and
        // invokes `stateCallback` later), so `receive_address` here is
        // ALWAYS `undefined`, making `if (!receive_address)` always true
        // and the `else` branch below permanently dead - a genuine
        // pre-existing quirk in the original .jsx (not introduced by this
        // port), preserved verbatim. `as any` works around TypeScript
        // correctly inferring `getDepositAddress`'s return type as `void`
        // (which can't be tested for truthiness under `strict`).
        const receive_address = (getDepositAddress as any)({
            coin: `open.${props.backingCoinType.toLowerCase()}`,
            account: props.account,
            stateCallback: addDepositAddress
        });

        if (!receive_address) {
            (requestDepositAddress as any)(_getDepositObject());
        } else {
            mergeState({receive_address});
        }
    }

    function requestDepositAddressLoad() {
        mergeState({
            loading: true,
            emptyAddressDeposit: false
        });
        (requestDepositAddress as any)(_getDepositObject());
    }

    function addDepositAddress(receive_address: any) {
        if (receive_address.error) {
            receive_address.error.message === "no_address"
                ? mergeState({emptyAddressDeposit: true})
                : mergeState({emptyAddressDeposit: false});
        }

        mergeState({
            receive_address,
            loading: false
        });
    }

    function _validateAddress(
        address: string,
        walletType: string | undefined = props.walletType
    ) {
        (validateAddress as any)({
            url: openledgerAPIs.BASE,
            walletType,
            newAddress: address
        })
            .then((isValid: any) => {
                if (stateRef.current.toAddress === address) {
                    mergeState({
                        withdraw_address_check_in_progress: false,
                        validAddress: !!isValid
                    });
                }
            })
            .catch((err: any) => {
                console.error("Error when validating address:", err);
            });
    }

    // UNSAFE_componentWillMount: `_getDepositAddress()` on mount.
    // Constructor: `this._validateAddress(this.state.toAddress, props)`,
    // run synchronously before first mount in the original - here as a
    // second mount-only effect, validating the lazily-computed initial
    // `toAddress`.
    const didMountEffects = React.useRef(false);
    React.useEffect(() => {
        if (didMountEffects.current) return;
        didMountEffects.current = true;
        _validateAddress(state.toAddress, props.walletType);
        _getDepositAddress();
        // eslint-disable-next-line
    }, []);

    // UNSAFE_componentWillReceiveProps(np): reset several fields and
    // re-fetch the deposit address whenever `asset`'s id actually changes.
    const prevAssetRef = React.useRef(props.asset);
    const isMountRefWRP = React.useRef(true);
    React.useEffect(() => {
        if (isMountRefWRP.current) {
            isMountRefWRP.current = false;
            prevAssetRef.current = props.asset;
            return;
        }
        const prevAsset = prevAssetRef.current;
        const nextAsset = props.asset;
        prevAssetRef.current = nextAsset;
        if (
            nextAsset &&
            prevAsset &&
            nextAsset.get("id") !== prevAsset.get("id")
        ) {
            mergeState({
                to_withdraw: new (Asset as any)({
                    asset_id: nextAsset.get("id"),
                    precision: nextAsset.get("precision")
                }),
                symbol: nextAsset.get("symbol"),
                memo: "",
                withdrawValue: "",
                receive_address: null,
                toAddress: WithdrawAddresses.getLast(props.walletType)
            });
            _getDepositAddress();
        }
        // eslint-disable-next-line
    }, [props.asset]);

    // componentDidUpdate() { ReactTooltip.rebuild(); } - runs after every
    // update, never after the first mount.
    const isMountRefCDU = React.useRef(true);
    React.useEffect(() => {
        if (isMountRefCDU.current) {
            isMountRefCDU.current = false;
            return;
        }
        ReactTooltip.rebuild();
    });

    function getMemo() {
        return (
            (props.backingCoinType as string).toLowerCase() +
            ":" +
            state.toAddress +
            (state.memo ? ":" + new (Buffer as any)(state.memo, "utf-8") : "")
        );
    }

    function onSubmit(e: any) {
        e.preventDefault();
        if (state.to_withdraw.getAmount() === 0) {
            mergeState({amountError: "transfer.errors.pos"});
            return;
        }

        if (!props.intermediateAccount) return;

        const fee = state.feeAsset;
        const gateFee = _getGateFee();

        let sendAmount = state.to_withdraw.clone();

        const balanceAmount = sendAmount.clone(
            _getCurrentBalance().get("balance")
        );

        sendAmount.plus(gateFee);

        /* Insufficient balance */
        if (balanceAmount.lt(sendAmount)) {
            // Send the originally entered amount
            sendAmount = state.to_withdraw.clone();
        }

        (AccountActions as any).transfer(
            props.sender.get("id"),
            props.intermediateAccount,
            state.to_withdraw.getAmount(),
            state.to_withdraw.asset_id,
            getMemo(),
            null,
            fee.asset_id
        );
    }

    function _updateAmount() {
        const {feeAsset} = state;
        const currentBalance = _getCurrentBalance();

        const total = new (Asset as any)({
            amount: currentBalance ? currentBalance.get("balance") : 0,
            asset_id: props.asset.get("id"),
            precision: props.asset.get("precision")
        });

        // Subtract the fee if it is using the same asset
        if (total.asset_id === feeAsset.asset_id) {
            total.minus(feeAsset);
        }

        state.to_withdraw.setAmount({sats: total.getAmount()});
        mergeState({
            withdrawValue: total.getAmount({real: true}),
            amountError: null
        });
        _checkBalance();
    }

    function _getCurrentBalance(): any {
        const balances = props.balance
            ? [(ChainStore as any).getObject(props.balance)]
            : props.balances;

        return !!balances
            ? balances.find((b: any) => {
                  return b && b.get("asset_type") === props.asset.get("id");
              })
            : null;
    }

    function _checkBalance() {
        const {feeAsset, to_withdraw} = stateRef.current;
        const {asset} = props;
        const balance = _getCurrentBalance();
        if (!balance || !feeAsset) return;
        const hasBalance = (checkBalance as any)(
            to_withdraw.getAmount({real: true}),
            asset,
            feeAsset,
            balance,
            _getGateFee()
        );
        if (hasBalance === null) return;
        if (stateRef.current.balanceError !== !hasBalance)
            mergeState({balanceError: !hasBalance});

        return hasBalance;
    }

    function _onInputAmount(e: any) {
        try {
            state.to_withdraw.setAmount({
                real: parseFloat(e.target.value || 0)
            });
            mergeState({
                withdrawValue: e.target.value,
                amountError: null
            });
            _checkBalance();
        } catch (err) {
            console.error("err:", err);
        }
    }

    function _onInputTo(e: any) {
        const toAddress = e.target.value.trim();

        mergeState({
            withdraw_address_check_in_progress: true,
            withdraw_address_selected: toAddress,
            validAddress: null,
            toAddress: toAddress
        });

        _validateAddress(toAddress);
    }

    function _onMemoChanged(e: any) {
        mergeState({memo: e.target.value});
    }

    function _getGateFee() {
        const {gateFee, asset} = props;
        return new (Asset as any)({
            real: parseFloat((gateFee ? gateFee.replace(",", "") : 0) as any),
            asset_id: asset.get("id"),
            precision: asset.get("precision")
        });
    }

    function onFeeChanged(asset: any) {
        mergeState({
            feeAsset: asset
        });
    }

    function onKeyPress(e: any) {
        if (!e.nativeEvent.ctrlKey) {
            // allow copy-paste

            if (e.key === "." && e.target.value === "") e.target.value = "0";
            const nextValue = e.target.value + e.key;
            const decimal = nextValue.match(/\./g);
            const decimalCount = decimal ? decimal.length : 0;
            if (e.key === "." && decimalCount > 1) e.preventDefault();
            if (parseFloat(nextValue) != nextValue) e.preventDefault();

            if (props.onKeyPress) props.onKeyPress(e);
        }
    }

    function _renderWithdraw() {
        const {
            amountError,
            toAddress,
            memo,
            feeAsset,
            balanceError,
            withdrawValue,
            validAddress
        } = state;
        const {supportsMemos, asset, account} = props;
        const {name: assetName} = (utils as any).replaceName(asset);
        let tabIndex = 1;

        const currentFee = feeAsset;

        const trxInfoContent = getMemo();

        const disableSubmit =
            !currentFee || balanceError || !toAddress || !withdrawValue;

        return (
            <div>
                <p>
                    <Translate
                        content="gateway.withdraw_funds"
                        asset={assetName}
                        wallet_name={getWalletName()}
                    />
                </p>

                {_renderCurrentBalance()}

                <div className="SimpleTrade__withdraw-row">
                    <label className="left-label">
                        {counterpart.translate("modal.withdraw.amount")}
                    </label>
                    <div className="inline-label input-wrapper">
                        <input
                            tabIndex={tabIndex++}
                            type="number"
                            min="0"
                            onKeyPress={onKeyPress}
                            value={withdrawValue}
                            onChange={_onInputAmount}
                        />
                        <div className="form-label select floating-dropdown">
                            <div className="dropdown-wrapper inactive">
                                <div>{assetName}</div>
                            </div>
                        </div>
                    </div>
                    {amountError ? (
                        <p
                            className="has-error no-margin"
                            style={{paddingTop: 10}}
                        >
                            <Translate content={amountError} />
                        </p>
                    ) : null}
                    {state.balanceError ? (
                        <p
                            className="has-error no-margin"
                            style={{paddingTop: 10}}
                        >
                            <Translate content="transfer.errors.insufficient" />
                        </p>
                    ) : null}
                </div>

                <div className="SimpleTrade__withdraw-row withdraw-fee-selector">
                    <FeeAssetSelector
                        label="showcases.barter.fee_when_proposal_executes"
                        account={account}
                        transaction={{
                            type: "transfer",
                            options: ["price_per_kbyte"],
                            data: {
                                type: "memo",
                                content: trxInfoContent
                            }
                        }}
                        onChange={onFeeChanged}
                    />
                </div>

                <div className="SimpleTrade__withdraw-row">
                    <label className="left-label">
                        {counterpart.translate("modal.withdraw.address")}
                    </label>
                    <div className="inline-label input-wrapper">
                        <input
                            placeholder={counterpart.translate(
                                "gateway.withdraw_placeholder",
                                {asset: assetName}
                            )}
                            tabIndex={tabIndex++}
                            type="text"
                            value={toAddress}
                            onChange={_onInputTo}
                        />

                        <div className="form-label select floating-dropdown">
                            <div className="dropdown-wrapper inactive">
                                <Tooltip
                                    placement="right"
                                    title={counterpart.translate(
                                        "tooltip.withdraw_address",
                                        {asset: assetName}
                                    )}
                                >
                                    ?
                                </Tooltip>
                            </div>
                        </div>
                    </div>
                    {!validAddress && toAddress ? (
                        <div className="has-error" style={{paddingTop: 10}}>
                            <Translate
                                content="gateway.valid_address"
                                coin_type={assetName}
                            />
                        </div>
                    ) : null}
                </div>

                {supportsMemos ? (
                    <div className="SimpleTrade__withdraw-row">
                        <label className="left-label">
                            {counterpart.translate("transfer.memo")}
                        </label>
                        <div className="inline-label input-wrapper">
                            <textarea
                                rows={3}
                                value={memo}
                                tabIndex={tabIndex++}
                                onChange={_onMemoChanged}
                            />
                        </div>
                        {!validAddress && toAddress ? (
                            <div className="has-error" style={{paddingTop: 10}}>
                                <Translate
                                    content="gateway.valid_address"
                                    coin_type={assetName}
                                />
                            </div>
                        ) : null}
                    </div>
                ) : null}

                <div className="button-group SimpleTrade__withdraw-row">
                    <button
                        tabIndex={tabIndex++}
                        className={
                            "button" + (disableSubmit ? " disabled" : "")
                        }
                        onClick={onSubmit}
                        type="submit"
                    >
                        <Translate content="gateway.withdraw_now" />
                    </button>
                </div>
            </div>
        );
    }

    function _renderDeposit() {
        const {receive_address, loading, emptyAddressDeposit} = state;
        const {name: assetName} = (utils as any).replaceName(props.asset);
        const hasMemo =
            receive_address &&
            "memo" in receive_address &&
            receive_address.memo;
        const addressValue = (receive_address && receive_address.address) || "";
        let tabIndex = 1;

        return (
            <div className={!addressValue ? "no-overflow" : ""}>
                <p>
                    <Translate
                        unsafe
                        content="gateway.add_funds"
                        account={props.sender.get("name")}
                        wallet_name={getWalletName()}
                    />
                </p>

                {_renderCurrentBalance()}

                <div className="SimpleTrade__withdraw-row">
                    <Tooltip
                        placement="right"
                        title={counterpart.translate("tooltip.deposit_tip", {
                            asset: assetName
                        })}
                    >
                        <p style={{marginBottom: 10}}>
                            <Translate
                                className="help-tooltip"
                                content="gateway.deposit_to"
                                asset={assetName}
                            />
                            :
                            <label className="fz_12 left-label">
                                <Translate content="gateway.deposit_notice_delay" />
                            </label>
                        </p>
                    </Tooltip>
                    {!addressValue ? (
                        <LoadingIndicator type="three-bounce" />
                    ) : (
                        <label>
                            {emptyAddressDeposit ? (
                                <Translate content="gateway.please_generate_address" />
                            ) : (
                                <span className="inline-label">
                                    <input
                                        readOnly
                                        type="text"
                                        value={addressValue}
                                    />
                                    <CopyButton text={addressValue} />{" "}
                                </span>
                            )}
                        </label>
                    )}
                    {hasMemo ? (
                        <label>
                            <span className="inline-label">
                                <input
                                    readOnly
                                    type="text"
                                    value={
                                        counterpart.translate("transfer.memo") +
                                        ": " +
                                        receive_address.memo
                                    }
                                />

                                <CopyButton text={receive_address.memo} />
                            </span>
                        </label>
                    ) : null}

                    {receive_address && receive_address.error ? (
                        <div className="has-error" style={{paddingTop: 10}}>
                            {receive_address.error.message}
                        </div>
                    ) : null}
                </div>

                <div className="button-group SimpleTrade__withdraw-row">
                    <button
                        tabIndex={tabIndex++}
                        className="button spinner-button-circle"
                        onClick={requestDepositAddressLoad}
                        type="submit"
                    >
                        {loading ? <LoadingIndicator type="circle" /> : null}
                        <Translate content="gateway.generate_new" />
                    </button>
                </div>
            </div>
        );
    }

    function _renderCurrentBalance() {
        const {name: assetName} = (utils as any).replaceName(props.asset);
        const isDeposit = props.action === "deposit";

        const currentBalance = _getCurrentBalance();

        const asset = currentBalance
            ? new (Asset as any)({
                  asset_id: currentBalance.get("asset_type"),
                  precision: props.asset.get("precision"),
                  amount: currentBalance.get("balance")
              })
            : null;

        const applyBalanceButton = isDeposit ? (
            <span
                style={{border: "2px solid black", borderLeft: "none"}}
                className="form-label"
            >
                {assetName}
            </span>
        ) : (
            <Tooltip
                placement="right"
                title={counterpart.translate("tooltip.withdraw_full")}
            >
                <button
                    className="button"
                    style={{border: "2px solid black", borderLeft: "none"}}
                    onClick={_updateAmount}
                >
                    <Icon name="clippy" title="icons.clippy.withdraw_full" />
                </button>
            </Tooltip>
        );

        return (
            <div
                className="SimpleTrade__withdraw-row"
                style={{fontSize: "1rem"}}
            >
                <label style={{fontSize: "1rem"}}>
                    {counterpart.translate("gateway.balance_asset", {
                        asset: assetName
                    })}
                    :
                    <span className="inline-label">
                        <input
                            disabled
                            style={{
                                color: "black",
                                border: "2px solid black",
                                padding: 10,
                                width: "100%"
                            }}
                            value={!asset ? 0 : asset.getAmount({real: true})}
                        />
                        {applyBalanceButton}
                    </span>
                </label>
            </div>
        );
    }

    const {asset, action} = props;
    const isDeposit = action === "deposit";

    if (!asset) {
        return null;
    }

    const content = props.isDown ? (
        <div>
            <Translate
                className="txtlabel cancel"
                content="gateway.unavailable_OPEN"
                component="p"
            />
        </div>
    ) : !props.isAvailable ? (
        <div>
            <Translate
                className="txtlabel cancel"
                content="gateway.unavailable"
                component="p"
            />
        </div>
    ) : isDeposit ? (
        _renderDeposit()
    ) : (
        _renderWithdraw()
    );

    return (
        <div className="SimpleTrade__modal">
            <div
                className="grid-block vertical no-overflow"
                style={{
                    zIndex: 1002,
                    paddingLeft: "2rem",
                    paddingRight: "2rem",
                    paddingTop: "1rem"
                }}
            >
                {content}
            </div>
        </div>
    );
}

function DepositWithdrawContentContainer(props: DepositWithdrawContentProps) {
    useChainStoreTick();
    const settingsState = useAltStore<any>(SettingsStore as any);
    const fee_asset_symbol = settingsState.settings.get("fee_asset");

    const sender = (ChainStore as any).getAccount(props.sender);
    const asset = (ChainStore as any).getAsset(props.asset);
    const coreAsset = (ChainStore as any).getAsset(props.coreAsset || "1.3.0");
    const globalObject = (ChainStore as any).getAsset(
        props.globalObject || "2.0.0"
    );
    const balance = props.balance
        ? (ChainStore as any).getObject(props.balance)
        : props.balance;

    // Matches BindToChainState's fallback for an unresolved *required*
    // prop when `options.show_loader` isn't set (it wasn't, here):
    // render an inert placeholder until everything has resolved.
    if (!sender || !asset || !coreAsset || !globalObject) return <span />;

    return (
        <DepositWithdrawContent
            {...props}
            sender={sender}
            asset={asset}
            balance={balance}
            fee_asset_symbol={fee_asset_symbol}
        />
    );
}

export default function SimpleDepositWithdrawModal(props: any) {
    const isDeposit = props.action === "deposit";

    const title = isDeposit
        ? counterpart.translate("gateway.deposit")
        : counterpart.translate("modal.withdraw.submit");

    return (
        <Modal
            title={title}
            footer={[]}
            visible={props.visible}
            onCancel={props.hideModal}
            className="test"
        >
            {props.visible ? (
                <DepositWithdrawContentContainer
                    {...props}
                    open={props.visible}
                />
            ) : null}
        </Modal>
    );
}
