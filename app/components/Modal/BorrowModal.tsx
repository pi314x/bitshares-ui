// TypeScript/functional-component port of the legacy BorrowModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes
// beyond the one forced simplification called out below.
//
// Security-sensitive per AGENTS.md: `onSubmit` (originally `_onSubmit`)
// submits an on-chain `call_order_update` transaction (opening/adjusting
// a margin/collateralized-debt position) via `WalletApi.new_transaction()`
// / `WalletDb.process_transaction()` - transcribed verbatim, including
// its exact delta-collateral/delta-debt arithmetic and the
// "amount can not be 0" workaround.
//
// Two original classes, becoming:
// - `BorrowModalContent` (`BindToChainState`-wrapped, then
//   `debounceRender`-wrapped) -> `BorrowModalCore` (render/state/
//   handlers) + `BorrowModalContainer` (chain resolution) +
//   `BorrowModalContainerDebounced` (the `debounceRender` wrap, same
//   "outer debounced wrapper around the resolution layer" shape already
//   used for `MyMarkets.tsx`'s `MyMarketsDebounced`).
// - `ModalWrapper` (default export) -> `BorrowModalWrapper`.
//
// `BindToChainState(BorrowModalContent)` (no options object passed) is
// replaced by `BorrowModalContainer` + `useChainStoreTick()`, following
// `ProposalModal.tsx`'s established template for a multi-ChainTypes
// class:
// - `quoteAssetObj`/`backingAssetObj` (`ChainTypes.ChainAsset
//   .isRequired` x2) resolve via `ChainStore.getAsset(prop)` (the
//   `chain_assets` block in `BindToChainState.jsx`); both are required,
//   so `resolvedQuoteAssetObj === undefined || resolvedBackingAssetObj
//   === undefined` gates the render. Since `BorrowModalContent` declares
//   no `defaultProps.tempComponent` and the wrap site passes no
//   `{show_loader: true}`, the fallback is a blank `<span/>` (the
//   "no option" case, matching `ProposalModal.tsx`'s `FirstLevelContainer`
//   /`NestedApprovalState.tsx`'s `FirstLevel`).
// - `debtBalanceObj`/`collateralBalanceObj` (`ChainTypes.ChainObject`,
//   optional) resolve via `ChainStore.getObject(prop, false,
//   autosubscribe)` (the `chain_objects` block) - not required, so no
//   gating; they render through as `undefined` while still resolving,
//   same as the original's `this.state[key] === undefined` non-blocking
//   case.
// - `call_orders` (`ChainTypes.ChainObjectsList`, optional) resolves via
//   the local `resolveCallOrdersList` helper below, a from-scratch
//   per-file copy (this migration's established convention - see
//   `NestedApprovalState.tsx`'s `resolveAccountsList`/`ProposalModal
//   .tsx`'s `resolveAccountsList`) of `BindToChainState.jsx`'s
//   `chain_objects_list` resolution loop specifically (read precisely,
//   not assumed from the *accounts*-list variant): `index` starts at 0
//   and is incremented *before* each item is placed
//   (`prop.forEach(obj_id => { ++index; if (obj_id) {... prop_new_state
//   [index] = new_obj ...} })`), so source item 0 lands at output index
//   1, item 1 at index 2, and so on - output index 0 is always left
//   empty. This is the opposite timing from `chain_accounts_list`'s
//   (and `resolveAccountsList`'s) `forEach(obj_id => { if (obj_id)
//   {result[index] = ...} ++index; })`, which increments *after*
//   placing. The quirk has zero observable effect here: `call_orders`'
//   only reader, `getCurrentPosition`, immediately does
//   `.filter(a => !!a).find(...)` on the result, which drops the
//   always-empty index-0 slot regardless of whether it holds `undefined`
//   or is a genuine array hole.
// - `hasCallOrders` (`PropTypes.bool`, not a `ChainTypes` type) and
//   `accountObj` (not declared in `BorrowModalContent`'s `propTypes` at
//   all) both pass straight through unresolved in the original
//   (`BindToChainState`'s `render()` only strips/replaces the props it
//   actually recognizes as chain types) - passed through via
//   `BorrowModalContainer`'s `...rest` here too.
// - `BorrowModalContent = debounceRender(BorrowModalContent, 50,
//   {leading: false})` (applied *after* the `BindToChainState` wrap, so
//   it debounces the already-resolving component) becomes
//   `BorrowModalContainerDebounced`, wrapping `BorrowModalContainer`
//   with the exact same `debounceRender(..., 50, {leading: false})`
//   call.
//
// `shouldComponentUpdate` is a pure render-gating boolean (no side
// effects) - dropped entirely, per this migration's established
// convention (see `ReportModal.tsx`'s header comment). One of its five
// OR-ed conditions was itself already dead code, worth noting as
// evidence this SCU never did anything beyond gating: `!nextProps
// .backingAssetObj.get("symbol") === this.props.backingAssetObj
// .get("symbol")` compares a `boolean` (`!nextProps...get("symbol")`)
// against a `string` (`this.props...get("symbol")`) with `===` - two
// different types can never be `===`-equal, so this clause always
// evaluates to `false` and never contributes a re-render on its own,
// regardless of either symbol's value.
//
// `componentDidUpdate` (`ReactTooltip.rebuild()`, unconditional, no
// gating logic at all - unlike `shouldComponentUpdate`, there is nothing
// to separate out here) becomes a dependency-less `useEffect` using the
// usual "never fires on mount" mount-flag-ref pattern.
//
// `UNSAFE_componentWillReceiveProps` becomes another dependency-less
// mount-skip `useEffect`, with `prevAccountObjRef`/
// `prevHasCallOrdersRef`/`prevQuoteAssetIdRef` standing in for the
// "previous props" the class compared `nextProps` against (`!==` on
// `accountObj`/`hasCallOrders`, `.get("id")` on `quoteAssetObj` -
// exactly the original's own comparisons, not `Immutable.is`, which the
// dropped `shouldComponentUpdate` used instead). `stateRef.current` (not
// a plain `state` read) supplies the "current" `debtAmount`/
// `collateral`/`collateral_ratio` this effect needs, per this
// migration's standard `UNSAFE_componentWillReceiveProps` translation.
//
// Forced simplification, called out separately from every "preserved
// verbatim" note above because it does NOT reproduce the original
// exactly: `_getFeedPrice`/`_getMaintenanceRatio`/`_isPredictionMarket
// (this.props)` always read `this.props` (implicitly, or via an
// explicitly-passed `props` parameter that call sites always filled
// with `this.props`) - EXCEPT inside `_initialState`, when invoked from
// `UNSAFE_componentWillReceiveProps` as `this._initialState(nextProps)`:
// there, `_getCollateralRatio`/`_getInitialCollateralRatio` are called
// with no `props` argument, so they read `this._getFeedPrice()`/
// `this._getMaintenanceRatio()`, which read `this.props` - and at that
// exact point in the class lifecycle, `this.props` is still the OLD
// props, not yet reassigned to `nextProps`. This means the freshly
// recomputed `debt`/`collateral` (derived from `nextProps.quoteAssetObj`/
// `backingAssetObj`) get divided by a feed price computed from the OLD
// `quoteAssetObj`/`backingAssetObj` - a genuine, if obscure and almost
// certainly unintentional, inconsistency that only manifests when
// `quoteAssetObj`'s id itself changes while the component stays mounted.
// Hooks have no equivalent "old `this.props` still live alongside a new
// `nextProps` parameter" transitional window - by the time any code in a
// function component (or an effect closure inside it) runs, its `props`
// already are the latest ones, indistinguishable from what the class
// would call `nextProps`. Faithfully reproducing the staleness would
// require threading a second, ref-tracked "previous render's props"
// object through every helper in this call graph, for a narrow edge
// case; this port instead uses the single, current `quoteAssetObj`/
// `backingAssetObj` everywhere, including inside the
// `UNSAFE_componentWillReceiveProps`-derived effect. Called out
// explicitly since it doesn't fit this migration's usual "preserve every
// bug verbatim" rule.
//
// Dropped as confirmed dead (grepped, not assumed):
// - `confirmClicked`: defined, but never bound to any element or passed
//   as any prop anywhere in the file - unreachable.
// - `_maximizeDebt`: already flagged by its own `// Usage?` comment in
//   the original; grep-confirmed it's never called and never passed as
//   a prop to `BorrowModalView` (unlike `_maximizeCollateral`, which IS
//   passed as `onMaximizeCollatereal`) - unreachable.
// - `Immutable` (the default `bitsharesjs`... actually `immutable`
//   import, as `Immutable.is`): used only inside the dropped
//   `shouldComponentUpdate`. The named `{List}` import from the same
//   `immutable` package is a separate, still-used import (in
//   `BorrowModalWrapper`'s `accountObj.get("call_orders", List())
//   .toList()`), kept.
// - `ChainTypes`/`BindToChainState`/`PropTypes` imports: superseded by
//   the manual `ChainStore` resolution described above; TypeScript
//   interfaces replace `PropTypes`/`ChainTypes` declarations.
// - `ModalWrapper`'s `state.open`: initialized `false` in the
//   constructor, never read or set anywhere else (`show()` only calls
//   `props.showModal()`) - dropped; `state.smallScreen` (genuinely read,
//   for `disableHelp`) is kept.
//
// `ModalWrapper` -> `BorrowModalWrapper`: the real ref-based caller
// (`Account/MarginPosition.tsx`'s `modalRef.current.show()`, via
// `ref={modalRef}` on `<BorrowModal>`) needs `.show()` to keep working -
// `React.forwardRef`+`useImperativeHandle` exposes it, matching
// `DepositModal.tsx`'s established precedent for this exact situation.
// `UNSAFE_componentWillMount`'s `this.setState({smallScreen: window
// .innerHeight <= 800})` runs synchronously before the very first
// render, which a lazy `useState(() => window.innerHeight <= 800)`
// initializer reproduces exactly (a mount-only `useEffect` would instead
// run one tick *after* the first paint, changing the first render's
// `disableHelp` value - not used here to keep that timing intact).
//
// Note (not something this port changes, just worth naming): the real
// callers of the outer `<BorrowModal>` (`AccountPortfolioList.tsx`,
// `MarginPosition.tsx`, `Showcases/Borrow.jsx`, `Exchange.tsx`) all pass
// raw, unresolved string ids for `quoteAssetObj`/`backingAssetObj` -
// `BorrowModalWrapper`'s own render body compares those same raw id
// strings directly against `accountObj`'s balance-map keys (`id ===
// backingAssetObj`/`id === quoteAssetObj`) to find `coreBalance`/
// `bitAssetBalance`, entirely independently of (and before)
// `BorrowModalContainer`'s chain resolution of those same two props for
// `BorrowModalCore`'s own use.
import * as React from "react";
import ZfApi from "react-foundation-apps/src/utils/foundation-api";
import ReactTooltip from "react-tooltip";
import {ChainStore} from "bitsharesjs";
import utils from "common/utils";
import WalletApi from "api/WalletApi";
import WalletDb from "stores/WalletDb";
import counterpart from "counterpart";
import {List} from "immutable";
import {Modal, Button} from "bitshares-ui-style-guide";
import asset_utils from "../../lib/common/asset_utils";
import {BorrowModalView} from "./View/BorrowModalView";
import debounceRender from "react-debounce-render";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

function resolveCallOrdersList(prop: any, autosubscribe?: boolean): any[] {
    const result: any[] = [];
    if (!prop) return result;
    let index = 0;
    prop.forEach((obj_id: any) => {
        ++index;
        if (obj_id) {
            result[index] = (ChainStore as any).getObject(
                obj_id,
                false,
                autosubscribe
            );
        }
    });
    return result;
}

interface BorrowModalCoreState {
    debtAmount: any;
    collateral: any;
    collateral_ratio: any;
    target_collateral_ratio: any;
    errors: any;
    useTargetCollateral: boolean;
    original_position: any;
    unlockedInputType: string;
    isRatioLocked: boolean;
    newPosition?: any;
}

interface BorrowModalCoreProps {
    quoteAssetObj: any;
    backingAssetObj: any;
    debtBalanceObj?: any;
    collateralBalanceObj?: any;
    call_orders?: any[];
    hasCallOrders?: boolean;
    accountObj: any;
    visible: any;
    hideModal: () => void;
    showModal?: () => void;
    modalId?: any;
    disableHelp?: any;
}

function BorrowModalCore({
    quoteAssetObj,
    backingAssetObj,
    debtBalanceObj,
    collateralBalanceObj,
    call_orders,
    hasCallOrders,
    accountObj,
    visible,
    hideModal,
    modalId,
    disableHelp
}: BorrowModalCoreProps) {
    const getInitialErrors = () => ({
        collateral_balance: null,
        ratio_too_high: null
    });

    const checkIsPredictionMarket = () =>
        quoteAssetObj.getIn(["bitasset", "is_prediction_market"]);

    const getFeedPrice = (): number => {
        if (checkIsPredictionMarket()) return 1;
        return (
            1 /
            (utils as any).get_asset_price(
                asset_utils
                    .extractRawFeedPrice(quoteAssetObj)
                    .getIn(["quote", "amount"]),
                backingAssetObj,
                asset_utils
                    .extractRawFeedPrice(quoteAssetObj)
                    .getIn(["base", "amount"]),
                quoteAssetObj
            )
        );
    };

    const getMaintenanceRatio = (): number =>
        quoteAssetObj.getIn([
            "bitasset",
            "current_feed",
            "maintenance_collateral_ratio"
        ]) / 1000;

    const getCollateralRatio = (debt: any, collateral: any) =>
        collateral / (debt / getFeedPrice());

    const getInitialCollateralRatio = () =>
        checkIsPredictionMarket() ? 1 : getMaintenanceRatio() * 2;

    const getCurrentPosition = () => {
        let currentPosition: any = {collateral: null, debt: null};
        if (hasCallOrders && call_orders) {
            currentPosition = (call_orders as any)
                .filter((a: any) => !!a)
                .find(
                    (a: any) =>
                        a.getIn(["call_price", "quote", "asset_id"]) ===
                        quoteAssetObj.get("id")
                );
            currentPosition = !!currentPosition
                ? currentPosition.toJS()
                : {collateral: null, debt: null};
        }
        return currentPosition;
    };

    const computeInitialState = (): BorrowModalCoreState => {
        const currentPosition = getCurrentPosition();

        if (currentPosition.collateral) {
            const debt = (utils as any).get_asset_amount(
                currentPosition.debt,
                quoteAssetObj
            );
            const collateral = (utils as any).get_asset_amount(
                currentPosition.collateral,
                backingAssetObj
            );

            const target_collateral_ratio = !isNaN(
                currentPosition.target_collateral_ratio
            )
                ? currentPosition.target_collateral_ratio / 1000
                : 0;

            return {
                debtAmount: debt ? debt.toString() : null,
                collateral: collateral ? collateral.toString() : null,
                collateral_ratio: getCollateralRatio(debt, collateral),
                target_collateral_ratio: target_collateral_ratio,
                errors: getInitialErrors(),
                useTargetCollateral: target_collateral_ratio > 0 ? true : false,
                original_position: {
                    debt: debt,
                    collateral: collateral,
                    target_collateral_ratio: target_collateral_ratio
                },
                unlockedInputType: "collateral",
                isRatioLocked: true
            };
        } else {
            return {
                debtAmount: 0,
                collateral: 0,
                collateral_ratio: getInitialCollateralRatio(),
                target_collateral_ratio: getMaintenanceRatio(),
                errors: getInitialErrors(),
                useTargetCollateral: false,
                original_position: {
                    debt: 0,
                    collateral: 0
                },
                unlockedInputType: "debt",
                isRatioLocked: true
            };
        }
    };

    const [state, setState] = React.useState<BorrowModalCoreState>(
        computeInitialState
    );
    const mergeState = (patch: Partial<BorrowModalCoreState>) =>
        setState(prev => ({...prev, ...patch}));
    const stateRef = React.useRef(state);
    stateRef.current = state;

    const validateFields = (newState: any) => {
        const errors: any = getInitialErrors();
        const {original_position} = stateRef.current;
        const collateralBalanceObjJS = !collateralBalanceObj
            ? {balance: 0}
            : collateralBalanceObj.toJS();

        const maintenanceRatio = getMaintenanceRatio();
        const originalCR = getCollateralRatio(
            original_position.debt,
            original_position.collateral
        );
        const isOriginalBelowMCR =
            original_position.collateral > 0 && originalCR < maintenanceRatio;

        if (
            parseFloat(newState.collateral) - original_position.collateral >
            (utils as any).get_asset_amount(
                collateralBalanceObjJS.balance,
                backingAssetObj.toJS()
            )
        ) {
            errors.collateral_balance = counterpart.translate(
                "borrow.errors.collateral"
            );
        }

        if (
            newState.target_collateral_ratio &&
            newState.target_collateral_ratio < maintenanceRatio
        ) {
            errors.tcr_below_maintenance = counterpart.translate(
                "borrow.errors.below_mcr_tcr",
                {mr: maintenanceRatio}
            );
        }

        if (
            isOriginalBelowMCR &&
            newState.debtAmount > original_position.debt
        ) {
            errors.below_maintenance = counterpart.translate(
                "borrow.errors.increased_debt_on_margin_call"
            );
        } else if (
            isOriginalBelowMCR &&
            parseFloat(newState.collateral_ratio) <=
                parseFloat(originalCR as any)
        ) {
            errors.below_maintenance = counterpart.translate(
                "borrow.errors.below_ratio_mcr_update",
                {ocr: originalCR.toFixed(4)}
            );
        } else if (
            !isOriginalBelowMCR &&
            parseFloat(newState.collateral_ratio) <
                (checkIsPredictionMarket() ? 1 : maintenanceRatio)
        ) {
            errors.below_maintenance = counterpart.translate(
                "borrow.errors.below",
                {mr: maintenanceRatio}
            );
        } else if (
            parseFloat(newState.collateral_ratio) <
            (checkIsPredictionMarket() ? 1 : maintenanceRatio + 0.5)
        ) {
            errors.close_maintenance = counterpart.translate(
                "borrow.errors.close",
                {mr: maintenanceRatio}
            );
        }

        mergeState({errors});
    };

    const setUpdatedPosition = (newState: any) => {
        mergeState({
            newPosition:
                parseFloat(newState.debtAmount) / parseFloat(newState.collateral)
        });
    };

    const onBorrowChange = (e: any) => {
        const feed_price = getFeedPrice();
        const amount: any = e.amount.replace(/,/g, "");

        const collateral = !state.isRatioLocked
            ? state.collateral
            : (
                  state.collateral_ratio *
                  ((amount / feed_price).toFixed(
                      backingAssetObj.get("precision")
                  ) as any)
              ).toFixed(backingAssetObj.get("precision"));

        const collateral_ratio = state.isRatioLocked
            ? state.collateral_ratio
            : state.collateral / (amount / feed_price);

        const newState = {
            debtAmount: amount,
            collateral: collateral,
            collateral_ratio: collateral_ratio
        };

        mergeState(newState);
        validateFields(newState);
        setUpdatedPosition(newState);
    };

    const onCollateralChange = (e: any) => {
        const {isRatioLocked, collateral_ratio} = state;
        const amount: any = e.amount.replace(/,/g, "");

        const feed_price = getFeedPrice();
        const collateralRatio = !isRatioLocked
            ? amount / (state.debtAmount / feed_price)
            : collateral_ratio;

        const debtAmount = !isRatioLocked
            ? state.debtAmount
            : ((amount * feed_price) / collateralRatio).toFixed(
                  backingAssetObj.get("precision")
              );

        const newState = checkIsPredictionMarket()
            ? {
                  debtAmount: amount,
                  collateral: amount,
                  collateral_ratio: 1
              }
            : {
                  debtAmount: debtAmount,
                  collateral: amount,
                  collateral_ratio: collateralRatio
              };

        mergeState(newState);
        validateFields(newState);
        setUpdatedPosition(newState);
    };

    const onTargetRatioChange = (e: any) => {
        let target = e.target.value;
        // Ensure input is valid
        const regexp_numeral = new RegExp(/[[:digit:]]/);
        if (!regexp_numeral.test(target)) {
            target = target.replace(/[^0-9.]/g, "");
        }

        const newState = {
            target_collateral_ratio: target
        };

        mergeState(newState);
        validateFields(newState);
        setUpdatedPosition(newState);
    };

    const onRatioChange = (e: any) => {
        const feed_price = getFeedPrice();
        let debtAmount;
        let collateral;
        let ratio: any = 0;

        if (e.target) {
            // Ensure input is valid
            const regexp_numeral = new RegExp(/[[:digit:]]/);
            if (!regexp_numeral.test(e.target.value)) {
                e.target.value = e.target.value.replace(/[^0-9.]/g, "");
            }
            ratio = e.target.value;
        } else {
            ratio = e;
        }

        if (state.unlockedInputType == "debt") {
            debtAmount = (
                (state.collateral * feed_price) /
                parseFloat(ratio)
            ).toFixed(backingAssetObj.get("precision"));
            collateral = state.collateral;
        } else {
            debtAmount = state.debtAmount;
            collateral = (
                (state.debtAmount / feed_price) *
                parseFloat(ratio)
            ).toFixed(backingAssetObj.get("precision"));
        }

        const newState = {
            debtAmount: debtAmount,
            collateral: collateral,
            collateral_ratio: ratio
        };

        mergeState(newState);
        validateFields(newState);
        setUpdatedPosition(newState);
    };

    const maximizeCollateral = () => {
        const currentPosition = getCurrentPosition();
        let initialCollateralTyped = 0;
        if (currentPosition.collateral) {
            initialCollateralTyped = (utils as any).convert_satoshi_to_typed(
                currentPosition.collateral,
                backingAssetObj
            );
        }

        const backingAssetBalanceTyped = (utils as any).convert_satoshi_to_typed(
            collateralBalanceObj.get("balance"),
            backingAssetObj
        );

        // make sure we don't go over the maximum available collateral balance, and also not negative
        const maximizedCollateral = Math.max(
            Math.floor(backingAssetBalanceTyped + initialCollateralTyped - 10),
            0
        );

        onCollateralChange(new Object({amount: maximizedCollateral.toString()}));
    };

    const payDebt = () => {
        const currentPosition = getCurrentPosition();

        if (currentPosition.debt <= 0) {
            return;
        }

        const debtAmount = (utils as any).get_asset_amount(
            Math.max(currentPosition.debt - debtBalanceObj.get("balance"), 0),
            quoteAssetObj
        );

        onBorrowChange({
            amount: debtAmount.toString()
        });
    };

    const setUseTargetCollateral = () => {
        mergeState({
            useTargetCollateral: !state.useTargetCollateral
        });
    };

    const onLockChange = (type: string) => {
        mergeState({
            isRatioLocked: false,
            unlockedInputType: type
        });
    };

    const onLockCR = () => {
        mergeState({
            isRatioLocked: !state.isRatioLocked
        });
    };

    const onSubmit = (e: any) => {
        e.preventDefault();

        hideModal();

        const quotePrecision = (utils as any).get_asset_precision(
            quoteAssetObj.get("precision")
        );
        const backingPrecision = (utils as any).get_asset_precision(
            backingAssetObj.get("precision")
        );
        const currentPosition = getCurrentPosition();

        const isTCR =
            typeof state.target_collateral_ratio !== "undefined" &&
            state.target_collateral_ratio > 0 &&
            state.useTargetCollateral
                ? true
                : false;

        let extensionsProp: any = false;

        if (isTCR) {
            extensionsProp = {
                target_collateral_ratio: parseInt(
                    (state.target_collateral_ratio * 1000) as any,
                    10
                )
            };
        }

        let delta_collateral_amount = parseInt(
            (state.collateral * backingPrecision -
                currentPosition.collateral) as any,
            10
        );
        const delta_debt_amount = parseInt(
            (state.debtAmount * quotePrecision - currentPosition.debt) as any,
            10
        );

        // Amount can not be 0
        if (delta_collateral_amount == 0 && delta_debt_amount == 0) {
            delta_collateral_amount = 1;
        }

        const tr = (WalletApi as any).new_transaction();
        if (extensionsProp) {
            tr.add_type_operation("call_order_update", {
                fee: {
                    amount: 0,
                    asset_id: 0
                },
                funding_account: accountObj.get("id"),
                delta_collateral: {
                    amount: delta_collateral_amount,
                    asset_id: backingAssetObj.get("id")
                },
                delta_debt: {
                    amount: delta_debt_amount,
                    asset_id: quoteAssetObj.get("id")
                },
                extensions: extensionsProp
            });
        } else {
            tr.add_type_operation("call_order_update", {
                fee: {
                    amount: 0,
                    asset_id: 0
                },
                funding_account: accountObj.get("id"),
                delta_collateral: {
                    amount: delta_collateral_amount,
                    asset_id: backingAssetObj.get("id")
                },
                delta_debt: {
                    amount: delta_debt_amount,
                    asset_id: quoteAssetObj.get("id")
                }
            });
        }
        (WalletDb as any).process_transaction(tr, null, true).catch((err: any) => {
            if (__DEV__) {
                console.log("unlock failed:", err);
            }
        });

        (ZfApi as any).publish(modalId, "close");
    };

    const isMountRef1 = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef1.current) {
            isMountRef1.current = false;
            return;
        }
        ReactTooltip.rebuild();
    });

    React.useEffect(() => {
        const newState = computeInitialState();
        mergeState(newState);
        setUpdatedPosition(newState);
        // set max on mount todo: discuss if feasible default
        // this._maximizeCollateral();
    }, []);

    const isMountRef2 = React.useRef(true);
    const prevAccountObjRef = React.useRef(accountObj);
    const prevHasCallOrdersRef = React.useRef(hasCallOrders);
    const prevQuoteAssetIdRef = React.useRef(quoteAssetObj.get("id"));
    React.useEffect(() => {
        if (isMountRef2.current) {
            isMountRef2.current = false;
            prevAccountObjRef.current = accountObj;
            prevHasCallOrdersRef.current = hasCallOrders;
            prevQuoteAssetIdRef.current = quoteAssetObj.get("id");
            return;
        }

        const {debtAmount, collateral, collateral_ratio} = stateRef.current;

        if (
            accountObj !== prevAccountObjRef.current ||
            hasCallOrders !== prevHasCallOrdersRef.current ||
            quoteAssetObj.get("id") !== prevQuoteAssetIdRef.current
        ) {
            const newState: any = computeInitialState();

            let revalidate = false;
            if (debtAmount || collateral || collateral_ratio) {
                newState.debtAmount = debtAmount;
                newState.collateral = collateral;
                newState.collateral_ratio = collateral_ratio;
                revalidate = true;
            }

            mergeState(newState);

            if (revalidate) {
                validateFields(newState);
            }
        }

        prevAccountObjRef.current = accountObj;
        prevHasCallOrdersRef.current = hasCallOrders;
        prevQuoteAssetIdRef.current = quoteAssetObj.get("id");
    });

    const {
        debtAmount,
        collateral,
        errors,
        original_position,
        useTargetCollateral
    } = state;
    let {collateral_ratio, target_collateral_ratio} = state;

    if (
        !collateral_ratio ||
        isNaN(collateral_ratio) ||
        !(collateral_ratio > 0.0 && collateral_ratio < 1000.0)
    ) {
        collateral_ratio = 0;
    }

    // Ensure we don't get massive decimal placement
    if (
        collateral_ratio.toString().indexOf(".") != -1 &&
        collateral_ratio.toString().split(".")[1].length > 2
    ) {
        collateral_ratio =
            collateral_ratio.toString().split(".")[0] +
            "." +
            collateral_ratio
                .toString()
                .split(".")[1]
                .substr(0, 2);
    }

    if (
        target_collateral_ratio.toString().indexOf(".") != -1 &&
        target_collateral_ratio.toString().split(".")[1].length > 2
    ) {
        target_collateral_ratio =
            target_collateral_ratio.toString().split(".")[0] +
            "." +
            target_collateral_ratio
                .toString()
                .split(".")[1]
                .substr(0, 2);
    }

    const debtBalanceObjJS = !debtBalanceObj
        ? {balance: 0, id: null}
        : debtBalanceObj.toJS();

    const collateralBalanceObjJS = !collateralBalanceObj
        ? {balance: 0, id: null}
        : collateralBalanceObj.toJS();

    const backingPrecision = (utils as any).get_asset_precision(
        backingAssetObj.get("precision")
    );
    const debtPrecision = (utils as any).get_asset_precision(
        quoteAssetObj.get("precision")
    );

    // Dynamically update user's remaining collateral
    const currentPosition = getCurrentPosition();
    const collateralChange = parseInt(
        (state.collateral * backingPrecision -
            currentPosition.collateral) as any,
        10
    );

    const debtChange = parseInt(
        (state.debtAmount * debtPrecision - currentPosition.debt) as any,
        10
    );

    const remainingBackingBalance = collateralBalanceObjJS.balance - collateralChange;
    const remainingDebtBalance = debtBalanceObjJS.balance + debtChange;

    const feed_price = getFeedPrice();

    const maintenanceRatio = getMaintenanceRatio();

    const isPredictionMarket = checkIsPredictionMarket();

    const isOriginalBelowMCR =
        original_position.collateral > 0 &&
        getCollateralRatio(
            original_position.debt,
            original_position.collateral
        ) < maintenanceRatio;

    const footer: any[] = [];

    const resetModal = () => {
        mergeState(computeInitialState());
    };

    if (!isPredictionMarket && isNaN(feed_price)) {
        footer.push(
            <Button tabIndex={6} onClick={hideModal}>
                {counterpart.translate("accountObj.perm.cancel")}
            </Button>
        );
    } else {
        footer.push(
            <Button tabIndex={6} key="submit" type="primary" onClick={onSubmit}>
                {counterpart.translate("borrow.adjust")}
            </Button>
        );
        footer.push(
            <Button tabIndex={7} key="cancel" onClick={resetModal}>
                {counterpart.translate("wallet.reset")}
            </Button>
        );
    }

    return (
        <Modal
            title={counterpart.translate("borrow.title", {
                asset_symbol: quoteAssetObj.get("symbol")
            })}
            visible={visible}
            onCancel={hideModal}
            footer={footer}
        >
            <BorrowModalView
                // Objects
                accountObj={accountObj}
                backingAssetObj={backingAssetObj}
                collateralBalanceObj={collateralBalanceObjJS}
                debtBalanceObj={debtBalanceObjJS}
                quoteAssetObj={quoteAssetObj}
                newPosition={state.newPosition || null}
                errors={errors}
                // Strings, Floats and Numbers
                collateral={collateral}
                collateral_ratio={collateral_ratio}
                debtAmount={debtAmount}
                backingPrecision={backingPrecision}
                maintenanceRatio={maintenanceRatio}
                remainingBackingBalance={remainingBackingBalance}
                remainingDebtBalance={remainingDebtBalance}
                target_collateral_ratio={target_collateral_ratio}
                unlockedInputType={state.unlockedInputType}
                // Bool Flags
                disableHelp={disableHelp}
                isRatioLocked={state.isRatioLocked}
                isOriginalBelowMCR={isOriginalBelowMCR}
                isPredictionMarket={isPredictionMarket}
                isValid={
                    isPredictionMarket ||
                    (!isPredictionMarket && !isNaN(feed_price))
                }
                useTargetCollateral={useTargetCollateral}
                // Actions
                onBorrowChange={onBorrowChange}
                onCollateralChange={onCollateralChange}
                onMaximizeCollatereal={maximizeCollateral}
                onRatioChange={onRatioChange}
                onLockChangeCR={onLockCR}
                onLockChangeCollateral={() => onLockChange("debt")}
                onLockChangeDebt={() => onLockChange("collateral")}
                onPayDebt={payDebt}
                onTCRatioChange={onTargetRatioChange}
                onSetUseTCR={setUseTargetCollateral}
            />
        </Modal>
    );
}

interface BorrowModalContainerProps {
    quoteAssetObj: any;
    backingAssetObj: any;
    debtBalanceObj?: any;
    collateralBalanceObj?: any;
    call_orders?: any;
    [key: string]: any;
}

function BorrowModalContainer({
    quoteAssetObj,
    backingAssetObj,
    debtBalanceObj,
    collateralBalanceObj,
    call_orders,
    ...rest
}: BorrowModalContainerProps) {
    useChainStoreTick();

    const resolvedQuoteAssetObj = quoteAssetObj
        ? (ChainStore as any).getAsset(quoteAssetObj)
        : undefined;
    const resolvedBackingAssetObj = backingAssetObj
        ? (ChainStore as any).getAsset(backingAssetObj)
        : undefined;

    if (
        resolvedQuoteAssetObj === undefined ||
        resolvedBackingAssetObj === undefined
    ) {
        return <span />;
    }

    const resolvedDebtBalanceObj = debtBalanceObj
        ? (ChainStore as any).getObject(debtBalanceObj, false, undefined)
        : undefined;
    const resolvedCollateralBalanceObj = collateralBalanceObj
        ? (ChainStore as any).getObject(collateralBalanceObj, false, undefined)
        : undefined;
    const resolvedCallOrders = resolveCallOrdersList(call_orders, undefined);

    return (
        <BorrowModalCore
            {...(rest as any)}
            quoteAssetObj={resolvedQuoteAssetObj}
            backingAssetObj={resolvedBackingAssetObj}
            debtBalanceObj={resolvedDebtBalanceObj}
            collateralBalanceObj={resolvedCollateralBalanceObj}
            call_orders={resolvedCallOrders}
        />
    );
}

const BorrowModalContainerDebounced: any = debounceRender(
    BorrowModalContainer,
    50,
    {leading: false}
);

interface BorrowModalWrapperProps {
    visible: any;
    hideModal: () => void;
    showModal?: (...args: any[]) => void;
    quoteAssetObj: any;
    backingAssetObj: any;
    accountObj: any;
    modalId?: any;
}

interface BorrowModalHandle {
    show: () => void;
}

const BorrowModalWrapper = React.forwardRef<
    BorrowModalHandle,
    BorrowModalWrapperProps
>((props, ref) => {
    const [smallScreen] = React.useState(() => window.innerHeight <= 800);

    React.useImperativeHandle(ref, () => ({
        show: () => {
            (props.showModal as any)();
        }
    }));

    const {quoteAssetObj, backingAssetObj, accountObj} = props;
    const accountObjBalance = accountObj.get("balances").toJS();
    let coreBalance, bitAssetBalance;

    if (accountObjBalance) {
        for (const id in accountObjBalance) {
            if (id === backingAssetObj) {
                coreBalance = accountObjBalance[id];
            }

            if (id === quoteAssetObj) {
                bitAssetBalance = accountObjBalance[id];
            }
        }
    }

    return props.visible ? (
        <BorrowModalContainerDebounced
            visible={props.visible}
            hideModal={props.hideModal}
            showModal={props.showModal}
            quoteAssetObj={quoteAssetObj}
            call_orders={accountObj.get("call_orders", List()).toList()}
            hasCallOrders={
                accountObj.get("call_orders") &&
                accountObj.get("call_orders").size > 0
            }
            modalId={props.modalId}
            debtBalanceObj={bitAssetBalance}
            collateralBalanceObj={coreBalance}
            backingAssetObj={backingAssetObj}
            disableHelp={smallScreen}
            accountObj={accountObj}
        />
    ) : null;
});

BorrowModalWrapper.displayName = "BorrowModalWrapper";

export default BorrowModalWrapper;
