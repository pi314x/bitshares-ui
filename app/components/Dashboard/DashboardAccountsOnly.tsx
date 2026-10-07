// TypeScript/functional-component port of the legacy
// DashboardAccountsOnly.jsx (Dashboard/ batch 1, docs/UI_MIGRATION_PLAN.md).
// Renders the "/accounts" route (App.jsx, grep-confirmed sole real caller)
// - the Accounts/Contacts/Recent tab group shown when the Dashboard is
// restricted to just the accounts list.
//
// Structural changes:
// - The original's outer `AccountsContainer` class wrapping `<AltContainer
//   stores={[AccountStore, SettingsStore, MarketsStore]} inject={{...}}>`
//   is replaced by a small function component calling `useAltStore` once
//   per store, this migration's established multi-store pattern (see
//   `Account/AccountPortfolioList.tsx`'s header comment for the general
//   precedent). Per `alt-container`'s own `cloneElement` merge order
//   (`node_modules/alt-container/src/mixinContainer.js`: `assign({},
//   element.props, injectedProps, ...)`), the injected/store-derived props
//   always won over whatever was already on `<Accounts {...this.props}/>`
//   - reproduced here by spreading the container's own received `props`
//   first and the store-derived props after.
// - `SettingsStore` and `MarketsStore` were listed in the original's
//   `stores` array (forcing a re-render on every change to either) but
//   neither was used as an `inject` key except `SettingsStore`, whose
//   single injected value (`currentEntry`, see below) turned out to be
//   fully dead. Both stores are still subscribed here via bare
//   `useAltStore(...)` calls purely to preserve that re-render-on-change
//   behavior, matching `DashboardList.tsx`'s identical treatment of
//   `WalletUnlockStore` (subscribed only to force a re-render, its value
//   never read).
// - Dead code dropped (grep-confirmed no other reference in this file or
//   anywhere else in `app/`):
//   - `currentEntry`: injected from `SettingsStore.getState().viewSettings
//     .get("dashboardEntry", "accounts")`, seeded into `Accounts`'
//     constructor `state.currentEntry`, compared in the (also dropped,
//     see below) `shouldComponentUpdate`, but never read in `render()` and
//     never displayed.
//   - `_onSwitchType(type)`: the only writer of `state.currentEntry`
//     (besides the constructor) and the only caller of
//     `SettingsActions.changeViewSetting({dashboardEntry: type})` in this
//     file - never invoked from anywhere in `render()` (no `Tabs`/`Tab`
//     prop hooks up to it) or from any other file.
//   - `onlyAccounts`: the boolean the bottom-level `DashboardAccountsOnly`
//     wrapper passed down (`<AccountsContainer {...props} onlyAccounts
//     />`) - never destructured or read anywhere in `AccountsContainer`
//     or `Accounts`.
// - `shouldComponentUpdate` was a pure re-render guard (no
//   `componentDidUpdate` it needed to gate - none exists in this file), so
//   it is not replicated, per this migration's established treatment of
//   pure perf guards.
// - `componentDidMount`'s resize-listener registration (`_setDimensions`,
//   bound once in the constructor, called both directly on mount and on
//   every `resize` event, only calling `setState` when the width actually
//   changed) becomes a mount-only `useEffect` registering the same
//   listener with the same `{capture: false, passive: true}` options,
//   using a functional `setWidth` update to replicate the "only update if
//   changed" bail-out from inside the handler itself (matching the current
//   value via the functional-updater form rather than a stale closure).
// - `withRouter`/class state is otherwise a mechanical 1:1 translation:
//   `_onToggleIgnored` -> a plain `setShowIgnored` toggle,
//   `state.showIgnored`/`state.width` -> separate `useState` hooks (no
//   single combined `mergeState` needed, since each original setter only
//   ever touched one field at a time).
//
// Preserved verbatim (not "fixed"), two genuine pre-existing quirks that
// required a narrow TypeScript cast to keep compiling without changing
// runtime behavior:
// - The "Contacts" tab's `<DashboardList accounts={...}>` call passes
//   `this.props.contacts.toArray()` - a *plain* JS array of account name
//   strings (`AccountStore`'s `accountContacts` is an `Immutable.Set`,
//   whose `.toArray()` returns a native `Array`), not an `Immutable.List`.
//   `DashboardList.tsx` (already ported, out of this batch's scope)
//   declares `accounts: List<string>` and internally does
//   `ids.map(...).toArray()` - which throws at runtime for a plain array
//   (`Array.prototype.map` doesn't return something with `.toArray()`).
//   This is a pre-existing runtime bug in the already-ported
//   `DashboardList.tsx`'s `resolveAccounts`, not something introduced by
//   this file's port (the legacy `DashboardList.jsx` tolerated a plain
//   array fine, since it was wrapped in `BindToChainState`, whose generic
//   `chain_accounts_list` resolution only ever calls `.forEach()`, which
//   both `Array` and `Immutable.List` support). Fixing `DashboardList.tsx`
//   is out of this batch's scope, so the call site here is left exactly as
//   broken as before - the plain array is passed through unchanged, only
//   cast (`as unknown as List<string>`) to satisfy `tsc`, which now
//   type-checks both sides of this call for the first time.
// - `state.width` starts as `null` (not `undefined`), and is passed
//   straight through to `DashboardList`'s `width?: number` prop exactly as
//   before - `null` does NOT trigger that prop's own `= 2000` default
//   (JS default parameters only substitute for `undefined`), so the
//   original briefly rendered `DashboardList`'s narrower (sub-750px)
//   column layout on first paint until the mount effect resolved the real
//   `window.innerWidth`. Reproduced verbatim via a narrow `as any` cast at
//   the two call sites (rather than switching the initial state to
//   `undefined`, which would silently change that first-paint layout).
//
// Not security-sensitive per AGENTS.md: this file only renders account
// lists/tabs and reads `AccountStore`/`SettingsStore`/`MarketsStore`
// state - no wallet unlock, key import/export, or transaction
// signing/serialization anywhere in it.
import * as React from "react";
import Immutable, {List} from "immutable";
import DashboardList from "./DashboardList";
import {RecentTransactions} from "../Account/RecentTransactions";
import LoadingIndicator from "../LoadingIndicator";
import LoginSelector from "../LoginSelector";
import SettingsStore from "stores/SettingsStore";
import AccountStore from "stores/AccountStore";
import MarketsStore from "stores/MarketsStore";
import {Tabs, Tab} from "../Utility/Tabs";
import {useAltStore} from "../../next/hooks/useAltStore";

interface AccountsProps {
    myActiveAccounts: Immutable.Set<string>;
    myHiddenAccounts: Immutable.Set<string>;
    accountsReady: boolean;
    passwordAccount?: string;
    contacts: Immutable.Set<string>;
    [key: string]: any;
}

function Accounts(props: AccountsProps) {
    const {
        myActiveAccounts: myActiveAccountsProp,
        myHiddenAccounts,
        accountsReady,
        passwordAccount,
        contacts
    } = props;

    const [width, setWidth] = React.useState<number | null>(null);
    const [showIgnored, setShowIgnored] = React.useState(false);

    React.useEffect(() => {
        function setDimensions() {
            const newWidth = window.innerWidth;
            setWidth(prevWidth =>
                newWidth !== prevWidth ? newWidth : prevWidth
            );
        }

        setDimensions();
        window.addEventListener("resize", setDimensions, {
            capture: false,
            passive: true
        });

        return () => window.removeEventListener("resize", setDimensions);
    }, []);

    function onToggleIgnored() {
        setShowIgnored(prev => !prev);
    }

    let myActiveAccounts = myActiveAccountsProp;
    if (passwordAccount && !myActiveAccounts.has(passwordAccount)) {
        myActiveAccounts = myActiveAccounts.add(passwordAccount);
    }
    const names = myActiveAccounts.toArray().sort();
    if (passwordAccount && names.indexOf(passwordAccount) === -1)
        names.push(passwordAccount);
    const ignored = myHiddenAccounts.toArray().sort();

    const accountCount =
        myActiveAccounts.size +
        myHiddenAccounts.size +
        (passwordAccount ? 1 : 0);

    if (!accountsReady) {
        return <LoadingIndicator />;
    }

    if (!accountCount) {
        return <LoginSelector />;
    }

    const contactsArray = contacts.toArray();

    return (
        <div className="grid-block page-layout vertical">
            <div className="tabs-container generic-bordered-box dash-panel">
                <Tabs
                    setting="accountTab"
                    className="account-tabs"
                    defaultActiveTab={1}
                    segmented={false}
                    tabsClass="account-overview no-padding bordered-header content-block"
                >
                    <Tab title="account.accounts">
                        <div className="generic-bordered-box">
                            <div className="box-content">
                                <DashboardList
                                    accounts={Immutable.List(names)}
                                    ignoredAccounts={Immutable.List(ignored)}
                                    width={width as any}
                                    onToggleIgnored={onToggleIgnored}
                                    showIgnored={showIgnored}
                                    showMyAccounts={true}
                                />
                            </div>
                        </div>
                    </Tab>
                    <Tab title="account.contacts">
                        <div className="generic-bordered-box">
                            <div className="box-content">
                                <DashboardList
                                    accounts={
                                        (contactsArray as unknown) as List<
                                            string
                                        >
                                    }
                                    passwordAccount={passwordAccount}
                                    ignoredAccounts={Immutable.List(ignored)}
                                    width={width as any}
                                    onToggleIgnored={onToggleIgnored}
                                    showIgnored={showIgnored}
                                    isContactsList={true}
                                />
                            </div>
                        </div>
                    </Tab>
                    <Tab title="account.recent">
                        <RecentTransactions
                            accountsList={myActiveAccounts}
                            limit={10}
                            compactView={false}
                            fullHeight={true}
                            showFilters={true}
                            dashboard
                        />
                    </Tab>
                </Tabs>
            </div>
        </div>
    );
}

function AccountsContainer(props: Record<string, any>) {
    const accountState = useAltStore<any>(AccountStore);
    // Re-render trigger only, matching this file's original `stores`
    // list - neither store's state is read here (see header comment).
    useAltStore<any>(SettingsStore);
    useAltStore<any>(MarketsStore);

    const contacts = accountState.accountContacts;
    const myActiveAccounts = accountState.myActiveAccounts;
    const myHiddenAccounts = accountState.myHiddenAccounts;
    const accountsReady =
        accountState.accountsLoaded && accountState.refsLoaded;
    const passwordAccount = accountState.passwordAccount;

    return (
        <Accounts
            {...props}
            contacts={contacts}
            myActiveAccounts={myActiveAccounts}
            myHiddenAccounts={myHiddenAccounts}
            accountsReady={accountsReady}
            passwordAccount={passwordAccount}
        />
    );
}

const DashboardAccountsOnly = (props: Record<string, any>) => {
    return <AccountsContainer {...props} />;
};

export default DashboardAccountsOnly;
