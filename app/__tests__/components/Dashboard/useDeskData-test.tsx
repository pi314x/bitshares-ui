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
jest.mock("../../../components/Poolmart/useMyHoldings", () => ({
    useMyHoldings: () => ({pools: [], holdings: {}})
}));

import {useDeskData} from "../../../components/Dashboard/Desk/useDeskData";

const asset = (id: string, symbol: string, precision: number) =>
    Immutable.fromJS({id, symbol, precision});

function Probe(props: {onData: (data: any) => void}) {
    props.onData(useDeskData("alice"));
    return null;
}
const read = () => {
    let data: any;
    render(<Probe onData={d => (data = d)} />);
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

    it("counts what was handed in as part of what the account is worth", () => {
        const without = read();
        expect(without.parts.settlements).toBe(0);
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
        expect(withOne.parts.settlements).toBe(500);
        expect(withOne.total).toBe(1500);
        expect(withOne.incomplete).toBe(false);
    });

    it("says the total is not the whole picture for a request with no price", () => {
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
        expect(data.parts.settlements).toBe(0);
        expect(data.incomplete).toBe(true);
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
