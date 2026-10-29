// TypeScript/functional-component port of the legacy AccountOverview.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `AssetWrapper(AccountOverview, {propNames: ["core_asset"]})` (shared
// HOC, out of scope) and the trivial `AccountOverviewWrapper` passthrough
// class (`<BalanceWrapper {...this.props} wrap={AccountOverview} />`,
// `BalanceWrapper` already a `.tsx` port from an earlier batch) are kept
// in the same two-layer shape, just as functions instead of classes.
//
// `UNSAFE_componentWillMount` (calls `_checkMarginStatus(this.props)`)
// and `UNSAFE_componentWillReceiveProps` (calls `_checkMarginStatus(np)`
// only when `np.account !== this.props.account`) both ultimately reduce
// to "call `checkMarginStatus(account)`" - `_checkMarginStatus`'s
// `props` parameter is only ever used for `props.account`, so both call
// sites are the *same* call with the *same* argument shape once you
// substitute `account` for `props`/`np`. A single `useEffect` keyed on
// `account` reproduces both without needing a mount-guard, matching the
// pattern already established for cases where the mount and update call
// sites pass identical arguments (`AccountReferralsTable.tsx`,
// `AccountVesting.tsx`).
//
// `shouldComponentUpdate` (a multi-field shallow-equality gate spanning
// both props and state) has no hooks equivalent for a component gating
// its own re-renders this way, and is dropped - it doesn't change any
// rendered output, only how many times identical output might be
// recomputed.
//
// `state.alwaysShowAssets` is set once in the constructor and never
// reassigned anywhere, so it's kept as a plain local constant rather
// than state. `state.enabledColumns` is read twice (once in the dropped
// `shouldComponentUpdate`, once forwarded as a prop) but never actually
// set anywhere in the class, so it's always `undefined` - replicated by
// passing a literal `undefined` for that one prop rather than inventing
// state that would never hold anything else.
//
// Dropped as confirmed dead: the `ref="appTables"` legacy string ref on
// the outer `<div>` (never read via `this.refs.appTables` anywhere); the
// `Input`/`Icon` imports from `bitshares-ui-style-guide` (already unused
// in the original - neither is referenced anywhere in `render()`).
//
// `ChainStore.requestAllDataForAccount(...)` is called directly in the
// component body (not in an effect), exactly as the original class does
// in `render()` - preserved verbatim, including running on every render.
import BalanceHistoryChart from "./BalanceHistoryChart";
import * as React from "react";
import Immutable from "immutable";
import Translate from "react-translate-component";
import TotalBalanceValue from "../Utility/TotalBalanceValue";
import MarginPositionsTable from "./MarginPositionsTable";
import {RecentTransactions} from "./RecentTransactions";
import Proposals from "components/Account/Proposals";
import {ChainStore} from "bitsharesjs";
import {requestAllBalances} from "../../lib/chain/requestBalances";
import SettingsActions from "actions/SettingsActions";
import utils from "common/utils";
import {Tabs} from "../../design-system/Tabs";
import {SubMenu} from "../../design-system/SubMenu";
import styles from "./AccountOverview.module.scss";
import AccountOrders from "./AccountOrders";
import TranslateWithLinks from "../Utility/TranslateWithLinks";
import {checkMarginStatus} from "common/accountHelper";
import BalanceWrapper from "./BalanceWrapper";
import AccountTreemap from "./AccountTreemap";
import AssetWrapper from "../Utility/AssetWrapper";
import AccountPortfolioList from "./AccountPortfolioList";
import {Switch} from "../../design-system/Switch";
import {Tooltip} from "../../design-system/Tooltip";
import {Button} from "../../design-system/Button";
import counterpart from "counterpart";
import SearchInput from "../Utility/SearchInput";
import CreditOfferAccountPage from "./CreditOffer/CreditOfferAccountPage";

interface AccountOverviewState {
    shownAssets: any;
    hideFishingProposals: boolean;
    question1: boolean;
    question2: boolean;
    question3: boolean;
    filterValue?: any;
    globalMarginStatus?: any;
}

interface AccountOverviewCoreProps {
    account: any;
    hiddenAssets: any;
    settings: any;
    orders: any;
    core_asset: any;
    isMyAccount: any;
    balances: any;
    viewSettings: any;
    [key: string]: any;
}

function AccountOverview(props: AccountOverviewCoreProps) {
    const {
        account,
        hiddenAssets,
        settings,
        orders,
        core_asset,
        isMyAccount,
        balances,
        viewSettings
    } = props;

    const alwaysShowAssets = [
        "BTS"
        // "USD",
        // "CNY"
    ];

    const [state, setState] = React.useState<AccountOverviewState>({
        shownAssets: viewSettings.get("shownAssets", "active"),
        hideFishingProposals: true,
        question1: false,
        question2: false,
        question3: false
    });

    const mergeState = (partial: Partial<AccountOverviewState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    React.useEffect(() => {
        (checkMarginStatus as any)(account).then((status: any) => {
            let globalMarginStatus = null;
            for (const asset in status) {
                globalMarginStatus =
                    status[asset].statusClass || globalMarginStatus;
            }
            mergeState({globalMarginStatus});
        });
    }, [account]);

    const handleFilterInput = (e: any) => {
        mergeState({
            filterValue: e.target.value
        });
    };

    const changeShownAssets = (shownAssets: any = "active") => {
        mergeState({
            shownAssets
        });
        (SettingsActions as any).changeViewSetting({
            shownAssets
        });
    };

    const toggleHideProposal = () => {
        mergeState({
            hideFishingProposals: !state.hideFishingProposals
        });
    };

    const toggleQ1 = () => {
        mergeState({
            question1: !state.question1
        });
    };

    const toggleQ2 = () => {
        mergeState({
            question2: !state.question2
        });
    };

    const toggleQ3 = () => {
        mergeState({
            question3: !state.question3
        });
    };

    const showProposals = () => {
        (SettingsActions as any).changeSetting({
            setting: "showProposedTx",
            value: true
        });
    };

    const {shownAssets} = state;

    if (!account) {
        return null;
    }

    const preferredUnit = !settings.get("unit")
        ? core_asset.get("symbol")
        : settings.get("unit");

    let call_orders: any[] = [];
    const collateral: any = {};
    const debt: any = {};

    // Request all balance objects for dashboard view
    requestAllBalances(account.toJS().id);

    if ((account as any).toJS && account.has("call_orders"))
        call_orders = account.get("call_orders").toJS();
    let account_balances = account.get("balances");
    let includedBalancesList = Immutable.List<string>(),
        hiddenBalancesList = Immutable.List<string>();
    call_orders.forEach((callID: any) => {
        const position: any = ChainStore.getObject(callID);
        if (position) {
            const collateralAsset = position.getIn([
                "call_price",
                "base",
                "asset_id"
            ]);
            if (!collateral[collateralAsset]) {
                collateral[collateralAsset] = parseInt(
                    position.get("collateral"),
                    10
                );
            } else {
                collateral[collateralAsset] += parseInt(
                    position.get("collateral"),
                    10
                );
            }
            const debtAsset = position.getIn([
                "call_price",
                "quote",
                "asset_id"
            ]);
            if (!debt[debtAsset]) {
                debt[debtAsset] = parseInt(position.get("debt"), 10);
            } else {
                debt[debtAsset] += parseInt(position.get("debt"), 10);
            }
        }
    });

    if (account_balances) {
        // Filter out balance objects that have 0 balance or are not included in open orders
        account_balances = account_balances.filter((a: any, index: any) => {
            const balanceObject = ChainStore.getObject(a);
            if (
                balanceObject &&
                !(balanceObject as any).get("balance") &&
                !orders[index]
            ) {
                return false;
            } else {
                return true;
            }
        });

        // Separate balances into hidden and included
        account_balances.forEach((a: any, asset_type: any) => {
            const asset: any = ChainStore.getAsset(asset_type);

            let assetName = "";
            let filter = "";

            if (state.filterValue) {
                filter = state.filterValue
                    ? String(state.filterValue).toLowerCase()
                    : "";
                assetName = asset.get("symbol").toLowerCase();
                const {isBitAsset} = (utils as any).replaceName(asset);
                if (isBitAsset) {
                    assetName = "bit" + assetName;
                }
            }

            if (
                hiddenAssets.includes(asset_type) &&
                assetName.includes(filter)
            ) {
                hiddenBalancesList = hiddenBalancesList.push(a);
            } else if (assetName.includes(filter)) {
                includedBalancesList = includedBalancesList.push(a);
            }
        });
    }

    const portfolioHiddenAssetsBalance = (
        <TotalBalanceValue noTip balances={hiddenBalancesList} hide_asset />
    );

    const portfolioActiveAssetsBalance = (
        <TotalBalanceValue noTip balances={includedBalancesList} hide_asset />
    );
    const ordersValue = (
        <TotalBalanceValue
            noTip
            balances={Immutable.List()}
            openOrders={orders}
            hide_asset
        />
    );
    const marginValue = (
        <TotalBalanceValue
            noTip
            balances={Immutable.List()}
            debt={debt}
            collateral={collateral}
            hide_asset
        />
    );
    const debtValue = (
        <TotalBalanceValue
            noTip
            balances={Immutable.List()}
            debt={debt}
            hide_asset
        />
    );
    const collateralValue = (
        <TotalBalanceValue
            noTip
            balances={Immutable.List()}
            collateral={collateral}
            hide_asset
        />
    );

    const totalValueText = (
        <TranslateWithLinks
            noLink
            string="account.total"
            keys={[{type: "asset", value: preferredUnit, arg: "asset"}]}
        />
    );

    const includedPortfolioBalance = (
        <span key="portfolio" className="total-value">
            {totalValueText}: {portfolioActiveAssetsBalance}
        </span>
    );

    const hiddenPortfolioBalance = (
        <span key="portfolio" className="total-value">
            {totalValueText}: {portfolioHiddenAssetsBalance}
        </span>
    );

    const includedPortfolioList = (
        <AccountPortfolioList
            balanceList={includedBalancesList}
            optionalAssets={!state.filterValue ? alwaysShowAssets : null}
            visible={true}
            preferredUnit={preferredUnit}
            coreAsset={core_asset}
            coreSymbol={core_asset.get("symbol")}
            hiddenAssets={hiddenAssets}
            orders={orders}
            account={account}
            isMyAccount={isMyAccount}
            balances={balances}
            extraRow={includedPortfolioBalance}
            viewSettings={viewSettings}
            callOrders={call_orders}
        />
    );

    const hiddenPortfolioList = (
        <AccountPortfolioList
            balanceList={hiddenBalancesList}
            optionalAssets={
                !state.filterValue ? (alwaysShowAssets as any) : null
            }
            visible={false}
            preferredUnit={preferredUnit}
            coreSymbol={core_asset.get("symbol")}
            settings={settings}
            hiddenAssets={hiddenAssets}
            orders={orders}
            account={account}
            isMyAccount={isMyAccount}
            balances={balances}
            extraRow={hiddenPortfolioBalance}
            viewSettings={viewSettings}
            enabledColumns={undefined}
        />
    );

    const proposalsCount = account.get("proposals")
        ? account.get("proposals").size
        : 0;

    // What the filter bar of the balances tab offers: the visible assets, the
    // hidden ones (only when there are any) and the treemap.
    const assetViews = [
        {key: "active", label: counterpart.translate("account.hide_hidden")},
        ...(hiddenBalancesList.size
            ? [
                  {
                      key: "hidden",
                      label: counterpart.translate("account.show_hidden")
                  }
              ]
            : []),
        {key: "visual", label: counterpart.translate("account.show_visual")}
    ];

    const tabs: Array<{
        key: string;
        title: string;
        sub?: React.ReactNode;
        content: React.ReactNode;
    }> = [
        {
            key: "0",
            title: counterpart.translate("account.portfolio"),
            sub: portfolioActiveAssetsBalance,
            content: (
                <>
                    <div className={styles.toolbar}>
                        <div className={styles.filter}>
                            <SearchInput
                                value={state.filterValue}
                                onChange={handleFilterInput}
                            />
                        </div>
                        <SubMenu
                            flush
                            aria-label={counterpart.translate(
                                "account.portfolio"
                            )}
                            items={assetViews}
                            value={
                                assetViews.some(v => v.key === shownAssets)
                                    ? shownAssets
                                    : "active"
                            }
                            onChange={changeShownAssets}
                        />
                    </div>
                    {shownAssets != "visual" ? (
                        <div className={styles.scroll}>
                            {shownAssets === "hidden" && hiddenBalancesList.size
                                ? hiddenPortfolioList
                                : includedPortfolioList}
                        </div>
                    ) : (
                        <AccountTreemap balanceObjects={includedBalancesList} />
                    )}
                </>
            )
        },
        {
            key: "1",
            title: counterpart.translate("account.open_orders"),
            sub: ordersValue,
            content: (
                <div className={styles.padded}>
                    <AccountOrders {...props}>
                        <div className={styles.total}>
                            <span className={styles.totalLabel}>
                                {totalValueText}
                            </span>
                            <span className={styles.totalValue}>
                                {ordersValue}
                            </span>
                        </div>
                    </AccountOrders>
                </div>
            )
        },
        {
            key: "2",
            title: counterpart.translate("account.collaterals"),
            sub: (
                <span className={state.globalMarginStatus}>{marginValue}</span>
            ),
            content: (
                <div className={styles.scroll}>
                    <MarginPositionsTable
                        preferredUnit={preferredUnit}
                        className="dashboard-table"
                        callOrders={call_orders}
                        account={account}
                    >
                        <tr className="total-value">
                            <td>{totalValueText}</td>
                            <td />
                            <td>{debtValue}</td>
                            <td className="column-hide-medium">
                                {collateralValue}
                            </td>
                            <td />
                            <td>{marginValue}</td>
                            <td className="column-hide-small" />
                            <td className="column-hide-small" />
                            <td colSpan={5} />
                        </tr>
                    </MarginPositionsTable>
                </div>
            )
        },
        {
            key: "3",
            title: counterpart.translate("account.credit_offer"),
            content: <CreditOfferAccountPage account={account} />
        },
        {
            key: "4",
            title: counterpart.translate("account.activity"),
            content: (
                <div className={`${styles.scroll} ${styles.wrapCells}`}>
                    <RecentTransactions
                        accountsList={Immutable.fromJS([account.get("id")])}
                        compactView={false}
                        showMore={true}
                        fullHeight={true}
                        limit={100}
                        showFilters={true}
                        dashboard
                    />
                </div>
            )
        }
    ];

    if (proposalsCount) {
        tabs.push({
            key: "5",
            title: counterpart.translate("explorer.proposals.title"),
            sub: String(proposalsCount),
            content: (
                <div className={styles.padded}>
                    {settings.get("showProposedTx") && (
                        <div
                            onClick={toggleHideProposal}
                            style={{cursor: "pointer"}}
                        >
                            <Tooltip
                                title={counterpart.translate(
                                    "tooltip.propose_unhide"
                                )}
                                placement="bottom"
                            >
                                <Switch
                                    style={{margin: 16}}
                                    checked={state.hideFishingProposals}
                                    onChange={toggleHideProposal}
                                />
                                <Translate content="account.deactivate_suspicious_proposals" />
                            </Tooltip>
                        </div>
                    )}
                    {settings.get("showProposedTx") && (
                        <Proposals
                            className="dashboard-table"
                            account={account}
                            hideFishingProposals={state.hideFishingProposals}
                        />
                    )}
                    {!settings.get("showProposedTx") && (
                        <div className="padding">
                            <div>
                                <Translate content="account.proposed_transactions.advanced_feature" />
                                :
                            </div>
                            <br />
                            <br />
                            <div>
                                <Translate content="account.proposed_transactions.question1" />
                                <Switch
                                    style={{margin: 16}}
                                    checked={state.question1}
                                    onChange={toggleQ1}
                                    checkedChildren={"Yes"}
                                    unCheckedChildren={"No"}
                                />
                            </div>
                            {state.question1 && (
                                <div>
                                    <Translate content="account.proposed_transactions.question2" />
                                    <Switch
                                        style={{margin: 16}}
                                        checked={state.question2}
                                        onChange={toggleQ2}
                                        checkedChildren={"Yes"}
                                        unCheckedChildren={"No"}
                                    />
                                </div>
                            )}
                            {state.question2 && (
                                <div>
                                    <Translate content="account.proposed_transactions.question3" />
                                    <Switch
                                        style={{margin: 16}}
                                        checked={state.question3}
                                        onChange={toggleQ3}
                                        checkedChildren={"Yes"}
                                        unCheckedChildren={"No"}
                                    />
                                </div>
                            )}
                            <br />
                            {state.question3 && (
                                <div
                                    style={{
                                        marginTop: 16,
                                        marginBottom: 16,
                                        display: "flex",
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                        gap: 16
                                    }}
                                >
                                    <Translate content="account.proposed_transactions.answered_no" />
                                    <Button onClick={showProposals}>
                                        <Translate content="account.proposed_transactions.show_me_proposals" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )
        });
    }

    // the tab last used is remembered (the dashboard links to "open orders" by
    // setting it too); a stored number past the tabs shown is the first tab
    const savedTab = Number(viewSettings.get("overviewTab", 0));
    const activeKey = String(
        Number.isInteger(savedTab) && savedTab >= 0 && savedTab < tabs.length
            ? savedTab
            : 0
    );
    const onTab = (key: string) => {
        (SettingsActions as any).changeViewSetting({
            overviewTab: Number(key)
        });
    };

    return (
        <div className="grid-content app-tables no-padding">
            <div className="content-block small-12">
                <BalanceHistoryChart accountId={account.get("id")} />
                <div className={styles.panel}>
                    <Tabs
                        activeKey={activeKey}
                        animated={false}
                        onChange={onTab}
                        className={styles.tabs}
                    >
                        {tabs.map(tab => (
                            <Tabs.TabPane
                                key={tab.key}
                                tab={
                                    <span className={styles.tabLabel}>
                                        {tab.title}
                                        {tab.sub ? (
                                            <span className={styles.tabSub}>
                                                {tab.sub}
                                            </span>
                                        ) : null}
                                    </span>
                                }
                            >
                                <div className={styles.pane}>{tab.content}</div>
                            </Tabs.TabPane>
                        ))}
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

const WrappedAccountOverview = AssetWrapper(AccountOverview, {
    propNames: ["core_asset"]
} as any);

function AccountOverviewWrapper(props: any) {
    return <BalanceWrapper {...props} wrap={WrappedAccountOverview} />;
}

export default AccountOverviewWrapper;
