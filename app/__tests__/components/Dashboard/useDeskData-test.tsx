// What the dashboard reads of an account's force-settlement requests: they hold a smart coin that left
// the wallet, so they are counted in what the account is worth, priced in the unit, listed by date, and
// a request with no price says the total is not the whole picture.
import * as React from "react";
import {render} from "@testing-library/react";
import Immutable from "immutable";

let mockObjects: Record<string, any> = {};
let mockAccount: any;
const mockAssets: Record<string, any> = {};

jest.mock("bitsharesjs", () => ({
    ...jest.requireActual("bitsharesjs"),
    ChainStore: {
        getAccount: () => mockAccount,
        getObject: (id: string) => mockObjects[id],
        getAsset: (id: string) => mockAssets[id]
    }
}));

jest.mock("../../../next/hooks/useChainStoreTick", () => ({
    useChainStoreTick: () => undefined
}));
jest.mock("../../../next/hooks/useReduxState", () => {
    const {Map} = jest.requireActual("immutable");
    return {
        useReduxState: () => ({
            settings: Map({unit: "1.3.0"}),
            allMarketStats: Map()
        })
    };
});
jest.mock("../../../next/hooks/useMarketStatsSubscription", () => ({
    useMarketStatsSubscription: () => undefined
}));
// one USD is worth 200 BTS; an asset with no price in the table is worth nothing known
const mockPrices: Record<string, number> = {"1.3.0": 1, "1.3.5": 200};
jest.mock("../../../next/dashboard/balanceCalculations", () => ({
    convertAssetValue: (units: number, from: any, to: any) => {
        const fromId = from.get("id");
        if (!(fromId in mockPrices)) return null;
        const human = units / Math.pow(10, from.get("precision"));
        return human * mockPrices[fromId] * Math.pow(10, to.get("precision"));
    }
}));
// the pools the account is in (none unless a test says)
let mockMine: any = {pools: [], holdings: {}};
jest.mock("../../../components/Poolmart/useMyHoldings", () => ({
    useMyHoldings: () => mockMine
}));

import {useDeskData} from "../../../components/Dashboard/Desk/useDeskData";

const asset = (id: string, symbol: string, precision: number) =>
    Immutable.fromJS({id, symbol, precision});

function Probe(props: {onData: (data: any) => void; options?: any}) {
    props.onData(useDeskData("alice", props.options));
    return null;
}
const read = (options?: any) => {
    let data: any;
    render(<Probe onData={d => (data = d)} options={options} />);
    return data;
};
const settle = (id: string, assetId: string, amount: string, date: string) =>
    Immutable.fromJS({
        id,
        owner: "1.2.10",
        balance: {amount, asset_id: assetId},
        settlement_date: date
    });

beforeEach(() => {
    mockMine = {pools: [], holdings: {}};
    mockAssets["1.3.0"] = asset("1.3.0", "BTS", 5);
    mockAssets["1.3.5"] = asset("1.3.5", "USD", 4);
    mockAssets["1.3.9"] = asset("1.3.9", "NOPRICE", 2);
    mockObjects = {};
    mockAccount = Immutable.fromJS({
        id: "1.2.10",
        balances: ["2.5.1"],
        orders: [],
        call_orders: [],
        settle_orders: []
    });
    mockObjects["2.5.1"] = Immutable.fromJS({
        id: "2.5.1",
        asset_type: "1.3.0",
        balance: "100000000"
    });
});

describe("useDeskData: settlements", () => {
    it("lists the requests soonest first, in the asset and in the unit", () => {
        mockAccount = mockAccount.set(
            "settle_orders",
            Immutable.fromJS(["1.4.1", "1.4.2"])
        );
        mockObjects["1.4.1"] = settle(
            "1.4.1",
            "1.3.5",
            "25000",
            "2026-10-30T08:00:00"
        );
        mockObjects["1.4.2"] = settle(
            "1.4.2",
            "1.3.5",
            "10000",
            "2026-10-28T20:00:00"
        );
        const data = read();
        expect(data.settlements.count).toBe(2);
        expect(data.settlements.items.map((i: any) => i.id)).toEqual([
            "1.4.2",
            "1.4.1"
        ]);
        const first = data.settlements.items[0];
        expect(first).toMatchObject({symbol: "USD", amount: 1, value: 200});
        expect(first.dateMs).toBe(Date.UTC(2026, 9, 28, 20, 0, 0));
        expect(data.settlements.nextMs).toBe(Date.UTC(2026, 9, 28, 20, 0, 0));
        expect(data.settlements.value).toBe(700);
    });

    it("does not count what was handed in in the total value (it is listed, and valued for the list)", () => {
        const without = read();
        expect((without.parts as any).settlements).toBeUndefined();
        expect(without.settlements.value).toBeNull();
        // 1,000 BTS in the wallet; 2.5 USD (= 500 BTS) are waiting to be settled
        mockAccount = mockAccount.set(
            "settle_orders",
            Immutable.fromJS(["1.4.1"])
        );
        mockObjects["1.4.1"] = settle(
            "1.4.1",
            "1.3.5",
            "25000",
            "2026-10-30T08:00:00"
        );
        const withOne = read();
        expect(withOne.parts.wallet).toBe(1000);
        // (the request is worth 500 BTS in the list, and is not in what the account is worth)
        expect(withOne.settlements.value).toBe(500);
        expect((withOne.parts as any).settlements).toBeUndefined();
        expect(withOne.total).toBe(1000);
        expect(withOne.incomplete).toBe(false);
    });

    it("does not call the total incomplete for a request with no price: it is not in the total", () => {
        mockAccount = mockAccount.set(
            "settle_orders",
            Immutable.fromJS(["1.4.1"])
        );
        mockObjects["1.4.1"] = settle(
            "1.4.1",
            "1.3.9",
            "500",
            "2026-10-30T08:00:00"
        );
        const data = read();
        expect(data.settlements.count).toBe(1);
        expect(data.settlements.items[0].value).toBeNull();
        expect(data.settlements.value).toBe(0);
        expect(data.incomplete).toBe(false);
    });

    it("skips a request the chain store has not loaded yet, and keeps one without a date", () => {
        mockAccount = mockAccount.set(
            "settle_orders",
            Immutable.fromJS(["1.4.1", "1.4.2", "1.4.3"])
        );
        mockObjects["1.4.1"] = undefined;
        mockObjects["1.4.2"] = settle("1.4.2", "1.3.5", "10000", "");
        mockObjects["1.4.3"] = settle(
            "1.4.3",
            "1.3.5",
            "10000",
            "2026-10-28T20:00:00"
        );
        const data = read();
        expect(data.settlements.items.map((i: any) => i.id)).toEqual([
            "1.4.3",
            "1.4.2"
        ]);
        expect(data.settlements.items[1].dateMs).toBeNull();
        expect(data.settlements.nextMs).toBe(Date.UTC(2026, 9, 28, 20, 0, 0));
    });
});

describe("useDeskData: the shares of pools in the wallet", () => {
    it("lists a pool share among the holdings, valued as the account's part of the pool, and counts it only under Pools", () => {
        mockAssets["1.3.7"] = asset("1.3.7", "LPSHARE", 5);
        mockAccount = mockAccount.set(
            "balances",
            Immutable.fromJS(["2.5.1", "2.5.2"])
        );
        mockObjects["2.5.2"] = Immutable.fromJS({
            id: "2.5.2",
            asset_type: "1.3.7",
            balance: "134"
        });
        // a pool of BTS and USD: the account's part is 10 BTS and 0.05 USD, worth 2 x 10 = 20 BTS
        mockMine = {
            pools: [
                {
                    id: "1.19.9",
                    share_asset: "1.3.7",
                    asset_a_obj: asset("1.3.0", "BTS", 5),
                    asset_b_obj: asset("1.3.5", "USD", 4)
                }
            ],
            holdings: {"1.19.9": {fraction: 0.1, amountA: 10, amountB: 0.05}}
        };
        const data = read();
        const share = data.holdings.find((h: any) => h.symbol === "LPSHARE");
        expect(share).toBeTruthy();
        expect(share.pool).toBe(true);
        expect(share.value).toBe(20);
        expect(share.share).toBeNull();
        // the wallet is BTS alone (1,000 BTS), the pool's 20 is the Pools part, once
        expect(data.parts.wallet).toBe(1000);
        expect(data.parts.pools).toBe(20);
        expect(data.total).toBe(1020);
        expect(data.unpriced).toBe(0);
    });
});

describe("useDeskData: tokens whose asset is not loaded yet", () => {
    it("counts them, so that the card can say they are coming, and lists them when the asset is there", () => {
        mockAccount = mockAccount.set(
            "balances",
            Immutable.fromJS(["2.5.1", "2.5.3", "2.5.4"])
        );
        mockObjects["2.5.3"] = Immutable.fromJS({
            id: "2.5.3",
            asset_type: "1.3.40",
            balance: "5"
        });
        mockObjects["2.5.4"] = Immutable.fromJS({
            id: "2.5.4",
            asset_type: "1.3.41",
            // the node sends an empty balance as the number 0 (falsy), not as "0"
            balance: 0
        });
        const before = read();
        // the empty balance is not a token held; the other has no asset yet
        expect(before.assetsLoading).toBe(1);
        // the empty balance is counted, and its asset is not read unless asked for
        expect(before.emptied).toEqual([]);
        expect(before.emptiedCount).toBe(1);
        expect(before.holdings.map((h: any) => h.symbol)).toEqual(["BTS"]);
        mockAssets["1.3.40"] = asset("1.3.40", "LATE", 2);
        const after = read();
        expect(after.assetsLoading).toBe(0);
        expect(after.holdings.map((h: any) => h.symbol).sort()).toEqual([
            "BTS",
            "LATE"
        ]);
        // asked for, the balance with nothing in it is listed apart once its asset is there
        const asked = read({emptied: true});
        expect(asked.emptied).toEqual([]);
        expect(asked.assetsLoading).toBe(1);
        mockAssets["1.3.41"] = asset("1.3.41", "EMPTIED", 2);
        const last = read({emptied: true});
        expect(last.assetsLoading).toBe(0);
        expect(last.emptied.map((h: any) => h.symbol)).toEqual(["EMPTIED"]);
        expect(last.emptied[0].value).toBe(0);
        expect(last.holdings.map((h: any) => h.symbol)).not.toContain(
            "EMPTIED"
        );
        // LATE has no price; the empty balance adds nothing to that count
        expect(last.unpriced).toBe(1);
    });
});
