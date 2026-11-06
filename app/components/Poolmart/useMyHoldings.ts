import * as React from "react";
import {ChainStore} from "bitsharesjs";
import PoolmartActions from "../../actions/PoolmartActions";
import {poolMetrics, shareOfPool} from "../../lib/common/poolMetrics";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

export interface Holding {
    fraction: number;
    amountA: number;
    amountB: number;
}

/** What `accountName` holds of the pools it has share tokens of. */
export function useMyHoldings(
    accountName: string | null
): {
    pools: any[];
    holdings: {[poolId: string]: Holding};
} {
    useChainStoreTick();
    const account: any = accountName
        ? (ChainStore as any).getAccount(accountName)
        : null;
    const balances: {[assetId: string]: string} =
        account && typeof account.get === "function" && account.get("balances")
            ? account.get("balances").toJS()
            : {};
    const key = Object.keys(balances)
        .sort()
        .join(",");
    const [pools, setPools] = React.useState<any[]>([]);
    React.useEffect(() => {
        if (!key) {
            setPools([]);
            return;
        }
        let cancelled = false;
        (PoolmartActions as any)
            .getPoolsByShareAssets(key.split(","))
            .then((found: any[]) => {
                if (!cancelled) setPools(found);
            });
        return () => {
            cancelled = true;
        };
    }, [key]);

    const holdings: {[poolId: string]: Holding} = {};
    const mine: any[] = [];
    pools.forEach(pool => {
        const balanceId = balances[pool.share_asset];
        const balanceObject = balanceId
            ? (ChainStore as any).getObject(balanceId)
            : null;
        const shareAsset: any = (ChainStore as any).getAsset(pool.share_asset);
        const dynamic: any =
            shareAsset && typeof shareAsset.get === "function"
                ? (ChainStore as any).getObject(
                      shareAsset.get("dynamic_asset_data_id")
                  )
                : null;
        if (!balanceObject || !dynamic || !pool.asset_a_obj) return;
        const unit = Math.pow(10, shareAsset.get("precision"));
        const shares = Number(balanceObject.get("balance")) / unit;
        const supply = Number(dynamic.get("current_supply")) / unit;
        if (!(shares > 0)) return;
        const m = poolMetrics(
            pool,
            pool.asset_a_obj.get("precision"),
            pool.asset_b_obj.get("precision")
        );
        const share = shareOfPool(shares, supply, m.reserveA, m.reserveB);
        holdings[pool.id] = share;
        mine.push(pool);
    });
    return {pools: mine, holdings};
}
