// TypeScript/functional-component port of the legacy AccountPage.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(AccountPage, {show_loader: true})` (a required
// `account` prop, with the `show_loader` option - which, unlike every
// other `BindToChainState` usage ported so far, shows a `LoadingIndicator`
// fallback instead of a blank `<span/>` while unresolved) is replaced by
// a Container gating on the resolved `account`, replicating
// `BindToChainState.jsx`'s exact `show_loader` fallback markup. The
// outer `connect(Component, {listenTo: [...], getProps})` (three stores)
// is replaced by three `useAltStore()` calls.
//
// `componentDidMount` + `UNSAFE_componentWillReceiveProps` (both call
// `AccountActions.setCurrentAccount`/`accountUtils.getPossibleFees` -
// mount does so unconditionally when `account` is present, update only
// when the account *name* changed) are unified into one `useEffect`
// keyed on the resolved `account`, using a mount-only ref to skip the
// name-comparison on the very first run (mount's condition doesn't need
// one, since there's no previous account to compare against).
//
// `componentDidUpdate` (redirects the URL when the *separately tracked*
// `currentAccount` prop, from the outer store, changes) is a genuinely
// distinct concern from the effect above (different trigger prop
// entirely) and gets its own `useEffect` keyed on `currentAccount`,
// skipped on mount the same way.
import * as React from "react";
import AccountActions from "actions/AccountActions";
import AccountStore from "stores/AccountStore";
import SettingsStore from "stores/SettingsStore";
import WalletUnlockStore from "stores/WalletUnlockStore";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import accountUtils from "common/account_utils";
import {List} from "immutable";
import Page404 from "../Page404/Page404";
import {Route, Switch, Redirect} from "react-router-dom";
import LoadingIndicator from "../LoadingIndicator";
import {useAltStore} from "../../next/hooks/useAltStore";

/* Nested routes */
import AccountAssets from "./AccountAssets";
import AccountPools from "./AccountPools";
import {AccountAssetCreate} from "./AccountAssetCreate";
import AccountAssetUpdate from "./AccountAssetUpdate";
import AccountMembership from "./AccountMembership";
import AccountVesting from "./AccountVesting";
import AccountPermissions from "./AccountPermissions";
import AccountSignedMessages from "./AccountSignedMessages";
import AccountWhitelist from "./AccountWhitelist";
import AccountVoting from "./AccountVoting";
import AccountOverview from "./AccountOverview";

interface AccountPageCoreProps {
    account: any;
    currentAccount?: string;
    myActiveAccounts?: any;
    searchAccounts?: any;
    settings?: any;
    wallet_locked?: boolean;
    hiddenAssets?: any;
    viewSettings?: any;
    history: any;
    location: any;
}

function AccountPage({
    account,
    currentAccount,
    myActiveAccounts,
    searchAccounts,
    settings,
    wallet_locked,
    hiddenAssets,
    viewSettings,
    history,
    location
}: AccountPageCoreProps) {
    const isMountRef = React.useRef(true);
    const prevAccountNameRef = React.useRef<string | undefined>(undefined);

    React.useEffect(() => {
        if (!account) return;
        const npName = account.get("name");
        if (isMountRef.current) {
            isMountRef.current = false;
            AccountActions.setCurrentAccount.defer(npName);
            // Fetch possible fee assets here to avoid async issues later (will resolve assets)
            accountUtils.getPossibleFees(account, "transfer");
            prevAccountNameRef.current = npName;
            return;
        }
        if (npName !== prevAccountNameRef.current) {
            // Update the current account in order to access the header right menu options
            AccountActions.setCurrentAccount.defer(npName);
            // Fetch possible fee assets here to avoid async issues later (will resolve assets)
            accountUtils.getPossibleFees(account, "transfer");
        }
        prevAccountNameRef.current = npName;
    }, [account]);

    const isMountRef2 = React.useRef(true);
    const prevCurrentAccountRef = React.useRef(currentAccount);

    React.useEffect(() => {
        if (isMountRef2.current) {
            isMountRef2.current = false;
            prevCurrentAccountRef.current = currentAccount;
            return;
        }
        if (prevCurrentAccountRef.current !== currentAccount && currentAccount) {
            const currentPath = location.pathname.split("/");
            currentPath[2] = currentAccount;
            history.push(currentPath.join("/"));
        }
        prevCurrentAccountRef.current = currentAccount;
    }, [currentAccount]);

    if (!account) {
        return <Page404 />;
    }
    const account_name = account.get("name");
    const isMyAccount = (AccountStore as any).isMyAccount(account);

    const passOnProps = {
        account_name,
        myActiveAccounts,
        searchAccounts,
        settings,
        wallet_locked,
        account,
        isMyAccount,
        hiddenAssets,
        contained: true,
        balances: account.get("balances", List()).toList(),
        orders: account.get("orders", List()).toList(),
        viewSettings,
        proxy: account.getIn(["options", "voting_account"]),
        history
    };

    return (
        <Switch>
            <Route
                path={`/account/${account_name}`}
                exact
                render={() => <AccountOverview {...passOnProps} />}
            />
            <Redirect
                from={`/account/${account_name}/overview`}
                to={`/account/${account_name}`}
            />
            <Route
                path={`/account/${account_name}/assets`}
                exact
                render={() => <AccountAssets {...passOnProps} />}
            />
            <Route
                path={`/account/${account_name}/pools`}
                exact
                render={() => <AccountPools {...passOnProps} />}
            />
            <Route
                path={`/account/${account_name}/create-asset`}
                exact
                render={() => <AccountAssetCreate {...(passOnProps as any)} />}
            />
            <Route
                path={`/account/${account_name}/update-asset/:asset`}
                exact
                render={() => <AccountAssetUpdate {...(passOnProps as any)} />}
            />
            <Route
                path={`/account/${account_name}/member-stats`}
                exact
                render={() => <AccountMembership {...passOnProps} />}
            />
            <Route
                path={`/account/${account_name}/vesting`}
                exact
                render={() => <AccountVesting {...passOnProps} />}
            />
            <Route
                path={`/account/${account_name}/permissions`}
                exact
                render={() => <AccountPermissions {...(passOnProps as any)} />}
            />
            <Route
                path={`/account/${account_name}/voting/:tab`}
                render={() => <AccountVoting {...(passOnProps as any)} />}
            />
            <Redirect
                from={`/account/${account_name}/voting`}
                to={`/account/${account_name}/voting/witnesses`}
            />
            <Route
                path={`/account/${account_name}/whitelist`}
                exact
                render={() => <AccountWhitelist {...passOnProps} />}
            />
            <Route
                path={`/account/${account_name}/signedmessages`}
                exact
                render={() => <AccountSignedMessages {...passOnProps} />}
            />
        </Switch>
    );
}

interface AccountPageChainContainerProps
    extends Omit<AccountPageCoreProps, "account"> {
    account: string;
}

function AccountPageChainContainer({
    account,
    ...rest
}: AccountPageChainContainerProps) {
    useChainStoreTick();
    const resolvedAccount = (ChainStore as any).getAccount(account, undefined);

    if (!resolvedAccount) {
        return (
            <React.Fragment>
                <LoadingIndicator />
                <span className="text-center">Loading ...</span>
            </React.Fragment>
        );
    }

    return <AccountPage {...rest} account={resolvedAccount} />;
}

interface AccountPageStoreWrapperProps {
    match: {params: {account_name: string}};
    [key: string]: any;
}

function AccountPageStoreWrapper(props: AccountPageStoreWrapperProps) {
    const account_name = props.match.params.account_name;

    const accountState = useAltStore<any>(AccountStore);
    const settingsState = useAltStore<any>(SettingsStore);
    const walletUnlockState = useAltStore<any>(WalletUnlockStore);

    return (
        <AccountPageChainContainer
            {...(props as any)}
            account={account_name}
            myActiveAccounts={accountState.myActiveAccounts}
            searchAccounts={accountState.searchAccounts}
            currentAccount={
                accountState.currentAccount || accountState.passwordAccount
            }
            settings={settingsState.settings}
            hiddenAssets={settingsState.hiddenAssets}
            wallet_locked={walletUnlockState.locked}
            viewSettings={settingsState.viewSettings}
        />
    );
}

export default AccountPageStoreWrapper;
