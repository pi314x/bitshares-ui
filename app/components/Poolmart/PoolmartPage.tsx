// /pools: the liquidity pools of the chain and, one view over, the pools the
// current account created (create / delete / stake from there). The latter was
// the portfolio's "Pools" page (`/account/<name>/pools`), which is now this view:
// a second list of pools under the account is a duplicate of the menu's own
// entry (docs/UI_MIGRATION_PLAN.md §7.25).
import * as React from "react";
import {useSearchParams} from "react-router-dom";
import {ChainStore} from "bitsharesjs";
import {SubMenu} from "../../design-system/SubMenu";
import {Alert} from "../../design-system/Alert";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import LoadingIndicator from "../LoadingIndicator";
import AccountPools from "../Account/AccountPools";
import LiquidityPools from "./LiquidityPools";
import styles from "./PoolmartPage.module.scss";

type View = "all" | "mine";

const VIEWS: Array<{key: View; label: string}> = [
    {key: "all", label: "All pools"},
    {key: "mine", label: "Created by me"}
];

function MyPools() {
    useChainStoreTick();
    const accountState = useReduxState<any>(selectAccountState);
    const name: string | null =
        accountState.currentAccount || accountState.passwordAccount || null;
    if (!name) {
        return (
            <Alert
                type="info"
                showIcon
                message="Log in to see the pools of your account."
            />
        );
    }
    const account = (ChainStore as any).getAccount(name, undefined);
    if (!account) return <LoadingIndicator />;
    return <AccountPools account={account} account_name={name} />;
}

export default function PoolmartPage() {
    const [params, setParams] = useSearchParams();
    const view: View = params.get("view") === "mine" ? "mine" : "all";

    return (
        <div className={styles.panel}>
            <div className={styles.views}>
                <SubMenu
                    aria-label="Liquidity pools"
                    items={VIEWS}
                    value={view}
                    onChange={key =>
                        setParams(key === "mine" ? {view: "mine"} : {}, {
                            replace: true
                        })
                    }
                />
            </div>
            {view === "mine" ? <MyPools /> : <LiquidityPools />}
        </div>
    );
}
