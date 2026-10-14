// TypeScript/functional-component port of the legacy Explorer.jsx (the
// "/explorer" tab-menu shell wrapping Blocks/Assets/Pools/Accounts/
// Witnesses/CommitteeMembers/Markets/Fees). Phase 2,
// docs/UI_MIGRATION_PLAN.md. Pure routing/tab-switching chrome around
// already-migrated (or still-legacy, for Markets/Fees) sub-tables - no
// data of its own.
//
// The legacy `this.state.tabs` was set once in the constructor and never
// touched by any `setState` call anywhere in the file - not real state,
// just a constant table dressed up as one. Ported as a plain module-level
// array. `history`/`location` came from react-router-dom's injected
// route props (`<Route component={Explorer} />` in App.jsx); ported with
// `useNavigate`/`useLocation`, the same hooks Settings.tsx already uses
// for the equivalent purpose.
//
// Renamed the `AssetsContainer`/`AccountsContainer` local import aliases
// to `Assets`/`Accounts` - both are functional components now (this
// file's own prior slices), and the "Container" name was a leftover from
// when they still had a separate connect()-wrapping container file.
import * as React from "react";
import {useNavigate, useLocation} from "react-router-dom";
import Witnesses from "./Witnesses";
import CommitteeMembers from "./CommitteeMembers";
import FeesContainer from "../Blockchain/FeesContainer";
import BlocksContainer from "./BlocksContainer";
import Assets from "./Assets";
import Accounts from "./Accounts";
import LiquidityPools from "./LiquidityPools";
import counterpart from "counterpart";
import MarketsContainer from "../Exchange/MarketsContainer";
import {Tabs} from "../../design-system/Tabs";
import styles from "./Explorer.module.scss";
import {EXPLORER_TAB_LINKS, explorerTabFor} from "./explorerTabs";

const tabs = [
    {
        name: "blocks",
        link: EXPLORER_TAB_LINKS.blocks,
        translate: "explorer.blocks.title",
        content: BlocksContainer
    },
    {
        name: "assets",
        link: EXPLORER_TAB_LINKS.assets,
        translate: "explorer.assets.title",
        content: Assets
    },
    {
        name: "pools",
        link: EXPLORER_TAB_LINKS.pools,
        translate: "poolmart.liquidity_pools.title",
        content: LiquidityPools
    },
    {
        name: "accounts",
        link: EXPLORER_TAB_LINKS.accounts,
        translate: "explorer.accounts.title",
        content: Accounts
    },
    {
        name: "witnesses",
        link: EXPLORER_TAB_LINKS.witnesses,
        translate: "explorer.witnesses.title",
        content: Witnesses
    },
    {
        name: "committee_members",
        link: EXPLORER_TAB_LINKS.committee_members,
        translate: "explorer.committee_members.title",
        content: CommitteeMembers
    },
    {
        name: "markets",
        link: EXPLORER_TAB_LINKS.markets,
        translate: "markets.title",
        content: MarketsContainer
    },
    {
        name: "fees",
        link: EXPLORER_TAB_LINKS.fees,
        translate: "fees.title",
        content: FeesContainer
    }
];

const LAST_TAB_KEY = "__graphene__explorerLastTab";

function rememberedTab(): string | null {
    try {
        const value = window.localStorage.getItem(LAST_TAB_KEY);
        return value && tabs.some(tab => tab.link === value) ? value : null;
    } catch (e) {
        return null; // storage blocked: just use the default
    }
}

export default function Explorer() {
    const navigate = useNavigate();
    const location = useLocation();
    const active = explorerTabFor(location.pathname, rememberedTab());

    // /explorer is not a tab of its own: land on the tab that is shown, so the
    // address and the tab always agree (and Back does not return to a blank).
    React.useEffect(() => {
        if (location.pathname.replace(/\/$/, "") !== active) {
            navigate(active, {replace: true});
        }
    }, [location.pathname, active, navigate]);

    function onChange(value: string) {
        try {
            window.localStorage.setItem(LAST_TAB_KEY, value);
        } catch (e) {
            // not remembered; still works
        }
        navigate(value);
    }

    return (
        <Tabs
            activeKey={active}
            animated={false}
            style={{display: "table", height: "100%", width: "100%"}}
            className={styles.panel}
            onChange={onChange}
        >
            {tabs.map(tab => {
                const TabContent = tab.content as React.ComponentType<any>;

                return (
                    <Tabs.TabPane
                        key={tab.link}
                        tab={counterpart.translate(tab.translate)}
                    >
                        <div className="padding">
                            <TabContent />
                        </div>
                    </Tabs.TabPane>
                );
            })}
        </Tabs>
    );
}
