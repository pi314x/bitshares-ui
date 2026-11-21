import * as React from "react";
import {PoolAssets, fetchPoolAssets} from "../../lib/chain/poolAssets";

/** The assets that are in a pool of the chain, or null until they are known. */
export function usePoolAssets(): PoolAssets | null {
    const [assets, setAssets] = React.useState<PoolAssets | null>(null);
    React.useEffect(() => {
        let cancelled = false;
        fetchPoolAssets()
            .then(found => {
                if (!cancelled) setAssets(found);
            })
            .catch(() => {
                // the drop-downs stay with what is chosen; the list itself still works
            });
        return () => {
            cancelled = true;
        };
    }, []);
    return assets;
}
