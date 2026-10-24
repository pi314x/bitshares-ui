// TypeScript/function-component port of the legacy Notifier.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md) together with its `BindToChainState(Notifier)`
// wrapping. Mechanical translation, no logic changes except where noted.
// Not security-sensitive per AGENTS.md (grepped for `WalletDb`/`WalletApi`/
// `Actions\.`/`ApplicationApi\.` - none appear; this only reads chain
// history to pop a Foundation UI notification toast).
//
// Public interface unchanged: the default export still takes a single
// `account` prop that is the RAW account identifier (a name string, or
// `null`/`undefined`), exactly as before - `BindToChainState` used to
// resolve this internally into the live chain `Account` Immutable `Map`
// before handing it to the inner `Notifier` class. This port keeps that
// same two-layer shape as a default-exported `Notifier` container
// (resolution) wrapping `NotifierCore` (presentation), following the
// established Container pattern from `WithdrawModalNew.tsx`'s
// `WithdrawModalAccountContainer`.
//
// - `BindToChainState(Notifier)` (no options argument) -> `useChainStoreTick()`
//   + a direct `ChainStore.getAccount(account)` call in the default-exported
//   container. `account` is declared `ChainTypes.ChainAccount.isRequired`
//   in the original, and `BindToChainState`'s fallback for an unresolved
//   *required* prop with no `show_loader` option is a bare `<span />` -
//   replicated exactly, but only while the raw identifier is truthy yet
//   still unresolved: `BindToChainState`'s required-prop check tests
//   strictly for `undefined` (not falsy), so a falsy/absent raw `account`
//   resolves to `null` instead, which does NOT hit that fallback -
//   it flows through to `NotifierCore`, whose own `if (!account) return
//   <div />;` handles it identically to the original.
// - Dropped, grep-confirmed dead for this specific prop: `BindToChainState`'s
//   generic chain-account resolution also special-cases a `"#123"`-style
//   shorthand id and an `Immutable.Map` holding only a `name` key. Neither
//   ever reaches this component in practice - `Notifier`'s only importer
//   anywhere in the app is `NotifierContainer.jsx` (now `.tsx`), which
//   always passes a plain account-name string (or `null`) straight from
//   `AccountStore`'s `currentAccount` field (see `AccountStore.js`'s
//   `setCurrentAccount(name)`, always a string or `null`), and
//   `NotifierContainer` itself has exactly one caller anywhere in the app
//   (`Exchange.tsx` renders `<AccountNotifications />` - i.e.
//   `NotifierContainer` - with no props at all). Simplified to a direct
//   `ChainStore.getAccount(account)` call, matching
//   `WithdrawModalAccountContainer`'s identical simplification for the
//   same reason.
// - `shouldComponentUpdate(nextProps)` (true only when `account` or its
//   `history` sub-list actually changed, by `Immutable.is`) is a pure
//   render-gate with no `componentDidUpdate` in this file to replicate -
//   dropped entirely per this migration's established treatment of pure
//   perf guards. Its only purpose was `immutable`'s `Immutable.is`, so
//   that otherwise-unused import is dropped with it.
// - `UNSAFE_componentWillReceiveProps(nextProps)` (fires an
//   "account-notify" Foundation notification open/close pulse when the
//   account's most recent history entry is a brand-new `fill_order`) only
//   ever fires on prop *updates*, never on mount - replicated with a
//   mount-skip `useEffect` keyed on `account`, using a ref to keep the
//   previously-seen `account` value available for the comparison (the
//   original compared `nextProps.account`, the incoming value, against
//   `this.props.account`, the not-yet-updated previous value).
import * as React from "react";
import FoundationNotification from "./FoundationNotification";
import ZfApi from "common/zfApi";
import {ChainStore, ChainTypes as GraphChainTypes} from "bitsharesjs";
import Operation from "../Blockchain/Operation";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const {operations} = GraphChainTypes;
const ops = Object.keys(operations);

export interface NotifierProps {
    account?: any;
}

function NotifierCore(props: {account?: any}) {
    const {account} = props;

    const isMountRef = React.useRef(false);
    const prevAccountRef = React.useRef<any>(undefined);

    React.useEffect(() => {
        if (!isMountRef.current) {
            isMountRef.current = true;
            prevAccountRef.current = account;
            return;
        }
        const prevAccount = prevAccountRef.current;
        const nextAccount = account;
        prevAccountRef.current = account;

        if (
            nextAccount &&
            nextAccount.size &&
            prevAccount &&
            prevAccount.get("history")
        ) {
            const ch =
                prevAccount.get("history") && prevAccount.get("history").first()
                    ? prevAccount
                          .get("history")
                          .first()
                          .toJS()
                    : null;
            const nh =
                nextAccount.get("history") && nextAccount.get("history").first()
                    ? nextAccount
                          .get("history")
                          .first()
                          .toJS()
                    : null;
            if (nh && ch) {
                // Only trigger notifications for order fills
                if (
                    ops[nh.op[0]] === "fill_order" &&
                    ((!ch && nh.id) || nh.id !== ch.id)
                ) {
                    ZfApi.publish("account-notify", "open");
                    setTimeout(function() {
                        ZfApi.publish("account-notify", "close");
                    }, 5000);
                }
            }
        }
    }, [account]);

    if (!account) {
        return <div />;
    }

    let trx: any, info: any;

    if (account.get("history") && account.get("history").size) {
        trx = account
            .get("history")
            .first()
            .toJS();
        if (trx) {
            info = (
                <Operation
                    key={trx.id}
                    op={trx.op}
                    result={trx.result}
                    block={trx.block_num}
                    current={account.get("id")}
                    hideDate={true}
                    hideFee={true}
                />
            );
        }
    }

    if (!trx) {
        return <div />;
    }

    return (
        <FoundationNotification
            id="account-notify"
            title={null}
            image=""
            wrapperElement="div"
        >
            <table className="table">
                <tbody>{info}</tbody>
            </table>
        </FoundationNotification>
    );
}

export default function Notifier(props: NotifierProps) {
    useChainStoreTick();
    const account = props.account
        ? (ChainStore as any).getAccount(props.account)
        : null;

    // Matches BindToChainState's fallback for an unresolved *required*
    // prop when `options.show_loader` isn't set: render an inert
    // placeholder until it resolves - see header comment for why a
    // falsy/absent raw `account` resolves to `null` instead, which does
    // NOT hit this fallback.
    if (account === undefined) {
        return <span />;
    }

    return <NotifierCore account={account} />;
}
