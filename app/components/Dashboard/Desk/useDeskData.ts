// What the desk cards show, gathered in one place: the account's balances,
// open orders, borrow positions and pool shares, valued in
// the unit the user chose. The chain is read through the same stores and
// valuation code the rest of the app uses (ChainStore, MarketsStore stats,
// next/dashboard/balanceCalculations); this file only collects and shapes it.
import {List} from "immutable";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../../next/hooks/useChainStoreTick";
import {useReduxState} from "../../../next/hooks/useReduxState";
import {useMarketStatsSubscription} from "../../../next/hooks/useMarketStatsSubscription";
import {selectSettingsState} from "../../../store/slices/settingsSlice";
import {selectMarkets} from "../../../store/slices/marketsSlice";
import {convertAssetValue} from "../../../next/dashboard/balanceCalculations";
import {useMyHoldings} from "../../Poolmart/useMyHoldings";
import {
    AttentionItem,
    HoldingRow,
    OrderSummary,
    PositionInput,
    PositionRisk,
    SettlementSummary,
    attentionItems,
    expiryMs,
    holdingRows,
    orderSummary,
    positionInputFromChain,
    positionRisk,
    settlementSummary
} from "../../../lib/common/desk";

export interface DeskPosition {
    input: PositionInput;
    risk: PositionRisk;
    debtSymbol: string;
    collateralSymbol: string;
    /** human amounts */
    debt: number;
    collateral: number;
}

export interface DeskPool {
    id: string;
    symbolA: string;
    symbolB: string;
    /** the pool share of the account, human units */
    amountA: number;
    amountB: number;
    fraction: number;
    /** in the unit, human; null without a price for asset A */
    value: number | null;
}

/** A force-settlement request of the account: a smart coin handed in, waiting for its settlement date. */
export interface DeskSettlement {
    id: string;
    assetId: string;
    symbol: string;
    precision: number;
    /** human amount */
    amount: number;
    /** in the unit, human; null without a price */
    value: number | null;
    /** when it settles (ms); null when the chain gives no readable date */
    dateMs: number | null;
}

export interface DeskData {
    loading: boolean;
    accountId: string | null;
    unit: {id: string; symbol: string; precision: number} | null;
    /** wallet + pools + orders + settlements + collateral - debt, in the unit (human) */
    total: number;
    parts: {
        wallet: number;
        pools: number;
        orders: number;
        /** smart coins handed in to be settled: they left the wallet and are not paid out yet */
        settlements: number;
        collateral: number;
        debt: number;
    };
    holdings: HoldingRow[];
    unpriced: number;
    /** an open order, a collateral or a debt has no price yet: the total is
     * not the whole picture (a missing debt would read as a bigger total) */
    incomplete: boolean;
    orders: OrderSummary & {value: number | null};
    settlements: SettlementSummary & {
        value: number | null;
        items: DeskSettlement[];
    };
    positions: DeskPosition[];
    pools: DeskPool[];
    attention: AttentionItem[];
}

const EMPTY: DeskData = {
    loading: true,
    accountId: null,
    unit: null,
    total: 0,
    parts: {
        wallet: 0,
        pools: 0,
        orders: 0,
        settlements: 0,
        collateral: 0,
        debt: 0
    },
    holdings: [],
    unpriced: 0,
    incomplete: false,
    orders: {count: 0, nextExpiryMs: null, expiringSoon: 0, value: null},
    settlements: {count: 0, nextMs: null, value: null, items: []},
    positions: [],
    pools: [],
    attention: []
};

const isMap = (x: any) => x && typeof x.get === "function";

/** The age of the head block in seconds, or null. */
function headBlockAge(now: number): number | null {
    const dynamic: any = (ChainStore as any).getObject("2.1.0");
    if (!isMap(dynamic)) return null;
    const stamp: string = dynamic.get("time") || "";
    if (!stamp) return null;
    const made = Date.parse(stamp + (/Z$/.test(stamp) ? "" : "Z"));
    return Number.isFinite(made) ? Math.max(0, (now - made) / 1000) : null;
}

export function useDeskData(
    accountName: string | null,
    options: {light?: boolean} = {}
): DeskData {
    // `light`: the totals only (a row of the accounts card): no pool lookup
    const light = !!options.light;
    useChainStoreTick();
    const settings = useReduxState<any>(selectSettingsState);
    const marketsState = useReduxState<any>(selectMarkets);
    const allMarketStats = marketsState.allMarketStats;

    const unitId: string = settings.settings.get("unit") || "1.3.0";
    const toAsset: any = (ChainStore as any).getAsset(unitId);
    const coreAsset: any = (ChainStore as any).getAsset("1.3.0");
    const account: any = accountName
        ? (ChainStore as any).getAccount(accountName)
        : null;
    const accountId: string | null = isMap(account) ? account.get("id") : null;

    const mine = useMyHoldings(light ? null : accountName);

    // ---- raw material from the account object
    const balanceUnits: {[assetId: string]: number} = {};
    // balance objects arrive one by one after the account: until they are all
    // there the lists are not empty, they are not complete yet
    let pendingBalances = 0;
    if (isMap(account) && account.get("balances")) {
        account.get("balances").forEach((balanceId: string) => {
            const balance: any = (ChainStore as any).getObject(balanceId);
            if (!isMap(balance) || !balance.get("balance")) {
                if (!isMap(balance)) pendingBalances++;
                return;
            }
            balanceUnits[balance.get("asset_type")] = parseInt(
                balance.get("balance"),
                10
            );
        });
    }

    const orderObjects: any[] = [];
    if (isMap(account) && account.get("orders")) {
        account.get("orders").forEach((orderId: string) => {
            const order: any = (ChainStore as any).getObject(orderId);
            if (isMap(order)) orderObjects.push(order);
        });
    }
    const orderUnits: {[assetId: string]: number} = {};
    orderObjects.forEach(order => {
        const assetId = order.getIn(["sell_price", "base", "asset_id"]);
        orderUnits[assetId] =
            (orderUnits[assetId] || 0) + parseInt(order.get("for_sale"), 10);
    });

    // force-settlement requests (the Portfolio lists them under its open orders)
    const settleObjects: any[] = [];
    if (isMap(account) && account.get("settle_orders")) {
        account.get("settle_orders").forEach((settleId: string) => {
            const settle: any = (ChainStore as any).getObject(settleId);
            if (isMap(settle) && isMap(settle.get("balance"))) {
                settleObjects.push(settle);
            }
        });
    }

    const callObjects: any[] = [];
    if (isMap(account) && account.get("call_orders")) {
        account.get("call_orders").forEach((callId: string) => {
            const call: any = (ChainStore as any).getObject(callId);
            if (isMap(call)) callObjects.push(call);
        });
    }

    // ---- the assets whose prices are needed
    const assetIds: {[id: string]: true} = {};
    Object.keys(balanceUnits).forEach(id => (assetIds[id] = true));
    Object.keys(orderUnits).forEach(id => (assetIds[id] = true));
    settleObjects.forEach(settle => {
        assetIds[settle.getIn(["balance", "asset_id"])] = true;
    });
    callObjects.forEach(call => {
        assetIds[call.getIn(["call_price", "base", "asset_id"])] = true;
        assetIds[call.getIn(["call_price", "quote", "asset_id"])] = true;
    });
    mine.pools.forEach(pool => {
        if (pool.asset_a_obj) assetIds[pool.asset_a_obj.get("id")] = true;
    });
    const assetsById: {[id: string]: any} = {};
    Object.keys(assetIds).forEach(id => {
        const asset = (ChainStore as any).getAsset(id);
        if (isMap(asset)) assetsById[id] = asset;
    });

    useMarketStatsSubscription(
        List(Object.values(assetsById)),
        toAsset,
        coreAsset,
        allMarketStats
    );

    if (!accountId || !toAsset || !coreAsset || !isMap(toAsset)) {
        return {...EMPTY, loading: !!accountName};
    }

    const unitAssetId: string = toAsset.get("id");
    const unitPrecision: number = toAsset.get("precision");
    const unitScale = Math.pow(10, unitPrecision);

    /** `units` of `assetId` in the unit, human; null without a price. */
    const valueOf = (assetId: string, units: number): number | null => {
        if (assetId === unitAssetId) return units / unitScale;
        const from = assetsById[assetId];
        if (!from) return null;
        const converted = convertAssetValue(
            units,
            from,
            toAsset,
            allMarketStats,
            coreAsset
        );
        if (converted === null || !Number.isFinite(converted)) return null;
        return converted / unitScale;
    };
    const sum = (values: Array<number | null>) =>
        values.reduce<number>((s, v) => s + (v === null ? 0 : v), 0);

    // ---- pools: the share tokens are priced through the pool
    const poolShareIds = new Set<string>();
    const pools: DeskPool[] = [];
    mine.pools.forEach(pool => {
        const holding = mine.holdings[pool.id];
        if (!holding || !pool.asset_a_obj || !pool.asset_b_obj) return;
        poolShareIds.add(pool.share_asset);
        const idA: string = pool.asset_a_obj.get("id");
        const precisionA: number = pool.asset_a_obj.get("precision");
        // both sides of a constant-product pool are worth the same
        const valueA = valueOf(
            idA,
            Math.round(2 * holding.amountA * Math.pow(10, precisionA))
        );
        pools.push({
            id: pool.id,
            symbolA: pool.asset_a_obj.get("symbol"),
            symbolB: pool.asset_b_obj.get("symbol"),
            amountA: holding.amountA,
            amountB: holding.amountB,
            fraction: holding.fraction,
            value: valueA
        });
    });

    // ---- holdings
    const holdingInputs = Object.keys(balanceUnits)
        .filter(id => !poolShareIds.has(id) && assetsById[id])
        .map(id => ({
            assetId: id,
            symbol: assetsById[id].get("symbol") as string,
            precision: assetsById[id].get("precision") as number,
            units: balanceUnits[id],
            value: valueOf(id, balanceUnits[id])
        }));
    const {rows: holdings, unpriced} = holdingRows(holdingInputs);

    // ---- orders
    const ordersValue = Object.keys(orderUnits).map(id =>
        valueOf(id, orderUnits[id])
    );
    const orderInfo = orderSummary(
        orderObjects.map(o => ({
            id: o.get("id"),
            expiration: o.get("expiration") || ""
        })),
        Date.now()
    );

    // ---- borrow positions
    let collateralValue = 0;
    let debtValue = 0;
    let incomplete = Object.keys(orderUnits).some(
        id => valueOf(id, orderUnits[id]) === null
    );
    const positions: DeskPosition[] = [];
    callObjects.forEach(call => {
        const collateralId: string = call.getIn([
            "call_price",
            "base",
            "asset_id"
        ]);
        const debtId: string = call.getIn(["call_price", "quote", "asset_id"]);
        const collateralAsset = assetsById[collateralId];
        const debtAsset =
            assetsById[debtId] || (ChainStore as any).getAsset(debtId);
        if (!collateralAsset || !isMap(debtAsset)) return;
        const collateralUnits = parseInt(call.get("collateral"), 10);
        const debtUnits = parseInt(call.get("debt"), 10);
        const collateralWorth = valueOf(collateralId, collateralUnits);
        const debtWorth = valueOf(debtId, debtUnits);
        if (collateralWorth === null || debtWorth === null) incomplete = true;
        collateralValue += collateralWorth || 0;
        debtValue += debtWorth || 0;

        const input: PositionInput = positionInputFromChain(
            call,
            collateralAsset,
            debtAsset
        );
        positions.push({
            input,
            risk: positionRisk(input),
            debtSymbol: debtAsset.get("symbol"),
            collateralSymbol: collateralAsset.get("symbol"),
            debt: debtUnits / Math.pow(10, input.debtPrecision),
            collateral:
                collateralUnits / Math.pow(10, input.collateralPrecision)
        });
    });

    // ---- settlements: what was handed in is worth what it is, until it is paid out
    const settlementItems: DeskSettlement[] = [];
    settleObjects.forEach(settle => {
        const assetId: string = settle.getIn(["balance", "asset_id"]);
        const asset =
            assetsById[assetId] || (ChainStore as any).getAsset(assetId);
        if (!isMap(asset)) return;
        const units = parseInt(settle.getIn(["balance", "amount"]), 10);
        const value = valueOf(assetId, units);
        if (value === null) incomplete = true;
        settlementItems.push({
            id: settle.get("id"),
            assetId,
            symbol: asset.get("symbol"),
            precision: asset.get("precision"),
            amount: units / Math.pow(10, asset.get("precision")),
            value,
            dateMs: expiryMs(settle.get("settlement_date") || "")
        });
    });
    // the soonest first, the ones without a date last
    settlementItems.sort(
        (a, b) =>
            (a.dateMs === null ? Infinity : a.dateMs) -
            (b.dateMs === null ? Infinity : b.dateMs)
    );
    const settlementInfo = settlementSummary(
        settleObjects.map(settle => ({
            id: settle.get("id"),
            settlementDate: settle.get("settlement_date") || ""
        }))
    );

    // ---- totals
    const parts = {
        wallet: sum(holdings.map(h => h.value)),
        pools: sum(pools.map(p => p.value)),
        orders: sum(ordersValue),
        settlements: sum(settlementItems.map(item => item.value)),
        collateral: collateralValue,
        debt: debtValue
    };
    const total =
        parts.wallet +
        parts.pools +
        parts.orders +
        parts.settlements +
        parts.collateral -
        parts.debt;

    const attention = attentionItems({
        risks: positions.map(p => ({
            ...p.risk,
            symbol: p.debtSymbol
        })),
        expiringOrders: orderInfo.expiringSoon,
        blockAgeSeconds: headBlockAge(Date.now())
    });

    return {
        loading: pendingBalances > 0,
        accountId,
        unit: {
            id: unitAssetId,
            symbol: toAsset.get("symbol"),
            precision: unitPrecision
        },
        total,
        parts,
        holdings,
        unpriced,
        incomplete,
        orders: {
            ...orderInfo,
            value: orderInfo.count ? sum(ordersValue) : null
        },
        settlements: {
            ...settlementInfo,
            value: settlementItems.length ? parts.settlements : null,
            items: settlementItems
        },
        positions,
        pools,
        attention
    };
}
