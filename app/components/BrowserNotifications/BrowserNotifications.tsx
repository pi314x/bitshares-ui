// TypeScript/functional-component port of the legacy
// BrowserNotifications.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical
// class-to-hooks translation, no logic changes.
//
// Not security-sensitive per AGENTS.md: grepped this file for `WalletDb`,
// `WalletApi`, `Actions\.`, `ApplicationApi\.` - none appear. This is a
// pure browser-`Notification`-API wrapper (via the `notifyjs` package)
// that reads account history/settings to decide whether to pop a desktop
// notification for an incoming transfer; it never touches wallet state,
// keys or signing.
//
// Original had two layers, both ported into this one file (it already
// exported the `BindToChainState`-wrapped version as its default, so that
// wrapping belongs here, not in the Container):
// 1. `BindToChainState(BrowserNotifications)`, wrapping the component for
//    its single `propTypes` field of chain-resolution interest:
//    `account: ChainTypes.ChainAccount.isRequired`. The actual prop the
//    caller passes in (`BrowserNotificationsContainer`, via
//    `AccountStore.getState().currentAccount`) is a plain account-name
//    string (verified by reading `AccountStore.js`'s
//    `setCurrentAccount`/`tryToSetCurrentAccount` - always a name string
//    or `null`, never a pre-resolved object/id-map) - so, unlike
//    `BindToChainState.jsx`'s generic multi-shape handling for a
//    `ChainAccount` prop (short `"#123"` ids, a `{name}`-only Immutable
//    Map), only the plain-string path this call site actually exercises
//    is reproduced, matching the already-established simplified pattern
//    in `WithdrawModalNew.tsx`'s `WithdrawModalAccountContainer`
//    (`useChainStoreTick()` + a direct `ChainStore.getAccount(...)` call,
//    no `BindToChainState.jsx` re-implementation). Also reproduced:
//    `BindToChainState`'s fallback for an unresolved *required* prop when
//    `options.show_loader` wasn't passed to the wrapper call (it wasn't,
//    here) - render a bare `<span />` instead of running the component's
//    own logic/render.
// 2. The inner component class itself, whose own `render()` always
//    returns `null` - all of its real behavior lives in
//    `UNSAFE_componentWillReceiveProps`, comparing the previous vs. next
//    `account.get("history")` to detect a newly-arrived transfer and, if
//    so, popping a browser notification.
//
// `UNSAFE_componentWillReceiveProps` -> `useEffect` translation:
// - It never fires on the initial mount (only on updates) - translated
//   via the standard `isMountRef` mount-skip guard used elsewhere in this
//   migration, rather than a plain `useEffect`.
// - It fires whenever React re-renders this component with new props -
//   which, since neither `BindToChainState`'s inner `Component` nor this
//   component define `shouldComponentUpdate`, happens whenever
//   `BindToChainState`'s own `Wrapper.shouldComponentUpdate` passes (a
//   shallow-equal check across all props, which include the resolved
//   `account` object and the passed-through `settings` prop). Translated
//   as a `useEffect` with `[account, settings]` as its dependency array -
//   firing on either reference changing mirrors "either chain state or
//   the passed-through settings prop changed," the same trigger set.
// - Reads `this.props.account` (the *old* value, since React hasn't yet
//   committed `nextProps` to `this.props` while this lifecycle method is
//   running) via a `prevAccountRef`, updated to the new `account` right
//   after being read each run - mirroring how `this.props.account`
//   automatically becomes `nextProps.account` once React commits.
// - Worth noting, not a behavior change: `_isTransferToMyAccount`
//   originally compares the transfer's `to` field against
//   `this.props.account.get("id")` - i.e. the *old* account, not
//   `nextProps.account` - even though it's only ever called from within
//   the `nextProps`-vs-`this.props` diff. Since both are different
//   immutable snapshots of the *same* underlying account (only its
//   `history`/other fields changed, never its `id`), `prevAccount.get(
//   "id")` and `account.get("id")` are always equal in practice - so this
//   is preserved exactly (`prevAccount.get("id")`) but is a no-op
//   distinction either way.
// - `UNSAFE_componentWillMount`'s one-time `Notify.requestPermission()`
//   call becomes a separate mount-only `useEffect(() => {...}, [])`,
//   independent of the per-update effect above (translated 1:1, not
//   merged, since it runs under a different trigger - only on mount).
//
// All the original's plain helper methods (`_getOperationName`,
// `_isOperationTransfer`, `_isTransferToMyAccount`,
// `_notifyUserAboutTransferToHisAccount`, `notifyUsingBrowserNotification`,
// `_getRealAmountByAssetId`, `_getAssetSymbolByAssetId`,
// `_getAccountNameById`) never read `this.state`, so they're ported as
// plain module-level functions (parameterized instead of closing over
// `this`), not re-created per render.
//
// `console.log` calls (`"browser notifications disabled by settings"` /
// `"... by Browser Permissions"`): kept verbatim - neither logs any
// password/key/account-identifying secret, just a fixed string.
import * as React from "react";
import {ChainTypes as GraphChainTypes, ChainStore} from "bitsharesjs";
import counterpart from "counterpart";
import utils from "common/utils";
import Notify from "notifyjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const {operations} = GraphChainTypes as any;
const OPERATIONS = Object.keys(operations);

function _getOperationName(operation: any): string | null {
    if (operation.getIn(["op", 0]) !== undefined)
        return OPERATIONS[operation.getIn(["op", 0])];
    return null;
}

function _isOperationTransfer(operation: any): boolean {
    return _getOperationName(operation) === "transfer";
}

function _isTransferToMyAccount(operation: any, account: any): boolean {
    if (!_isOperationTransfer(operation))
        throw Error("Operation is not transfer");

    return operation.getIn(["op", 1, "to"]) === account.get("id");
}

function _getRealAmountByAssetId(amount: any, assetId: any): any {
    const asset = ChainStore.getAsset(assetId);
    if (!asset) return null;
    return utils.get_asset_amount(amount, asset);
}

function _getAssetSymbolByAssetId(assetId: any): any {
    const asset = ChainStore.getAsset(assetId);
    if (!asset) return null;
    return asset.get("symbol");
}

function _getAccountNameById(accountId: any): any {
    const account = ChainStore.getAccount(accountId);
    if (!account) return "";
    return account.get("name");
}

function notifyUsingBrowserNotification(params: any = {}) {
    /*
     * params.title (string) - title of notification
     * params.body (string) - body of notification
     * params.showTimeout (number) - number of seconds to show the notification
     * params.closeOnClick (boolean) - close the notification when clicked. Useful in chrome where the notification remains open until the timeout or the x is clicked.
     * params.onNotifyShow (function) - callback when notification is shown
     * params.onNotifyClose (function) - callback when notification is closed
     * params.onNotifyClick (function) - callback when notification is clicked
     * params.onNotifyError (function) - callback when notification throws an error
     * */

    if (!params.title && !params.body) return null;

    const notifyParams: any = {
        body: params.body
    };

    if (typeof params.onNotifyShow === "function")
        notifyParams.notifyShow = params.onNotifyShow;

    if (typeof params.onNotifyClose === "function")
        notifyParams.notifyClose = params.onNotifyShow;

    if (typeof params.onNotifyClick === "function")
        notifyParams.notifyClick = params.onNotifyShow;

    if (typeof params.onNotifyError === "function")
        notifyParams.notifyError = params.onNotifyShow;

    const notify = new (Notify as any)(params.title, notifyParams);

    notify.show();
}

function _notifyUserAboutTransferToHisAccount(operation: any) {
    const assetId = operation.getIn(["op", 1, "amount", "asset_id"]);
    const from = operation.getIn(["op", 1, "from"]);

    const amount = operation.getIn(["op", 1, "amount", "amount"]);

    if (!assetId || !from || !amount)
        throw Error("Operation has wrong format");

    const title = counterpart.translate(
        "browser_notification_messages.money_received_title",
        {
            from: _getAccountNameById(from)
        }
    );

    const realAmount = _getRealAmountByAssetId(amount, assetId);
    const symbol = _getAssetSymbolByAssetId(assetId);
    if (realAmount === null || symbol === null) return;

    const body = counterpart.translate(
        "browser_notification_messages.money_received_body",
        {
            amount: realAmount,
            symbol
        }
    );

    notifyUsingBrowserNotification({
        title: title,
        body: body,
        closeOnClick: true
    });
}

interface BrowserNotificationsProps {
    // Raw account-name string/`null`, as passed by
    // `BrowserNotificationsContainer` (`AccountStore`'s `currentAccount`) -
    // resolved below via `ChainStore.getAccount`, mirroring the original's
    // `BindToChainState(BrowserNotifications)` wrapping.
    account: any;
    settings?: any;
}

// Split into an outer resolver + an inner component (rather than one
// function with an early return after its hooks) to reproduce
// `BindToChainState`'s actual mount semantics: the wrapped component only
// *exists* once its required `account` prop resolves - before that, the
// fallback `<span />` is rendered in its place and the inner component's
// lifecycle (here: its effects) has not started yet. If `account` first
// resolves later (or goes back to unresolved and resolves again), that is
// a fresh mount of the inner component each time - notably, requesting
// browser-notification permission (the old `UNSAFE_componentWillMount`)
// only happens once a real account is available, and the mount-skip guard
// on the diffing effect restarts for that fresh instance.
export default function BrowserNotifications({
    account: rawAccount,
    settings
}: BrowserNotificationsProps) {
    useChainStoreTick();
    const account = rawAccount ? ChainStore.getAccount(rawAccount) : undefined;

    // `BindToChainState`'s fallback for an unresolved *required* prop when
    // `options.show_loader` wasn't set (it wasn't, for this wrapping) is a
    // bare `<span />`, rendered in place of the component's own logic.
    if (!account) return <span />;

    return <BrowserNotificationsInner account={account} settings={settings} />;
}

interface BrowserNotificationsInnerProps {
    account: any;
    settings: any;
}

function BrowserNotificationsInner({
    account,
    settings
}: BrowserNotificationsInnerProps) {
    const isMountRef = React.useRef(false);
    const prevAccountRef = React.useRef(account);

    React.useEffect(() => {
        if ((Notify as any).needsPermission) {
            (Notify as any).requestPermission();
        }
    }, []);

    React.useEffect(() => {
        if (!isMountRef.current) {
            isMountRef.current = true;
            prevAccountRef.current = account;
            return;
        }

        const prevAccount = prevAccountRef.current;
        prevAccountRef.current = account;

        // if browser notifications disabled on settings we can skip all checks
        if (!settings.get("browser_notifications").allow) {
            console.log("browser notifications disabled by settings");
            return;
        }

        // if app not permitted to send notifications skip all checks
        if ((Notify as any).needsPermission) {
            console.log(
                "browser notifications disabled by Browser Permissions"
            );
            return;
        }

        if (
            account &&
            prevAccount &&
            account.size &&
            prevAccount.get("history") &&
            account.get("history")
        ) {
            const lastOperationOld = prevAccount.get("history").first();
            const lastOperationNew = account.get("history").first();
            if (!lastOperationNew || !lastOperationOld) return;

            // if operations not updated do not notify user
            if (lastOperationNew.get("id") === lastOperationOld.get("id")) {
                return;
            }

            if (
                _isOperationTransfer(lastOperationNew) &&
                _isTransferToMyAccount(lastOperationNew, prevAccount) &&
                settings.get("browser_notifications").additional.transferToMe
            ) {
                _notifyUserAboutTransferToHisAccount(lastOperationNew);
            }
        }
    }, [account, settings]);

    return null;
}
