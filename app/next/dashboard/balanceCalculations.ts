// Pure(ish) balance/collateral/debt/open-orders math ported from
// app/components/Dashboard/DashboardList.jsx and
// app/components/Utility/TotalBalanceValue.jsx (the "TotalValue" class's
// render-time aggregation). Every function here is a faithful,
// line-for-line port of the legacy logic - not a reinterpretation - and
// is unit-tested against real account data fetched from a live node (see
// app/__tests__/next/dashboard/balanceCalculations-test.ts), per
// AGENTS.md's rule to treat account-balance code as security-sensitive.
//
// Chain objects (accounts, orders, assets, balances) come back from
// bitsharesjs's ChainStore as untyped Immutable.Map instances - there is
// no upstream schema to type them against, so they're treated as `any`
// here exactly as the legacy JS does.
import {List, Map as ImmutableMap} from "immutable";
import utils from "common/utils";
import marketUtils from "common/market_utils";

type ChainObject = any;
type GetObject = (id: string) => ChainObject | undefined;

// ChainStore stores an account's `orders`/`call_orders` as an Immutable.Set
// and `balances` as an Immutable.Map (see bitsharesjs's
// ChainStore.fetchFullAccount) - both just need `.forEach`, so this
// structural type covers List/Set/Map alike without committing to one.
type IdCollection = {forEach(fn: (id: string) => void): void};

export type AssetAmounts = {[assetId: string]: number};

export interface AggregatedPositions {
    collateral: AssetAmounts;
    debt: AssetAmounts;
}

/** Ports DashboardList.jsx's `account.get("orders")` aggregation loop. */
export function aggregateOpenOrders(
    orderIds: IdCollection | undefined | null,
    getObject: GetObject
): AssetAmounts {
    const openOrders: AssetAmounts = {};
    if (!orderIds) return openOrders;
    orderIds.forEach(orderID => {
        const order = getObject(orderID);
        if (!order) return;
        const orderAsset = order.getIn(["sell_price", "base", "asset_id"]);
        openOrders[orderAsset] =
            (openOrders[orderAsset] || 0) + parseInt(order.get("for_sale"), 10);
    });
    return openOrders;
}

/** Ports DashboardList.jsx's `account.get("call_orders")` aggregation loop. */
export function aggregateCollateralAndDebt(
    callOrderIds: IdCollection | undefined | null,
    getObject: GetObject
): AggregatedPositions {
    const collateral: AssetAmounts = {};
    const debt: AssetAmounts = {};
    if (!callOrderIds) return {collateral, debt};
    callOrderIds.forEach(callID => {
        const position = getObject(callID);
        if (!position) return;
        const collateralAsset = position.getIn(["call_price", "base", "asset_id"]);
        collateral[collateralAsset] =
            (collateral[collateralAsset] || 0) +
            parseInt(position.get("collateral"), 10);
        const debtAsset = position.getIn(["call_price", "quote", "asset_id"]);
        debt[debtAsset] =
            (debt[debtAsset] || 0) + parseInt(position.get("debt"), 10);
    });
    return {collateral, debt};
}

/**
 * Ports DashboardList.jsx's `account.get("balances")` loop, which drops
 * any balance object that hasn't resolved yet or has no "balance" field.
 */
export function resolveAccountBalanceIds(
    balances: ImmutableMap<string, string> | undefined | null,
    getObject: GetObject
): List<string> {
    let result = List<string>();
    if (!balances) return result;
    balances.forEach(balanceId => {
        if (!balanceId) return;
        const balanceObj = getObject(balanceId);
        if (!balanceObj || !balanceObj.get("balance")) return;
        result = result.push(balanceId);
    });
    return result;
}

/**
 * Ports TotalValue's `_convertValue`. Returns `null` when no market price
 * is available for the pair (same as the underlying marketUtils.convertValue) -
 * callers must add/subtract it the same way the legacy JS did via native
 * `+`/`-` (null coerces to 0), which is why computeTotalValue below applies
 * `?? 0` rather than assuming a plain number.
 */
export function convertAssetValue(
    amount: number,
    fromAsset: ChainObject | undefined,
    toAsset: ChainObject | undefined,
    allMarketStats: ImmutableMap<string, any>,
    coreAsset: ChainObject
): number | null {
    if (!fromAsset || !toAsset) return 0;
    // toAsset is guaranteed truthy above, so marketUtils.convertValue's own
    // `if (!toAsset) return;` branch can't fire here - the `undefined` in
    // its inferred return type is unreachable at this call site, hence the
    // cast rather than widening this function's own return type to match.
    return marketUtils.convertValue(
        amount,
        toAsset,
        fromAsset,
        allMarketStats,
        coreAsset
    ) as number | null;
}

export interface BalanceAmount {
    asset_id: string;
    amount: number;
}

export interface TotalValueResult {
    totalValue: number;
    assetValues: AssetAmounts;
}

/** Ports TotalValue.render()'s collateral/openOrders/debt/balances loop. */
export function computeTotalValue(params: {
    balances: BalanceAmount[];
    collateral: AssetAmounts;
    debt: AssetAmounts;
    openOrders: AssetAmounts;
    assetsById: {[assetId: string]: ChainObject};
    toAsset: ChainObject;
    coreAsset: ChainObject;
    allMarketStats: ImmutableMap<string, any>;
}): TotalValueResult {
    const {
        balances,
        collateral,
        debt,
        openOrders,
        assetsById,
        toAsset,
        coreAsset,
        allMarketStats
    } = params;

    let totalValue = 0;
    const assetValues: AssetAmounts = {};

    function addValue(assetId: string, value: number) {
        assetValues[assetId] = (assetValues[assetId] || 0) + value;
    }

    // convertAssetValue returns null when no market price is available for
    // a pair; `?? 0` replicates the native `+`/`-` coercion the legacy JS
    // relied on implicitly (see convertAssetValue's docstring).
    for (const asset in collateral) {
        const fromAsset = assetsById[asset];
        if (!fromAsset) continue;
        const value =
            convertAssetValue(
                collateral[asset],
                fromAsset,
                toAsset,
                allMarketStats,
                coreAsset
            ) ?? 0;
        totalValue += value;
        addValue(fromAsset.get("id"), value);
    }

    for (const asset in openOrders) {
        const fromAsset = assetsById[asset];
        if (!fromAsset) continue;
        const value =
            convertAssetValue(
                openOrders[asset],
                fromAsset,
                toAsset,
                allMarketStats,
                coreAsset
            ) ?? 0;
        totalValue += value;
        addValue(fromAsset.get("id"), value);
    }

    for (const asset in debt) {
        const fromAsset = assetsById[asset];
        if (!fromAsset) continue;
        const value =
            convertAssetValue(
                debt[asset],
                fromAsset,
                toAsset,
                allMarketStats,
                coreAsset
            ) ?? 0;
        totalValue -= value;
        addValue(fromAsset.get("id"), -value);
    }

    balances.forEach(balance => {
        const fromAsset = assetsById[balance.asset_id];
        if (!fromAsset) return;
        const eqValue =
            fromAsset !== toAsset
                ? convertAssetValue(
                      balance.amount,
                      fromAsset,
                      toAsset,
                      allMarketStats,
                      coreAsset
                  ) ?? 0
                : balance.amount;
        totalValue += eqValue;
        addValue(fromAsset.get("id"), eqValue);
    });

    return {totalValue, assetValues};
}

export interface TotalsTooltip {
    hiPrec: boolean;
    missingData: boolean;
    html: string;
}

/**
 * Ports TotalValue.render()'s hiPrec-detection and totalsTip HTML string
 * building - only reachable through the `inHeader` prop, which no current
 * call site sets, but kept faithful since it's part of the component's
 * documented behavior.
 */
export function buildTotalsTooltip(params: {
    assetValues: AssetAmounts;
    assetsById: {[assetId: string]: any};
    toAsset: any;
    translateTotalEstimate: () => string;
}): TotalsTooltip {
    const {assetValues, assetsById, toAsset, translateTotalEstimate} = params;

    let hiPrec = false;
    for (const asset in assetValues) {
        if (assetsById[asset] && assetValues[asset]) {
            if (Math.abs(utils.get_asset_amount(assetValues[asset], toAsset)) < 100) {
                hiPrec = true;
                break;
            }
        }
    }

    const noDataSymbol = "**";
    const minValue = 1e-12;
    let missingData = false;
    let html = "<table><tbody>";

    for (const asset in assetValues) {
        if (!assetsById[asset] || !assetValues[asset]) continue;
        const symbol = assetsById[asset].get("symbol");
        const amountValue = utils.get_asset_amount(assetValues[asset], toAsset);
        let amount: string;
        if (amountValue) {
            if (amountValue < minValue && amountValue > -minValue) {
                amount = noDataSymbol;
                missingData = true;
            } else if (hiPrec) {
                if (amountValue >= 0 && amountValue < 0.01) amount = "<0.01";
                else if (amountValue < 0 && amountValue > -0.01) amount = "-0.01<";
                else amount = utils.format_number(amountValue, 2);
            } else {
                if (amountValue >= 0 && amountValue < 1) amount = "<1";
                else if (amountValue < 0 && amountValue > -0.01) amount = "-1<";
                else amount = utils.format_number(amountValue, 0);
            }
        } else {
            amount = noDataSymbol;
            missingData = true;
        }
        html += `<tr><td>${symbol}:&nbsp;</td><td style="text-align: right;">${amount} ${toAsset.get(
            "symbol"
        )}</td></tr>`;
    }

    if (missingData) {
        html += `<tr><td>&nbsp;</td><td style="text-align: right;">${noDataSymbol} no data</td></tr>`;
    }
    html += '<tr><td colSpan="2">&nbsp;</td></tr>';
    html += `<tr><td colSpan="2">${translateTotalEstimate()}</td></tr>`;
    html += "</tbody></table>";

    return {hiPrec, missingData, html};
}

/** Ports DashboardList.jsx's `starSort`. */
export function starSort(
    a: ChainObject,
    b: ChainObject,
    inverse: boolean,
    starredAccounts: {has(name: string): boolean}
): number {
    const aName = a.get("name");
    const bName = b.get("name");
    const aStarred = starredAccounts.has(aName);
    const bStarred = starredAccounts.has(bName);

    if (aStarred && !bStarred) {
        return inverse ? -1 : 1;
    } else if (bStarred && !aStarred) {
        return inverse ? 1 : -1;
    } else {
        if (aName > bName) {
            return inverse ? 1 : -1;
        } else if (aName < bName) {
            return inverse ? -1 : 1;
        } else {
            return utils.sortText(aName, bName, !inverse);
        }
    }
}
