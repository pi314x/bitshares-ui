// Every asset that is in a liquidity pool, for the pools page's filters (a drop-down of
// them, searched while typing, in place of a field to type a symbol into): what is on
// either side of a pool, which assets each is paired with, and the share assets.
import {Apis} from "bitsharesjs-ws";

export interface PoolRef {
    id?: string;
    asset_a: string;
    asset_b: string;
    share_asset: string;
}

export interface PoolAssets {
    /** the symbols of the assets in a pool: BTS first, then A-Z */
    assets: string[];
    /** symbol -> the symbols it is paired with in some pool */
    partners: {[symbol: string]: string[]};
    /** the symbols of the pools' share assets */
    shares: string[];
}

const CORE_ASSET_ID = "1.3.0";

/** BTS first, then alphabetical, ignoring case (gateway prefixes are lower case). */
export function sortSymbols(
    symbols: string[],
    coreSymbol: string | null
): string[] {
    return symbols.slice().sort((a, b) => {
        if (a === coreSymbol) return -1;
        if (b === coreSymbol) return 1;
        const la = a.toLowerCase();
        const lb = b.toLowerCase();
        return la < lb ? -1 : la > lb ? 1 : a < b ? -1 : a > b ? 1 : 0;
    });
}

export function buildPoolAssets(
    pools: PoolRef[],
    symbolOf: {[assetId: string]: string}
): PoolAssets {
    const assets = new Set<string>();
    const shares = new Set<string>();
    const partners: {[symbol: string]: Set<string>} = {};
    const link = (a: string, b: string) => {
        (partners[a] = partners[a] || new Set()).add(b);
    };
    pools.forEach(pool => {
        const a = symbolOf[pool.asset_a];
        const b = symbolOf[pool.asset_b];
        const share = symbolOf[pool.share_asset];
        if (a) assets.add(a);
        if (b) assets.add(b);
        if (a && b) {
            link(a, b);
            link(b, a);
        }
        if (share) shares.add(share);
    });
    const core = symbolOf[CORE_ASSET_ID] || null;
    const sortedPartners: {[symbol: string]: string[]} = {};
    Object.keys(partners).forEach(symbol => {
        sortedPartners[symbol] = sortSymbols(
            Array.from(partners[symbol]),
            core
        );
    });
    return {
        assets: sortSymbols(Array.from(assets), core),
        partners: sortedPartners,
        shares: sortSymbols(Array.from(shares), null)
    };
}

const PAGE = 100;
const MAX_PAGES = 50;
let loading: Promise<PoolAssets> | null = null;

/** All of the chain's pools (a few pages), their assets named. Kept for the session. */
export function fetchPoolAssets(): Promise<PoolAssets> {
    if (!loading) {
        loading = (async () => {
            const db = Apis.instance().db_api();
            const pools = new Map<string, PoolRef>();
            let start = "1.19.0";
            for (let page = 0; page < MAX_PAGES; page++) {
                const rows: any[] =
                    (await db.exec("list_liquidity_pools", [PAGE, start])) ||
                    [];
                let added = 0;
                rows.forEach(row => {
                    if (row && !pools.has(row.id)) {
                        pools.set(row.id, {
                            id: row.id,
                            asset_a: row.asset_a,
                            asset_b: row.asset_b,
                            share_asset: row.share_asset
                        });
                        added++;
                    }
                });
                if (rows.length < PAGE || !added) break;
                start = rows[rows.length - 1].id;
            }
            const ids = new Set<string>([CORE_ASSET_ID]);
            pools.forEach(pool => {
                ids.add(pool.asset_a);
                ids.add(pool.asset_b);
                ids.add(pool.share_asset);
            });
            const all = Array.from(ids);
            const symbolOf: {[assetId: string]: string} = {};
            for (let i = 0; i < all.length; i += PAGE) {
                const rows: any[] =
                    (await db.exec("get_assets", [all.slice(i, i + PAGE)])) ||
                    [];
                rows.forEach(row => {
                    if (row) symbolOf[row.id] = row.symbol;
                });
            }
            return buildPoolAssets(Array.from(pools.values()), symbolOf);
        })();
        // a failed load is tried again next time
        loading.catch(() => {
            loading = null;
        });
    }
    return loading;
}
