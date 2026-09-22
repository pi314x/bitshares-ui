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
// `useHistory`/`useLocation`, the same hooks Settings.tsx already uses
// for the equivalent purpose.
//
// Renamed the `AssetsContainer`/`AccountsContainer` local import aliases
// to `Assets`/`Accounts` - both are functional components now (this
// file's own prior slices), and the "Container" name was a leftover from
// when they still had a separate connect()-wrapping container file.
import * as React from "react";
import {useHistory, useLocation} from "react-router-dom";
import Witnesses from "./Witnesses";
import CommitteeMembers from "./CommitteeMembers";
import FeesContainer from "../Blockchain/FeesContainer";
import BlocksContainer from "./BlocksContainer";
import Assets from "./Assets";
import Accounts from "./Accounts";
import LiquidityPools from "./LiquidityPools";
import counterpart from "counterpart";
import MarketsContainer from "../Exchange/MarketsContainer";
import {Tabs} from "bitshares-ui-style-guide";
import "./Explorer.scss";

const tabs = [
    {
        name: "blocks",
        link: "/explorer/blocks",
        translate: "explorer.blocks.title",
        content: BlocksContainer
    },
    {
        name: "assets",
        link: "/explorer/assets",
        translate: "explorer.assets.title",
        content: Assets
    },
    {
        name: "pools",
        link: "/explorer/pools",
        translate: "poolmart.liquidity_pools.title",
        content: LiquidityPools
    },
    {
        name: "accounts",
        link: "/explorer/accounts",
        translate: "explorer.accounts.title",
        content: Accounts
    },
    {
        name: "witnesses",
        link: "/explorer/witnesses",
        translate: "explorer.witnesses.title",
        content: Witnesses
    },
    {
        name: "committee_members",
        link: "/explorer/committee-members",
        translate: "explorer.committee_members.title",
        content: CommitteeMembers
    },
    {
        name: "markets",
        link: "/explorer/markets",
        translate: "markets.title",
        content: MarketsContainer
    },
    {
        name: "fees",
        link: "/explorer/fees",
        translate: "fees.title",
        content: FeesContainer
    }
];

export default function Explorer() {
    const history = useHistory();
    const location = useLocation();

    function onChange(value: string) {
        history.push(value);
    }

    return (
        <Tabs
            activeKey={location.pathname}
            animated={false}
            style={{display: "table", height: "100%", width: "100%"}}
            className="exp-panel"
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
