// TypeScript/functional-component port of the legacy DashboardPage.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
// This is the route-level component for the Dashboard tab (lazy-loaded
// by `App.jsx`), and the last of the 7 `Dashboard/` files - completes the
// directory alongside its sibling `Markets.tsx` (ported in the same
// commit, since this file imports `{StarredMarkets, FeaturedMarkets}`
// from it).
//
// Not security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `.add_type_operation`, `process_transaction` - none appear.
// This component only lays out tabs of already-ported market-list
// components; no transaction is ever built or signed here.
//
// `connect(DashboardPage, {listenTo: [AccountStore, SettingsStore],
// getProps() {...}})` is replaced by `useAltStore(...)` calls for both
// stores in an outer `DashboardPage` wrapper, passed down to a
// `DashboardPageCore` function - this migration's established
// Container+Core split. No `BindToChainState` existed in the original
// (verified: only `connect` at the bottom of the `.jsx`), so no
// `useChainStoreTick()` translation was needed.
//
// This component receives no props of its own from its caller
// (`App.jsx` renders it as a plain route `component={DashboardPage}`,
// so only react-router's own `match`/`location`/`history` props would
// be implicitly injected - none of which the original ever read, so
// none are declared or accepted here either, matching this migration's
// established treatment of unread route props elsewhere, e.g.
// `PredictionMarkets/PMAssetsContainer.tsx`).
import * as React from "react";
import LoadingIndicator from "../LoadingIndicator";
import LoginSelector from "../LoginSelector";
import AccountStore from "stores/AccountStore";
import SettingsStore from "stores/SettingsStore";

import {Tabs, Tab} from "../Utility/Tabs";
import {StarredMarkets, FeaturedMarkets} from "./Markets";
import {getPossibleGatewayPrefixes} from "common/gateways";
import {useAltStore} from "../../next/hooks/useAltStore";
import "./DashboardList.scss";

interface DashboardPageCoreProps {
    myActiveAccounts: any;
    myHiddenAccounts: any;
    accountsReady: boolean;
    passwordAccount: any;
    preferredBases: any;
}

function DashboardPageCore({
    myActiveAccounts,
    myHiddenAccounts,
    accountsReady,
    passwordAccount,
    preferredBases
}: DashboardPageCoreProps) {
    if (!accountsReady) {
        return <LoadingIndicator />;
    }

    const accountCount =
        myActiveAccounts.size +
        myHiddenAccounts.size +
        (passwordAccount ? 1 : 0);
    if (!accountCount) {
        return <LoginSelector />;
    }

    return (
        <div className="grid-block page-layout">
            <div className="grid-block no-padding">
                <div className="grid-content app-tables no-padding">
                    <div className="content-block small-12">
                        <div className="tabs-container generic-bordered-box dash-panel">
                            <Tabs
                                defaultActiveTab={1}
                                segmented={false}
                                setting="dashboardTab"
                                className="account-tabs"
                                tabsClass="account-overview no-padding bordered-header content-block"
                            >
                                <Tab title="dashboard.starred_markets">
                                    <StarredMarkets />
                                </Tab>
                                {preferredBases.map((q: any) => {
                                    const title = (
                                        <span>
                                            <img
                                                className="column-hide-small"
                                                style={{
                                                    maxWidth: 30,
                                                    marginRight: 5
                                                }}
                                                src={`${__BASE_URL__}asset-symbols/${q
                                                    .replace(
                                                        /^BTC/,
                                                        "OPEN.BTC"
                                                    )
                                                    .toLowerCase()}.png`}
                                            />
                                            &nbsp;
                                            {q}
                                        </span>
                                    );

                                    return (
                                        <Tab key={q} title={title}>
                                            <FeaturedMarkets
                                                quotes={[q].concat(
                                                    (getPossibleGatewayPrefixes as any)(
                                                        [q]
                                                    )
                                                )}
                                            />
                                        </Tab>
                                    );
                                })}
                            </Tabs>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DashboardPage() {
    const accountState = useAltStore<any>(AccountStore);
    const settingsState = useAltStore<any>(SettingsStore);

    const {
        myActiveAccounts,
        myHiddenAccounts,
        passwordAccount,
        accountsLoaded,
        refsLoaded
    } = accountState;

    return (
        <DashboardPageCore
            myActiveAccounts={myActiveAccounts}
            myHiddenAccounts={myHiddenAccounts}
            passwordAccount={passwordAccount}
            accountsReady={accountsLoaded && refsLoaded}
            preferredBases={settingsState.preferredBases}
        />
    );
}

export default DashboardPage;
