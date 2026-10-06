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
import {
    Routes,
    Route,
    Navigate,
    useNavigate,
    useLocation,
    useParams
} from "react-router-dom";
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
}

function AccountPage({
    account,
    currentAccount,
    myActiveAccounts,
    searchAccounts,
    settings,
    wallet_locked,
    hiddenAssets,
    viewSettings
}: AccountPageCoreProps) {
    // react-router v6 no longer injects `history`/`location` as props
    // (see this file's header - the parent `<Route element={<AccountPage
    // .../>}>` in App.jsx doesn't auto-inject routing props at all) - read
    // directly via hooks instead. `passOnProps.history` was dead (grep-
    // confirmed none of the 10 nested route components below ever read
    // it), dropped rather than replaced with `navigate`.
    const navigate = useNavigate();
    const location = useLocation();
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
            navigate(currentPath.join("/"));
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
        proxy: account.getIn(["options", "voting_account"])
    };

    // Relative to the parent `/account/:account_name/*` match in
    // App.jsx (react-router v6 nested `<Routes>` match relative to
    // where the parent match left off, not against the full absolute
    // URL like v5's `Switch`/`Route` did) - `Navigate` targets stay
    // absolute (always unambiguous, matches the interpolated-string
    // style the original `Redirect`s already used).
    return (
        <Routes>
            <Route
                index
                element={<AccountOverview {...passOnProps} />}
            />
            <Route
                path="overview"
                element={<Navigate to={`/account/${account_name}`} replace />}
            />
            <Route
                path="assets"
                element={<AccountAssets {...passOnProps} />}
            />
            <Route
                path="pools"
                element={<AccountPools {...passOnProps} />}
            />
            <Route
                path="create-asset"
                element={<AccountAssetCreate {...(passOnProps as any)} />}
            />
            <Route
                path="update-asset/:asset"
                element={<AccountAssetUpdate {...(passOnProps as any)} />}
            />
            <Route
                path="member-stats"
                element={<AccountMembership {...passOnProps} />}
            />
            <Route
                path="vesting"
                element={<AccountVesting {...passOnProps} />}
            />
            <Route
                path="permissions"
                element={<AccountPermissions {...(passOnProps as any)} />}
            />
            <Route
                path="voting/:tab"
                element={<AccountVoting {...(passOnProps as any)} />}
            />
            <Route
                path="voting"
                element={
                    <Navigate
                        to={`/account/${account_name}/voting/witnesses`}
                        replace
                    />
                }
            />
            <Route
                path="whitelist"
                element={<AccountWhitelist {...passOnProps} />}
            />
            <Route
                path="signedmessages"
                element={<AccountSignedMessages {...passOnProps} />}
            />
        </Routes>
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
    [key: string]: any;
}

function AccountPageStoreWrapper(props: AccountPageStoreWrapperProps) {
    // Safe to assert non-null: this component only ever renders via the
    // `/account/:account_name/*` route in App.jsx, where `:account_name`
    // is a required URL segment.
    const {account_name} = useParams<{account_name: string}>() as {
        account_name: string;
    };

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
