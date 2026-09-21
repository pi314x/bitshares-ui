// Verifies the ported balance/collateral/debt/open-orders math in
// balanceCalculations.ts against real BitShares mainnet data captured
// from wss://node.xbts.io/ws (account "alt-org", 1.2.1813080 - picked
// because it has real limit orders, call orders, and balances to
// exercise every aggregation path). The fixture is a static snapshot
// (app/__tests__/next/dashboard/__fixtures__/alt-org-account.json), so
// this test needs no network access and is safe to run in CI; the
// "-expected.json" fixture holds values computed independently, directly
// from the raw JSON-RPC response, not through the code under test.
import {List, Map as ImmutableMap, fromJS} from "immutable";
import {
    aggregateOpenOrders,
    aggregateCollateralAndDebt,
    resolveAccountBalanceIds,
    convertAssetValue,
    computeTotalValue,
    buildTotalsTooltip,
    starSort
} from "next/dashboard/balanceCalculations";

import fixture from "./__fixtures__/alt-org-account.json";
import expected from "./__fixtures__/alt-org-expected.json";

const objects: {[id: string]: any} = {};
Object.keys(fixture.objects).forEach(id => {
    objects[id] = fromJS((fixture.objects as any)[id]);
});
const getObject = (id: string) => objects[id];

describe("balanceCalculations (verified against live node.xbts.io data)", () => {
    it("aggregates open orders exactly like DashboardList.jsx's loop", () => {
        const orderIds = List(fixture.orderIds);
        const result = aggregateOpenOrders(orderIds, getObject);
        expect(result).toEqual(expected.openOrders);
    });

    it("aggregates collateral and debt exactly like DashboardList.jsx's loop", () => {
        const callOrderIds = List(fixture.callOrderIds);
        const {collateral, debt} = aggregateCollateralAndDebt(
            callOrderIds,
            getObject
        );
        expect(collateral).toEqual(expected.collateral);
        expect(debt).toEqual(expected.debt);
    });

    it("resolves only balance ids with an actual balance, like the legacy filter", () => {
        let balances = ImmutableMap<string, string>();
        fixture.balanceEntries.forEach(entry => {
            balances = balances.set(entry.asset_type, entry.balanceId);
        });
        const resolved = resolveAccountBalanceIds(balances, getObject);
        expect(resolved.toArray().sort()).toEqual(
            [...expected.resolvedBalances].sort()
        );
    });

    it("returns 0 from convertAssetValue when either asset is missing", () => {
        expect(
            convertAssetValue(100, undefined, objects["1.3.0"], ImmutableMap(), objects["1.3.0"])
        ).toBe(0);
        expect(
            convertAssetValue(100, objects["1.3.0"], undefined, ImmutableMap(), objects["1.3.0"])
        ).toBe(0);
    });

    it("convertAssetValue returns the amount unconverted when from === to", () => {
        const core = objects["1.3.0"];
        const value = convertAssetValue(12345, core, core, ImmutableMap(), core);
        expect(value).toBe(12345);
    });

    it("computeTotalValue sums balances directly when balance asset === toAsset", () => {
        const core = objects["1.3.0"];
        const {totalValue, assetValues} = computeTotalValue({
            balances: [{asset_id: core.get("id"), amount: 5000}],
            collateral: {},
            debt: {},
            openOrders: {},
            assetsById: {[core.get("id")]: core},
            toAsset: core,
            coreAsset: core,
            allMarketStats: ImmutableMap()
        });
        expect(totalValue).toBe(5000);
        expect(assetValues[core.get("id")]).toBe(5000);
    });

    it("computeTotalValue ignores assets with no market data instead of throwing", () => {
        // No market stats loaded for this pair -> convertAssetValue's price
        // lookup returns null -> contributes 0, same as the legacy JS's
        // implicit null-coercion through `+=`.
        const core = objects["1.3.0"];
        const otherAsset = objects["1.3.2512"];
        const {totalValue} = computeTotalValue({
            balances: [],
            collateral: expected.collateral,
            debt: {},
            openOrders: {},
            assetsById: {[otherAsset.get("id")]: otherAsset},
            toAsset: core,
            coreAsset: core,
            allMarketStats: ImmutableMap()
        });
        expect(totalValue).toBe(0);
    });

    it("computeTotalValue subtracts debt from the total", () => {
        const asset = objects["1.3.0"];
        const {totalValue, assetValues} = computeTotalValue({
            balances: [],
            collateral: {},
            debt: {[asset.get("id")]: 100},
            openOrders: {},
            assetsById: {[asset.get("id")]: asset},
            toAsset: asset,
            coreAsset: asset,
            allMarketStats: ImmutableMap()
        });
        // fromAsset === toAsset, but debt goes through convertAssetValue
        // (not the balances shortcut), so price is looked up: same asset
        // means convertValue short-circuits price===1 and returns the
        // amount itself, then it's subtracted.
        expect(totalValue).toBe(-100);
        expect(assetValues[asset.get("id")]).toBe(-100);
    });

    it("buildTotalsTooltip flags missing data and renders an HTML table", () => {
        const asset = objects["1.3.0"];
        const {html, missingData} = buildTotalsTooltip({
            assetValues: {[asset.get("id")]: 250000},
            assetsById: {[asset.get("id")]: asset},
            toAsset: asset,
            translateTotalEstimate: () => "Estimated value"
        });
        expect(missingData).toBe(false);
        expect(html).toContain("<table>");
        expect(html).toContain(asset.get("symbol"));
        expect(html).toContain("Estimated value");
    });

    it("puts a starred account before an unstarred one when inverse is set (DashboardList's own default)", () => {
        // DashboardList.jsx defaults dashboardSortInverse to true, so this
        // is the sort direction accounts actually render in.
        const a = fromJS({name: "zzz-account"});
        const b = fromJS({name: "aaa-account"});
        const starred = {has: (name: string) => name === "zzz-account"};
        expect(starSort(a, b, true, starred)).toBeLessThan(0);
    });

    it("keeps the starred/unstarred split intact regardless of the inverse flag", () => {
        const a = fromJS({name: "zzz-account"});
        const b = fromJS({name: "aaa-account"});
        const starred = {has: (name: string) => name === "zzz-account"};
        // Flipping `inverse` flips the sign, same as it flips plain
        // alphabetical comparisons below - starred vs. unstarred is still
        // decided first either way.
        expect(starSort(a, b, false, starred)).toBeGreaterThan(0);
    });

    it("falls back to alphabetical order when neither account is starred", () => {
        const a = fromJS({name: "bbb-account"});
        const b = fromJS({name: "aaa-account"});
        const notStarred = {has: () => false};
        expect(starSort(a, b, false, notStarred)).toBeLessThan(0);
        expect(starSort(a, b, true, notStarred)).toBeGreaterThan(0);
    });
});
