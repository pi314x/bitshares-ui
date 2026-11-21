import * as React from "react";
import PoolmartActions from "../../actions/PoolmartActions";

/**
 * The pools behind the starred share assets (statistics and asset objects included), in the order they were
 * starred, wherever they are in the long list of pools: a filter on the page does not hide a favorite.
 */
export function useFavoritePoolObjects(shareAssets: string[]): any[] {
    const key = shareAssets.join(",");
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
    // the node answers in its own order
    const order = new Map(shareAssets.map((id, i) => [id, i]));
    return pools
        .filter(pool => order.has(pool.share_asset))
        .sort(
            (a, b) =>
                (order.get(a.share_asset) as number) -
                (order.get(b.share_asset) as number)
        );
}
