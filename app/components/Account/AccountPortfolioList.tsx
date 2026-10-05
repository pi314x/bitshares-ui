// TypeScript/functional-component port of the legacy
// AccountPortfolioList.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical
// class-to-hooks translation, no logic changes. This is the last file of
// the `Account/` directory's long tail.
//
// Non-security-sensitive per AGENTS.md: grepped this file for `WalletApi`,
// `WalletDb`, `.add_type_operation`, `process_transaction` - none appear.
// This component only orchestrates opening/closing the transaction-building
// modals (`SendModal`, `WithdrawModal`, `DepositModal`, `BorrowModal`,
// `SettleModal`, `ReserveAssetModal`);
// the actual transaction building/signing lives inside those separately
// owned (and separately ported/reviewed) components.
//
// Structural changes:
// - The original's `connect(AccountPortfolioList, {listenTo: [
//   SettingsStore, GatewayStore, MarketsStore], getProps})` is replaced by
//   an outer `AccountPortfolioList` wrapper that calls `useAltStore` once
//   per store (the established multi-store pattern, e.g.
//   `MyMarkets.tsx`/`AccountPools.tsx`) and passes the store-derived
//   values as explicit props into the debounced core component - the same
//   "outer wrapper gathers stores, inner component stays a plain
//   `debounceRender`-wrapped function" shape used by `MyMarkets.tsx`. Prop
//   precedence is preserved exactly: alt-react's `connect` renders
//   `<Component {...this.props} {...this.getNextProps()} />` (see
//   `node_modules/alt-react/src/connect.js`), i.e. store-derived props
//   always win over same-named props the caller passed directly - this is
//   why `AccountOverview.tsx`'s second call site passing its own
//   `settings` prop was always overridden by `SettingsStore`'s `settings`
//   in the original, and remains so here (the wrapper spreads `{...props}`
//   first, then the store-derived props after, same override order).
// - `debounceRender(AccountPortfolioList, 50, {leading: false})` is kept,
//   now wrapping the core function component, matching the pattern already
//   used for `FeeAssetSelector.tsx`/`MyMarkets.tsx`.
// - No `BindToChainState` wrapping existed in the original (verified: only
//   `connect` + `debounceRender` at the bottom of the `.jsx`), so no
//   Container/`useChainStoreTick` translation was needed here.
// - `UNSAFE_componentWillMount`/`componentWillUnmount` wrapping
//   `setInterval(this._checkRefAssignments)` becomes a mount-only
//   `useEffect(() => {...}, [])` that sets up the same interval and clears
//   it on unmount (or as soon as the check succeeds, same as the
//   original). `this.changeRefs` (a plain mutable dictionary keyed by
//   asset symbol, populated during `_renderBalances` and read by the
//   `changeValue` sort comparator) becomes `changeRefsRef.current`, a
//   `useRef<{[key: string]: any}>({})` mutated the same way.
//   `state.allRefsAssigned`'s *value* is never read anywhere in the
//   original besides the interval's own gate
//   (`if (!this.state.allRefsAssigned)`) - it exists purely so that
//   calling `setState` forces a re-render once `changeRefs` has entries
//   (otherwise nothing would ever re-render to pick up the mutated ref
//   data for "sort by 24h change"). Kept as real state for exactly that
//   reason, not because its value is consumed.
// - `shouldComponentUpdate` is dropped, per this migration's firm
//   precedent (see `AccountPools.tsx`/`AccountOrders.tsx`/
//   `RecentTransactions.tsx` header comments): there is no hooks
//   equivalent for a component gating its own re-renders this way, and
//   dropping it changes only how often identical output is recomputed,
//   never the output itself.
// - `this.sortFunctions` (an object of methods that called each other via
//   `this.sortFunctions.X(...)` and read `this.props`/`this.changeRefs`)
//   becomes a set of plain closures rebuilt each render (`byKey`,
//   `byTypedValue`, `byInCollateral`, `byBalance`, `byVestingBalance`,
//   `byInOrders`, `byEquivalentPrice`, `totalValue`, `changeValue`)
//   collected into a `sortFunctions` object for `getHeader`'s `sorter`
//   fields, with the internal `this.sortFunctions.byKey(...)`-style calls
//   becoming direct calls between the sibling closures. `sortFunctions` is
//   never compared by reference or stored anywhere, so rebuilding it every
//   render (like every other closure in this port) is safe.
// - `_sumCollateralBalances`/`_sumVestingBalances` never read
//   `this.props`/`this.state`/refs (pure functions of their `balances`
//   argument), so per this migration's convention they're extracted to
//   module scope as `sumCollateralBalances`/`sumVestingBalances`.
// - All other instance methods (`_renderBalances`,
//   `_renderGatewayAction`, `_renderSendModal`, `_renderBorrowModal`,
//   `_renderSettleModal`, `getHeader`, `toggleSortOrder`, `triggerSend`,
//   `_onSettleAsset`, `_hideAsset`, `_burnAsset`, `_showDepositModal`,
//   `_showDepositWithdraw`, the `show*Modal`/`hide*Modal` pairs) become
//   `const` closures inside the component, keeping their original names
//   (including the leading-underscore "private helper" ones) to avoid any
//   naming collision with the arg-less `show*Modal`/`hide*Modal` pairs and
//   to keep the diff mechanical.
// - Legacy string refs: none exist in this file. The one instance-level
//   ref (`this.send_modal`, set via a plain callback prop named
//   `refCallback`, not React's `ref=`) is preserved as-is: `SendModal.tsx`
//   was already ported with this exact external caller in mind - its
//   default export is a `SendModalRefBridge` that accepts `refCallback`
//   and forwards it as a real `ref` to an internal `React.forwardRef` +
//   `useImperativeHandle({show})` component (see that file's header
//   comment, which explicitly names this file's `this.send_modal.show()`
//   call as the usage it was designed to keep working). Ported here as
//   `sendModalRef = useRef<{show: () => void} | null>(null)`.
// - `setState(update, callback)` two-arg calls: `triggerSend`,
//   `_showDepositModal`, and `_showDepositWithdraw` all pass a callback
//   that only reads refs/props/other untouched state (never the
//   just-applied field), so each is translated to `mergeState(...)`
//   followed by the callback's body invoked synchronously right after, per
//   this migration's established `AccountPools.tsx`-precedent rule.
//
// Confirmed-dead code dropped (grepped, not assumed):
// - `_getSeparator` - fully defined, never called anywhere in the file.
// - The `fiatModal` state field - written by `_showDepositWithdraw`
//   (`setState({[...]: asset, fiatModal}, ...)`) but never read anywhere
//   else in the file (grepped `fiatModal`: only the parameter and the one
//   `setState` call reference it). Dropped entirely, including from
//   `_showDepositWithdraw`'s signature translation.
// - The connect-provided `viewSettings` prop's only remaining use (besides
//   the one-time constructor read of `portfolioSort`/`portfolioSortDirection`
//   described above) is that constructor read; nothing else in the file
//   touches `props.viewSettings` again after mount, so - like the
//   original class, which never re-derives these two state fields from a
//   later `viewSettings` change - the ported `useState` initializer reads
//   `viewSettings` once (lazy initializer) and is never resynced. This is
//   a preserved quirk, not a fix opportunity: `toggleSortOrder` updates
//   `SettingsStore` (via `SettingsActions.changeViewSetting`) but never
//   calls `setState` on this component, so `state.portfolioSort`/
//   `state.portfolioSortDirection` (used only to set `defaultSortOrder` on
//   the header items) reflect only whatever `viewSettings` held at the
//   very first render, exactly as in the class version.
//
// Preserved verbatim (not "fixed"), all grep-verified:
// - `getHeader`'s `preferredUnit` local: `settings.get("unit") ||
//   this.props.core_asset.get("symbol")` reads `props.core_asset`
//   (snake_case) - but `AccountOverview.tsx` (the only caller) only ever
//   passes `coreAsset` (camelCase); `core_asset` is never a real prop of
//   this component. In practice this fallback branch is unreachable
//   without throwing, because `SettingsStore` always seeds a default
//   `"unit"` value on init (`app/stores/SettingsStore.js`:
//   `this.settings = this.settings.set("unit", this.defaults.unit[0])`
//   whenever the stored value isn't one of the known defaults), so
//   `settings.get("unit")` is essentially always truthy and the `||`
//   short-circuits before ever touching the nonexistent prop. Ported as a
//   literal reference to a prop this component doesn't declare (typed
//   `any`) rather than "corrected" to `coreAsset`, since that would be a
//   behavior change this migration's rules don't allow. Note this local
//   `preferredUnit` (used only inside `getHeader`, for the price-column
//   header text and the `EquivalentPrice`/`BalanceValueComponent` cells)
//   is a *different* value from the `preferredUnit` *prop* used inside
//   `_renderBalances` for market/link computations - both existed
//   side-by-side under the same name in the original and remain so here.
// - `getHeader`'s `shownAssets` local (`let {shownAssets} = this.state;`,
//   used only for the "hide" column's header title: `shownAssets ==
//   "active" ? "exchange.hide" : "account.perm.show"`) reads a state field
//   that is never initialized nor ever set anywhere in the whole file
//   (grepped `shownAssets`: only this one destructure and the one
//   ternary). It is always `undefined`, so the header title always
//   resolves to `"account.perm.show"`. Ported as a literal `undefined`
//   (there is no real state field to read), preserving the always-false
//   comparison rather than inventing a real show/hide-assets toggle.
// - `sortFunctions.changeValue`'s `parseFloat(aValue) != "NaN"` (and the
//   `bValue` twin): comparing a `number` to the *string* `"NaN"` with
//   loose `!=` is always `true` (the string coerces to the numeric `NaN`,
//   and any `!=` comparison against `NaN` is always `true`), so this
//   ternary always takes the `parseFloat(aValue)` branch; the `: aValue`
//   fallback is dead. Almost certainly meant to be `isNaN(parseFloat(
//   aValue))`, but transcribed exactly as written.
// - `_hideDeleteModal`-style asymmetry is not present here, but a similar
//   one is: `showBorrowModal`'s `borrow` object is cleared to `null` by
//   `hideBorrowModal`, while every other `xxxAsset` state
//   field is simply left holding its last value after its modal is
//   hidden (only the `isXxxModalVisible` flag flips) - exactly as in the
//   original, not equalized here.
// - The second `AccountPortfolioList` call site in `AccountOverview.tsx`
//   never passes `callOrders` or `coreAsset` (only the first, "included
//   assets" call does) - `_renderBalances`'s `(this.props.callOrders ||
//   [])` already tolerates the missing `callOrders`, and a missing
//   `coreAsset` simply flows into `getFinalPrice(..., coreAsset, ...)` as
//   `undefined` for the hidden-assets table, same as before.
// - `enabledColumns` (passed by `AccountOverview.tsx`'s second call site)
//   and `settings`/`viewSettings` (passed directly by callers) are never
//   read from props inside this component (settings/viewSettings are
//   always taken from the stores instead, per the override order above) -
//   accepted where TypeScript requires it, otherwise simply ignored,
//   matching the original class ignoring them too.
//
// TS-forced adjustments (no behavior change):
// - `react-router-dom`'s `Link` is aliased through
//   `React.ComponentType<any>` (this repo's recurring `@types/react-router
//   -dom` friction, see e.g. `AccountPools.tsx`).
// - Sort comparator/table-row parameters are typed `any` throughout
//   (`@typescript-eslint/no-explicit-any` is a warning, not an error, in
//   this repo).
// - `getAssetAndGateway` was imported from `common/gatewayUtils` in the
//   original but never used anywhere in the file (grepped) - harmless
//   under this repo's non-gating legacy `yarn lint`, but
//   `@typescript-eslint/no-unused-vars` is an *error* for `.tsx` files
//   (see `.eslintrc`), so the unused import is dropped here to keep
//   `npx eslint` clean; `getBackedCoin` (which *is* used) is kept.
// - `EquivalentValueComponent.jsx`'s `getEquivalentValue` has a `fullPrecision
//   = null` JS default parameter; even though that file is plain `.jsx`
//   (`checkJs: false`, not in `tsconfig.json`'s `include`), `tsc` still
//   infers its exported function's parameter types from the default
//   value when a `.tsx` file imports and calls it, landing on `null |
//   undefined` for that parameter - passing the original's literal
//   `false` argument through as `false as any` at both call sites in
//   `totalValueSort` keeps the exact runtime argument.
// - One inline `<Icon onClick={e => ...}>` handler (in the
//   optional-assets deposit-icon branch) needed an explicit `(e: any)`
//   annotation; `Icon.jsx` (untyped `.jsx`) doesn't give `tsc` enough
//   context to infer the callback parameter on its own there.
// - `eslint`'s `prefer-const` (an *error*, not a warning, per `.eslintrc`)
//   flagged several `let` bindings from the original that this port never
//   reassigns after their initial single assignment
//   (`directMarketLink`/the two `let {isBitAsset...}`/`let {isBitAsset:
//   isAssetBitAsset}`/`let {isBitAsset: isBackingBitAsset}`/one of the two
//   `preferredMarket`s), following the same
//   split-out-only-the-actually-reassigned-fields fix documented in
//   `WorkersList.tsx`'s header comment. `settleLink` and the *other*
//   `preferredMarket` (the one in `_renderBalances`'s main loop, which
//   *is* conditionally reassigned by `if (notCore && preferredMarket ===
//   symbol) preferredMarket = coreSymbol;`) correctly remain `let`.
import * as React from "react";
import debounceRender from "react-debounce-render";
import BalanceComponent from "../Utility/BalanceComponent";
import {
    BalanceValueComponent,
    balanceToAsset,
    getEquivalentValue
} from "../Utility/EquivalentValueComponent";
import {Market24HourChangeComponent} from "../Utility/MarketChangeComponent";
import FormattedAsset from "../Utility/FormattedAsset";
import assetUtils from "common/asset_utils";
import counterpart from "counterpart";
import {Link} from "react-router-dom";
import EquivalentPrice from "../Utility/EquivalentPrice";
import {getFinalPrice} from "../Utility/EquivalentPrice";
import LinkToAssetById from "../Utility/LinkToAssetById";
import BorrowModal from "../Modal/BorrowModal";
import ReactTooltip from "react-tooltip";
import {getBackedCoin} from "common/gatewayUtils";
import {ChainStore} from "bitsharesjs";
import SettingsStore from "stores/SettingsStore";
import GatewayStore from "stores/GatewayStore";
import MarketsStore from "stores/MarketsStore";
import {useAltStore} from "../../next/hooks/useAltStore";
import Icon from "../Icon/Icon";
import utils from "common/utils";
import SendModal from "../Modal/SendModal";
import SettingsActions from "actions/SettingsActions";
import SettleModal from "../Modal/SettleModal";
import DepositModal from "../Modal/DepositModal";
import WithdrawModal from "../Modal/WithdrawModalNew";
import ZfApi from "react-foundation-apps/src/utils/foundation-api";
import ReserveAssetModal from "../Modal/ReserveAssetModal";
import CustomTable from "../Utility/CustomTable";
import {Tooltip, Icon as AntIcon} from "bitshares-ui-style-guide";
import Translate from "react-translate-component";
import AssetName from "../Utility/AssetName";
import TranslateWithLinks from "../Utility/TranslateWithLinks";
import MarketsActions from "actions/MarketsActions";

const LinkComponent = Link as React.ComponentType<any>;

function sumCollateralBalances(balances: any): number {
    if (!balances || balances.length == 0) return 0;
    let sum = 0;
    balances.forEach((item: any) => {
        sum = sum + +item.get("collateral");
    });
    return sum;
}

function sumVestingBalances(balances: any): number {
    if (!balances || balances.length == 0) return 0;
    let sum = 0;
    balances.forEach((item: any) => {
        sum = sum + balanceToAsset(item).amount;
    });
    return sum;
}

interface AccountPortfolioListState {
    isSettleModalVisible: boolean;
    isBorrowModalVisible: boolean;
    isDepositModalVisible: boolean;
    isWithdrawModalVisible: boolean;
    isBurnModalVisible: boolean;
    isSettleModalVisibleBefore: boolean;
    isBorrowModalVisibleBefore: boolean;
    isDepositModalVisibleBefore: boolean;
    isWithdrawModalVisibleBefore: boolean;
    isBurnModalVisibleBefore: boolean;
    borrow: {quoteAsset: any; backingAsset: any; account: any} | null;
    settleAsset: any;
    depositAsset: any;
    withdrawAsset: any;
    allRefsAssigned: boolean;
    portfolioSort: any;
    portfolioSortDirection: any;
    send_asset: any;
    reserve: any;
}

interface AccountPortfolioListCoreProps {
    balanceList: any;
    optionalAssets: any;
    visible: boolean;
    preferredUnit: any;
    coreAsset?: any;
    coreSymbol: any;
    hiddenAssets: any;
    orders: any;
    account: any;
    isMyAccount: boolean;
    extraRow?: any;
    callOrders?: any;
    // Store-derived - see header comment on prop-override order.
    settings: any;
    viewSettings: any;
    backedCoins: any;
    bridgeCoins: any;
    allMarketStats: any;
}

function AccountPortfolioListCore({
    balanceList,
    optionalAssets,
    visible,
    preferredUnit,
    coreAsset,
    coreSymbol,
    hiddenAssets,
    orders,
    account,
    isMyAccount,
    extraRow,
    callOrders,
    settings,
    viewSettings,
    backedCoins,
    bridgeCoins,
    allMarketStats
}: AccountPortfolioListCoreProps) {
    const [state, setState] = React.useState<AccountPortfolioListState>(
        () => ({
            isSettleModalVisible: false,
            isBorrowModalVisible: false,
            isDepositModalVisible: false,
            isWithdrawModalVisible: false,
            isBurnModalVisible: false,
            isSettleModalVisibleBefore: false,
            isBorrowModalVisibleBefore: false,
            isDepositModalVisibleBefore: false,
            isWithdrawModalVisibleBefore: false,
            isBurnModalVisibleBefore: false,
            borrow: null,
            settleAsset: "1.3.0",
            depositAsset: null,
            withdrawAsset: null,
            allRefsAssigned: false,
            portfolioSort: viewSettings.get("portfolioSort", "value"),
            portfolioSortDirection: viewSettings.get(
                "portfolioSortDirection",
                "descend"
            ),
            send_asset: null,
            reserve: null
        })
    );

    const mergeState = (partial: Partial<AccountPortfolioListState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const changeRefsRef = React.useRef<{[key: string]: any}>({});
    const sendModalRef = React.useRef<{show: () => void} | null>(null);

    React.useEffect(() => {
        const refCheckInterval = setInterval(() => {
            if (!state.allRefsAssigned) {
                const allRefsAssigned =
                    Object.keys(changeRefsRef.current).length > 0;
                if (allRefsAssigned) {
                    clearInterval(refCheckInterval);
                    mergeState({allRefsAssigned});
                }
            }
        });
        return () => clearInterval(refCheckInterval);
        // Mount-only, matching the original's
        // UNSAFE_componentWillMount/componentWillUnmount pair.
    }, []);

    const showWithdrawModal = () => {
        mergeState({
            isWithdrawModalVisible: true,
            isWithdrawModalVisibleBefore: true
        });
    };

    const hideWithdrawModal = () => {
        mergeState({isWithdrawModalVisible: false});
    };

    const showBurnModal = () => {
        mergeState({
            isBurnModalVisible: true,
            isBurnModalVisibleBefore: true
        });
    };

    const hideBurnModal = () => {
        mergeState({isBurnModalVisible: false});
    };

    const showSettleModal = () => {
        mergeState({
            isSettleModalVisible: true,
            isSettleModalVisibleBefore: true
        });
    };

    const hideSettleModal = () => {
        mergeState({isSettleModalVisible: false});
    };

    const showDepositModal = () => {
        mergeState({
            isDepositModalVisible: true,
            isDepositModalVisibleBefore: true
        });
    };

    const hideDepositModal = () => {
        mergeState({isDepositModalVisible: false});
    };

    const showBorrowModal = (
        quoteAsset: any,
        backingAsset: any,
        borrowAccount: any
    ) => {
        mergeState({
            isBorrowModalVisible: true,
            isBorrowModalVisibleBefore: true,
            borrow: {
                quoteAsset: quoteAsset,
                backingAsset: backingAsset,
                account: borrowAccount
            }
        });
    };

    const hideBorrowModal = () => {
        mergeState({
            borrow: null,
            isBorrowModalVisible: false
        });
    };

    // sortFunctions: rebuilt fresh each render (never compared by
    // reference), closing over `coreAsset` and `changeRefsRef`.
    const byKey = (a: any, b: any) => a.key > b.key;

    const byTypedValue = (
        a: any,
        b: any,
        aValueRaw: any,
        bValueRaw: any
    ) => {
        const aValue = utils.convert_satoshi_to_typed(aValueRaw, a.asset);
        const bValue = utils.convert_satoshi_to_typed(bValueRaw, b.asset);
        if (aValue && bValue) {
            return aValue - bValue;
        } else if (!aValue && bValue) {
            return -1;
        } else if (aValue && !bValue) {
            return 1;
        } else {
            return byKey(a, b);
        }
    };

    const byInCollateral = (a: any, b: any) =>
        byTypedValue(
            a,
            b,
            sumCollateralBalances(a.inCollateral),
            sumCollateralBalances(b.inCollateral)
        );

    const byBalance = (a: any, b: any) =>
        byTypedValue(
            a,
            b,
            balanceToAsset(a.balance).amount,
            balanceToAsset(b.balance).amount
        );

    const byVestingBalance = (a: any, b: any) =>
        byTypedValue(
            a,
            b,
            sumVestingBalances(a.inVesting),
            sumVestingBalances(b.inVesting)
        );

    const byInOrders = (a: any, b: any) =>
        byTypedValue(a, b, a.inOrders, b.inOrders);

    const byEquivalentPrice = (a: any, b: any) => {
        const aPrice = getFinalPrice(
            a.asset,
            a.adds.preferredAsset,
            coreAsset,
            null,
            true
        );
        const bPrice = getFinalPrice(
            b.asset,
            b.adds.preferredAsset,
            coreAsset,
            null,
            true
        );
        if (aPrice && bPrice) {
            return aPrice - bPrice;
        } else if (!aPrice && bPrice) {
            return -1;
        } else if (aPrice && !bPrice) {
            return 1;
        } else {
            return byKey(a, b);
        }
    };

    const totalValueSort = (a: any, b: any) => {
        const aValue = getEquivalentValue(
            a.value,
            a.adds.preferredAsset,
            a.adds.asset,
            false as any
        );
        const bValue = getEquivalentValue(
            b.value,
            b.adds.preferredAsset,
            b.adds.asset,
            false as any
        );
        if (aValue && bValue) {
            return aValue - bValue;
        } else if (!aValue && bValue) {
            return -1;
        } else if (aValue && !bValue) {
            return 1;
        } else {
            return byKey(a, b);
        }
    };

    const changeValue = (a: any, b: any) => {
        const aValue = changeRefsRef.current[a.key];
        const bValue = changeRefsRef.current[b.key];

        if (aValue && bValue) {
            // Preserved verbatim: `!= "NaN"` (comparing a number to the
            // *string* "NaN") is always true, so the `: aValue` fallback
            // never runs - see header comment.
            const aChange =
                parseFloat(aValue) != ("NaN" as any)
                    ? parseFloat(aValue)
                    : aValue;
            const bChange =
                parseFloat(bValue) != ("NaN" as any)
                    ? parseFloat(bValue)
                    : bValue;
            return aChange - bChange;
        } else if (!aValue && bValue) {
            return -1;
        } else if (aValue && !bValue) {
            return 1;
        } else {
            return byKey(a, b);
        }
    };

    const sortFunctions = {
        byKey,
        byInCollateral,
        byBalance,
        byVestingBalance,
        byInOrders,
        byTypedValue,
        byEquivalentPrice,
        totalValue: totalValueSort,
        changeValue
    };

    const triggerSend = (asset: any) => {
        mergeState({send_asset: asset});
        if (sendModalRef.current) sendModalRef.current.show();
    };

    const _onSettleAsset = (id: any, e: any) => {
        e.preventDefault();
        mergeState({settleAsset: id});
        showSettleModal();
    };

    const _hideAsset = (asset: any, status: any) => {
        SettingsActions.hideAsset(asset, status);
    };

    const _burnAsset = (asset: any, e: any) => {
        e.preventDefault();
        mergeState({reserve: asset});
        showBurnModal();
    };

    const _showDepositModal = (asset: any, e: any) => {
        e.preventDefault();
        mergeState({depositAsset: asset});
        showDepositModal();
    };

    const _showDepositWithdraw = (
        action: any,
        asset: any,
        fiatModal: any,
        e: any
    ) => {
        e.preventDefault();
        mergeState({
            [action === "deposit_modal"
                ? "depositAsset"
                : "withdrawAsset"]: asset
        } as Partial<AccountPortfolioListState>);

        if (action === "deposit_modal") {
            showDepositModal();
            return true;
        }

        showWithdrawModal();
    };

    const _renderGatewayAction = (
        type: any,
        allowed: any,
        assetName: any,
        emptyCell: any
    ) => {
        const modalAction =
            type == "deposit"
                ? (e: any) => _showDepositModal(assetName, e)
                : (e: any) =>
                      _showDepositWithdraw(
                          "withdraw_modal_new",
                          assetName,
                          false,
                          e
                      );

        const actionTitle =
            type == "deposit" ? `icons.${type}.${type}` : `icons.${type}`;

        const linkElement = (
            <span>
                <Icon
                    style={{
                        cursor: isMyAccount ? "pointer" : "help"
                    }}
                    name={type}
                    title={actionTitle}
                    className="icon-14x"
                    onClick={isMyAccount ? modalAction : null}
                />
            </span>
        );
        if (allowed && isMyAccount) {
            return linkElement;
        } else if (allowed && !isMyAccount) {
            return (
                <Tooltip
                    title={counterpart.translate("tooltip.login_required")}
                >
                    {linkElement}
                </Tooltip>
            );
        } else {
            return emptyCell;
        }
    };

    const toggleSortOrder = (pagination: any, filters: any, sorter: any) => {
        SettingsActions.changeViewSetting({
            portfolioSortDirection: sorter.order,
            portfolioSort: sorter.columnKey
        });
    };

    const getHeader = (atLeastOneHas: any) => {
        // Preserved verbatim: `this.props.core_asset` is not a real prop
        // of this component (see header comment) - `settings.get("unit")`
        // always has a default, so this fallback is unreachable in
        // practice.
        const preferredUnitHeader =
            settings.get("unit") || (coreAsset as any)?.get?.("symbol");
        const showAssetPercent = settings.get("showAssetPercent", false);
        // Preserved verbatim: `shownAssets` was never a real state field
        // in the original either (see header comment) - always
        // `undefined`.
        const shownAssets = undefined;

        const headerItems: any[] = [
            {
                title: <Translate content="account.asset" />,
                dataIndex: "asset",
                align: "left",
                customizable: false,
                sorter: sortFunctions.byKey,
                render: (item: any) => {
                    return (
                        <span style={{whiteSpace: "nowrap"}}>
                            <LinkToAssetById asset={item.get("id")} />
                        </span>
                    );
                }
            },
            {
                title: <Translate content="account.qty" />,
                dataIndex: "balance",
                align: "right",
                customizable: false,
                sorter: sortFunctions.byBalance,
                render: (item: any) => {
                    return (
                        <span style={{whiteSpace: "nowrap"}}>
                            <BalanceComponent
                                balance={item.get("id")}
                                hide_asset
                            />
                        </span>
                    );
                }
            },
            {
                className: "column-hide-small",
                title: <Translate content="account.inOrders" />,
                dataIndex: "inOrders",
                align: "right",
                sorter: sortFunctions.byInOrders,
                render: (item: any, row: any) => {
                    if (!item) {
                        return "--";
                    }
                    return (
                        <span style={{whiteSpace: "nowrap"}}>
                            <FormattedAsset
                                amount={item}
                                asset={row.asset.get("id")}
                                hide_asset
                            />
                        </span>
                    );
                }
            },
            {
                className: "column-hide-small",
                title: <Translate content="account.inVestingBalances" />,
                dataIndex: "inVesting",
                align: "right",
                sorter: sortFunctions.byVestingBalance,
                render: (item: any, row: any) => {
                    if (!item || item.length == 0) {
                        return "--";
                    }
                    return (
                        <span style={{whiteSpace: "noWrap"}}>
                            <FormattedAsset
                                amount={sumVestingBalances(item)}
                                asset={row.asset.get("id")}
                                hide_asset
                            />
                        </span>
                    );
                }
            },
            {
                className: "column-hide-small",
                title: <Translate content="account.inCollateral" />,
                dataIndex: "inCollateral",
                align: "right",
                sorter: sortFunctions.byInCollateral,
                render: (item: any, row: any) => {
                    if (!item || item.length == 0) {
                        return "--";
                    }
                    return (
                        <span style={{whiteSpace: "noWrap"}}>
                            <FormattedAsset
                                amount={sumCollateralBalances(item)}
                                asset={row.asset.get("id")}
                                hide_asset
                            />
                        </span>
                    );
                }
            },
            {
                className: "column-hide-small",
                title: (
                    <span style={{whiteSpace: "nowrap"}}>
                        <Translate content="exchange.price" /> (
                        <AssetName name={preferredUnitHeader} noTip />)
                    </span>
                ),
                dataIndex: "price",
                align: "right",
                sorter: sortFunctions.byEquivalentPrice,
                render: (item: any, row: any) => {
                    return (
                        <span style={{whiteSpace: "nowrap"}}>
                            <EquivalentPrice
                                fromAsset={row.asset.get("id")}
                                pulsate={{reverse: true, fill: "forwards"}}
                                hide_symbols
                            />
                        </span>
                    );
                }
            },
            {
                className: "column-hide-small",
                title: <Translate content="account.hour_24_short" />,
                dataIndex: "hour24",
                align: "right",
                sorter: sortFunctions.changeValue,
                render: (item: any) => {
                    return <span style={{whiteSpace: "nowrap"}}>{item}</span>;
                }
            },
            {
                className: "column-hide-small",
                title: (
                    <span style={{whiteSpace: "nowrap"}}>
                        <TranslateWithLinks
                            noLink
                            string="account.eq_value_header"
                            keys={[
                                {
                                    type: "asset",
                                    value: preferredUnitHeader,
                                    arg: "asset"
                                }
                            ]}
                            noTip
                        />
                    </span>
                ),
                dataIndex: "value",
                align: "right",
                customizable: false,
                sorter: sortFunctions.totalValue,
                defaultSortOrder: "descend",
                render: (item: any, row: any) => {
                    return (
                        <span style={{whiteSpace: "nowrap"}}>
                            <BalanceValueComponent
                                balance={row.adds.balanceObject.get("id")}
                                satoshis={item}
                                toAsset={preferredUnitHeader}
                                hide_asset
                            />
                        </span>
                    );
                }
            },
            {
                title: <Translate content="account.percent" />,
                dataIndex: "percent",
                align: "right",
                customizable: {
                    default: showAssetPercent
                },
                render: (item: any) => {
                    return <span style={{whiteSpace: "nowrap"}}>{item}</span>;
                }
            },
            {
                title: <Translate content="header.payments" />,
                dataIndex: "payments",
                align: "center",
                render: (item: any) => {
                    return <span style={{whiteSpace: "nowrap"}}>{item}</span>;
                }
            },
            {
                className: "column-hide-medium",
                title: atLeastOneHas.depositOnlyBTS ? (
                    <React.Fragment>
                        <Tooltip
                            title={counterpart.translate(
                                "external_service_provider.expect_more"
                            )}
                        >
                            <Translate content="modal.deposit.submit" />
                            &nbsp;
                            <AntIcon type="question-circle" />
                        </Tooltip>
                    </React.Fragment>
                ) : (
                    <Translate content="modal.deposit.submit" />
                ),
                customizable: atLeastOneHas.deposit
                    ? undefined
                    : {
                          default: false
                      },
                dataIndex: "deposit",
                align: "center",
                render: (item: any) => {
                    return <span style={{whiteSpace: "nowrap"}}>{item}</span>;
                }
            },
            {
                className: "column-hide-medium",
                title: <Translate content="modal.withdraw.submit" />,
                customizable: atLeastOneHas.withdraw
                    ? undefined
                    : {
                          default: false
                      },
                dataIndex: "withdraw",
                align: "center",
                render: (item: any) => {
                    return <span style={{whiteSpace: "nowrap"}}>{item}</span>;
                }
            },
            {
                className: "column-hide-medium",
                title: <Translate content="account.trade" />,
                dataIndex: "trade",
                align: "center",
                render: (item: any) => {
                    return <span style={{whiteSpace: "nowrap"}}>{item}</span>;
                }
            },
            {
                className: "column-hide-medium",
                title: <Translate content="exchange.borrow_short" />,
                dataIndex: "borrow",
                align: "center",
                render: (item: any) => {
                    return <span style={{whiteSpace: "nowrap"}}>{item}</span>;
                }
            },
            {
                className: "column-hide-medium",
                title: <Translate content="account.settle" />,
                dataIndex: "settle",
                align: "center",
                render: (item: any) => {
                    return <span style={{whiteSpace: "nowrap"}}>{item}</span>;
                }
            },
            {
                className: "column-hide-medium",
                title: <Translate content="modal.reserve.submit" />,
                dataIndex: "burn",
                align: "center",
                render: (item: any) => {
                    return <span style={{whiteSpace: "nowrap"}}>{item}</span>;
                }
            },
            {
                className: "column-hide-medium",
                title: (
                    <Translate
                        content={
                            shownAssets == "active"
                                ? "exchange.hide"
                                : "account.perm.show"
                        }
                    />
                ),
                dataIndex: "hide",
                align: "center",
                render: (item: any) => {
                    return <span style={{whiteSpace: "nowrap"}}>{item}</span>;
                }
            }
        ];
        headerItems.forEach(item => {
            if (item.dataIndex == state.portfolioSort) {
                item.defaultSortOrder = state.portfolioSortDirection;
            }
        });
        return headerItems;
    };

    const _renderBalances = (
        balanceListArg: any,
        optionalAssetsArg: any,
        visibleArg: any
    ) => {
        const renderBorrow = (asset: any, borrowAccount: any) => {
            const isBitAsset = asset && asset.has("bitasset_data_id");
            const isGlobalSettled =
                isBitAsset && asset.getIn(["bitasset", "settlement_fund"]) > 0
                    ? true
                    : false;

            return {
                isBitAsset,
                borrowLink:
                    !isBitAsset || isGlobalSettled ? null : (
                        <a
                            onClick={() => {
                                ReactTooltip.hide();
                                showBorrowModal(
                                    asset.get("id"),
                                    asset.getIn([
                                        "bitasset",
                                        "options",
                                        "short_backing_asset"
                                    ]),
                                    borrowAccount
                                );
                            }}
                        >
                            <Icon
                                name="dollar"
                                title="icons.dollar.borrow"
                                className="icon-14px"
                            />
                        </a>
                    )
            };
        };

        const resultBalances: any[] = [];
        const emptyCell = "-";
        (balanceListArg || []).forEach((balance: any) => {
            const balanceObject = ChainStore.getObject(balance);
            if (!balanceObject) return;
            const asset_type = balanceObject.get("asset_type");
            const asset = ChainStore.getObject(asset_type);
            if (!asset) return;

            let settleLink;
            let symbol = "";

            const assetName = asset.get("symbol");
            const notCore = asset.get("id") !== "1.3.0";
            const notCorePrefUnit = preferredUnit !== coreSymbol;

            let {market} = assetUtils.parseDescription(
                asset.getIn(["options", "description"])
            );
            symbol = asset.get("symbol");
            if (symbol.indexOf("OPEN.") !== -1 && !market) market = "USD";
            let preferredMarket = market ? market : preferredUnit;

            if (notCore && preferredMarket === symbol)
                preferredMarket = coreSymbol;

            /* Table content */
            const directMarketLink = notCore ? (
                <LinkComponent
                    to={`/market/${asset.get("symbol")}_${preferredMarket}`}
                    onClick={() => MarketsActions.switchMarket()}
                >
                    <Icon
                        name="trade"
                        title="icons.trade.trade"
                        className="icon-14px"
                    />
                </LinkComponent>
            ) : notCorePrefUnit ? (
                <LinkComponent
                    to={`/market/${asset.get("symbol")}_${preferredUnit}`}
                    onClick={() => MarketsActions.switchMarket()}
                >
                    <Icon
                        name="trade"
                        title="icons.trade.trade"
                        className="icon-14px"
                    />
                </LinkComponent>
            ) : (
                emptyCell
            );
            const transferLink = (
                <a onClick={() => triggerSend(asset.get("id"))}>
                    <Icon
                        name="transfer"
                        title="icons.transfer"
                        className="icon-14px"
                    />
                </a>
            );

            const {isBitAsset, borrowLink} = renderBorrow(asset, account);

            const includeAsset = !hiddenAssets.includes(asset_type);
            const hasBalance = !!balanceObject.get("balance");

            // Vesting balances
            const vestingBalances: any[] = [];

            const vbs = account.get("vesting_balances");
            vbs.forEach((vb: any) => {
                const vestingObject = ChainStore.getObject(vb);
                if (
                    vestingObject.getIn(["balance", "asset_id"]) ===
                    asset.get("id")
                ) {
                    if (+vestingObject.getIn(["balance", "amount"]) > 0) {
                        vestingBalances.push(vestingObject);
                    }
                }
            });

            // Collateral
            const collateralBalances: any[] = [];

            (callOrders || []).forEach((order: any) => {
                const collateralObject = ChainStore.getObject(order);
                if (
                    collateralObject.getIn([
                        "call_price",
                        "base",
                        "asset_id"
                    ]) === asset.get("id")
                ) {
                    if (+collateralObject.get("collateral") > 0) {
                        collateralBalances.push(collateralObject);
                    }
                }
            });

            const backedCoin = getBackedCoin(asset.get("symbol"), backedCoins);
            const canDeposit =
                (backedCoin && backedCoin.depositAllowed) ||
                asset.get("symbol") == "BTS";

            const canWithdraw =
                backedCoin &&
                backedCoin.withdrawalAllowed &&
                hasBalance &&
                balanceObject.get("balance") != 0;

            /* Asset and Backing Asset Prefixes */
            const options =
                asset && asset.getIn(["bitasset", "options"])
                    ? asset.getIn(["bitasset", "options"]).toJS()
                    : null;
            const backingAsset =
                options && options.short_backing_asset
                    ? ChainStore.getAsset(options.short_backing_asset)
                    : null;
            const {isBitAsset: isAssetBitAsset} = utils.replaceName(asset);
            const {isBitAsset: isBackingBitAsset} = utils.replaceName(
                backingAsset
            );
            let settlePriceTitle;

            if (isBitAsset) {
                const globally_settled =
                    asset.get("bitasset").get("settlement_fund") > 0;
                const isPrediction = asset.getIn([
                    "bitasset",
                    "is_prediction_market"
                ]);
                if (globally_settled) {
                    settlePriceTitle = "tooltip.global_settle";
                } else if (isPrediction) {
                    settlePriceTitle = "tooltip.settle_market_prediction";
                } else {
                    settlePriceTitle = "tooltip.settle";
                }
                settleLink =
                    isPrediction && !globally_settled ? (
                        <AntIcon type={"question-circle"} />
                    ) : (
                        <a
                            onClick={e =>
                                _onSettleAsset(asset.get("id"), e)
                            }
                        >
                            <Icon
                                name="settle"
                                title="icons.settle"
                                className="icon-14px"
                            />
                        </a>
                    );
            }

            const preferredAsset = ChainStore.getAsset(preferredUnit);

            const marketId = asset.get("symbol") + "_" + preferredUnit;
            const currentMarketStats = allMarketStats.get(marketId);
            changeRefsRef.current[asset.get("symbol")] =
                currentMarketStats && currentMarketStats.change
                    ? currentMarketStats.change
                    : 0;
            const totalValue =
                balanceToAsset(balanceObject).amount +
                (orders[asset.get("id")] ? orders[asset.get("id")] : 0) +
                sumVestingBalances(vestingBalances);

            resultBalances.push({
                key: asset.get("symbol"),
                adds: {
                    balanceObject: balanceObject,
                    preferredAsset: preferredAsset,
                    asset: asset
                },
                asset: asset,
                balance: balanceObject,
                price: "dummy",
                inOrders: orders[asset.get("id")],
                inVesting: vestingBalances,
                inCollateral: collateralBalances,
                hour24: (
                    <Market24HourChangeComponent
                        base={asset.get("id")}
                        quote={preferredUnit}
                        marketId={marketId}
                        hide_symbols
                    />
                ),
                value: totalValue,
                percent: hasBalance ? (
                    <BalanceComponent balance={balance} asPercentage={true} />
                ) : null,
                payments: transferLink,
                deposit: _renderGatewayAction(
                    "deposit",
                    canDeposit,
                    assetName,
                    emptyCell
                ),
                withdraw: _renderGatewayAction(
                    "withdraw",
                    canWithdraw,
                    assetName,
                    emptyCell
                ),
                trade: directMarketLink,
                borrow:
                    isBitAsset && borrowLink ? (
                        <Tooltip
                            title={counterpart.translate("tooltip.borrow", {
                                asset: isAssetBitAsset ? "bit" + symbol : symbol
                            })}
                        >
                            {borrowLink}
                        </Tooltip>
                    ) : isBitAsset && !borrowLink ? (
                        <Tooltip
                            title={counterpart.translate(
                                "tooltip.borrow_disabled",
                                {
                                    asset: isAssetBitAsset
                                        ? "bit" + symbol
                                        : symbol
                                }
                            )}
                        >
                            <AntIcon type={"question-circle"} />
                        </Tooltip>
                    ) : (
                        emptyCell
                    ),
                settle:
                    isBitAsset && backingAsset ? (
                        <Tooltip
                            placement="bottom"
                            title={counterpart.translate(settlePriceTitle, {
                                asset: isAssetBitAsset
                                    ? "bit" + symbol
                                    : symbol,
                                backingAsset: isBackingBitAsset
                                    ? "bit" + backingAsset.get("symbol")
                                    : backingAsset.get("symbol"),
                                settleDelay:
                                    options.force_settlement_delay_sec / 3600
                            })}
                        >
                            <div className="inline-block">{settleLink}</div>
                        </Tooltip>
                    ) : (
                        emptyCell
                    ),
                burn: !isBitAsset ? (
                    <a
                        style={{marginRight: 0}}
                        onClick={e => _burnAsset(asset.get("id"), e)}
                    >
                        <Icon name="fire" className="icon-14px" />
                    </a>
                ) : null,
                hide: (
                    <Tooltip
                        placement="bottom"
                        title={counterpart.translate(
                            "tooltip." +
                                (includeAsset ? "hide_asset" : "show_asset")
                        )}
                    >
                        <a
                            style={{marginRight: 0}}
                            className={
                                includeAsset ? "order-cancel" : "action-plus"
                            }
                            onClick={() =>
                                _hideAsset(asset_type, includeAsset)
                            }
                        >
                            <Icon
                                name={
                                    includeAsset
                                        ? "cross-circle"
                                        : "plus-circle"
                                }
                                title={
                                    includeAsset
                                        ? "icons.cross_circle.hide_asset"
                                        : "icons.plus_circle.show_asset"
                                }
                                className="icon-14px"
                            />
                        </a>
                    </Tooltip>
                )
            });
        });
        if (optionalAssetsArg) {
            optionalAssetsArg
                .filter((asset: any) => {
                    let isAvailable = false;
                    backedCoins.get("OPEN", []).forEach((coin: any) => {
                        if (coin && coin.symbol === asset) {
                            isAvailable = true;
                        }
                    });
                    if (!!bridgeCoins.get(asset)) {
                        isAvailable = true;
                    }
                    let keep = true;
                    resultBalances.forEach(a => {
                        if (a.key === asset) keep = false;
                    });
                    return keep && isAvailable;
                })
                .forEach((a: any) => {
                    const asset = ChainStore.getAsset(a);
                    if (asset && isMyAccount) {
                        const includeAsset = !hiddenAssets.includes(
                            asset.get("id")
                        );

                        const thisAssetName = asset.get("symbol").split(".");
                        const canDeposit =
                            !!backedCoins
                                .get("OPEN", [])
                                .find(
                                    (a: any) =>
                                        a.backingCoinType === thisAssetName[1]
                                ) ||
                            !!backedCoins
                                .get("RUDEX", [])
                                .find(
                                    (a: any) =>
                                        a.backingCoin === thisAssetName[1]
                                ) ||
                            asset.get("symbol") == "BTS";

                        const notCore = asset.get("id") !== "1.3.0";
                        let {market} = assetUtils.parseDescription(
                            asset.getIn(["options", "description"])
                        );
                        if (
                            asset.get("symbol").indexOf("OPEN.") !== -1 &&
                            !market
                        )
                            market = "USD";
                        const preferredMarket = market ? market : coreSymbol;

                        const directMarketLink = notCore ? (
                            <LinkComponent
                                to={`/market/${asset.get(
                                    "symbol"
                                )}_${preferredMarket}`}
                                onClick={() => MarketsActions.switchMarket()}
                            >
                                <Icon
                                    name="trade"
                                    title="icons.trade.trade"
                                    className="icon-14px"
                                />
                            </LinkComponent>
                        ) : (
                            emptyCell
                        );
                        const {isBitAsset, borrowLink} = renderBorrow(
                            asset,
                            account
                        );
                        if (
                            (includeAsset && visibleArg) ||
                            (!includeAsset && !visibleArg)
                        )
                            resultBalances.push({
                                key: asset.get("symbol"),
                                asset: asset,
                                balance: emptyCell,
                                price: emptyCell,
                                hour24: emptyCell,
                                value: emptyCell,
                                percent: emptyCell,
                                payments: emptyCell,
                                deposit:
                                    canDeposit && isMyAccount ? (
                                        <span>
                                            <Icon
                                                style={{cursor: "pointer"}}
                                                name="deposit"
                                                title="icons.deposit.deposit"
                                                className="icon-14x"
                                                onClick={(e: any) =>
                                                    _showDepositModal(
                                                        asset.get("symbol"),
                                                        e
                                                    )
                                                }
                                            />
                                        </span>
                                    ) : (
                                        emptyCell
                                    ),
                                withdraw: emptyCell,
                                trade: directMarketLink,
                                borrow: isBitAsset ? (
                                    <Tooltip
                                        placement="bottom"
                                        title={counterpart.translate(
                                            "tooltip.borrow",
                                            {asset: asset.get("symbol")}
                                        )}
                                    >
                                        <div className="inline-block">
                                            {borrowLink}
                                        </div>
                                    </Tooltip>
                                ) : (
                                    emptyCell
                                ),
                                settle: emptyCell,
                                burn: emptyCell,
                                hide: (
                                    <Tooltip
                                        placement="bottom"
                                        title={counterpart.translate(
                                            "tooltip." +
                                                (includeAsset
                                                    ? "hide_asset"
                                                    : "show_asset")
                                        )}
                                    >
                                        <a
                                            style={{marginRight: 0}}
                                            className={
                                                includeAsset
                                                    ? "order-cancel"
                                                    : "action-plus"
                                            }
                                            onClick={() =>
                                                _hideAsset(
                                                    asset.get("id"),
                                                    includeAsset
                                                )
                                            }
                                        >
                                            <Icon
                                                name={
                                                    includeAsset
                                                        ? "cross-circle"
                                                        : "plus-circle"
                                                }
                                                title={
                                                    includeAsset
                                                        ? "icons.cross_circle.hide_asset"
                                                        : "icons.plus_circle.show_asset"
                                                }
                                                className="icon-14px"
                                            />
                                        </a>
                                    </Tooltip>
                                )
                            });
                    }
                });
        }
        return resultBalances;
    };

    const _renderSendModal = () => {
        return (
            <SendModal
                id="send_modal_portfolio"
                refCallback={(e: any) => {
                    if (e) sendModalRef.current = e;
                }}
                from_name={account.get("name")}
                asset_id={state.send_asset || "1.3.0"}
            />
        );
    };

    const _renderBorrowModal = () => {
        if (
            !state.borrow ||
            !state.borrow.quoteAsset ||
            !state.borrow.backingAsset ||
            !state.borrow.account ||
            !state.isBorrowModalVisibleBefore
        ) {
            return null;
        }

        return (
            <BorrowModal
                visible={state.isBorrowModalVisible}
                showModal={showBorrowModal}
                hideModal={hideBorrowModal}
                accountObj={state.borrow && state.borrow.account}
                quoteAssetObj={state.borrow && state.borrow.quoteAsset}
                backingAssetObj={state.borrow && state.borrow.backingAsset}
            />
        );
    };

    const _renderSettleModal = () => {
        return (
            <SettleModal
                visible={state.isSettleModalVisible}
                hideModal={hideSettleModal}
                showModal={showSettleModal}
                asset={state.settleAsset}
                account={account}
            />
        );
    };

    const balanceRows = _renderBalances(balanceList, optionalAssets, visible);
    const atLeastOneHas: any = {};
    balanceRows.forEach(_item => {
        if (!!_item.deposit && _item.deposit !== "-") {
            if (_item.key == "BTS" && GatewayStore.anyAllowed()) {
                atLeastOneHas.depositOnlyBTS =
                    _item.key == "BTS" && !atLeastOneHas.deposit;
                atLeastOneHas.deposit = true;
            }
        }
        if (!!_item.withdraw && _item.withdraw !== "-") {
            atLeastOneHas.withdraw = true;
        }
    });

    return (
        <div>
            <CustomTable
                className="table dashboard-table table-hover"
                rows={balanceRows}
                header={getHeader(atLeastOneHas)}
                label="utility.total_x_assets"
                extraRow={extraRow}
                viewSettingsKey="portfolioColumns"
                allowCustomization={true}
                toggleSortOrder={toggleSortOrder}
            >
                {_renderSendModal()}
                {(state.isSettleModalVisible ||
                    state.isSettleModalVisibleBefore) &&
                    _renderSettleModal()}
                {_renderBorrowModal()}

                {(state.isWithdrawModalVisible ||
                    state.isWithdrawModalVisibleBefore) && (
                    <WithdrawModal
                        hideModal={hideWithdrawModal}
                        visible={state.isWithdrawModalVisible}
                        backedCoins={backedCoins}
                        initialSymbol={state.withdrawAsset}
                    />
                )}

                {/* Deposit Modal */}
                {(state.isDepositModalVisible ||
                    state.isDepositModalVisibleBefore) && (
                    <DepositModal
                        visible={state.isDepositModalVisible}
                        showModal={showDepositModal}
                        hideModal={hideDepositModal}
                        asset={state.depositAsset}
                        account={account.get("name")}
                        backedCoins={backedCoins}
                    />
                )}

                {/* Burn Modal */}
                {(state.isBurnModalVisible ||
                    state.isBurnModalVisibleBefore) && (
                    <ReserveAssetModal
                        visible={state.isBurnModalVisible}
                        hideModal={hideBurnModal}
                        asset={state.reserve}
                        account={account}
                        onClose={() => {
                            ZfApi.publish("reserve_asset", "close");
                        }}
                    />
                )}
            </CustomTable>
        </div>
    );
}

const AccountPortfolioListDebounced: any = debounceRender(
    AccountPortfolioListCore,
    50,
    {leading: false}
);

export default function AccountPortfolioList(props: any) {
    const settingsState = useAltStore<any>(SettingsStore as any);
    const gatewayState = useAltStore<any>(GatewayStore as any);
    const marketsState = useAltStore<any>(MarketsStore as any);

    return (
        <AccountPortfolioListDebounced
            {...props}
            settings={settingsState.settings}
            viewSettings={settingsState.viewSettings}
            backedCoins={gatewayState.backedCoins}
            bridgeCoins={gatewayState.bridgeCoins}
            allMarketStats={marketsState.allMarketStats}
        />
    );
}
