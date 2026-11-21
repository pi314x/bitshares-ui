// Regression: on a phone the account page rendered AccountOrders before the chain store had loaded the asset of a settle
// order (and sometimes the order object itself), and `getDataSource` called `base.getIn` on undefined
// ("TypeError: undefined is not an object (evaluating 'base.getIn')"), which took the whole page down.
// HelpContent uses webpack's `require.context`, which Jest does not have
jest.mock("../../../components/Utility/HelpContent", () => () => null);

import * as React from "react";
import {render} from "@testing-library/react";
import Immutable from "immutable";

const mockObjects: Record<string, any> = {};
const mockAssets: Record<string, any> = {};

jest.mock("bitsharesjs", () => {
    const actual = jest.requireActual("bitsharesjs");
    return {
        ...actual,
        ChainStore: {
            ...actual.ChainStore,
            getObject: (id: string) => mockObjects[id],
            getAsset: (id: string) => mockAssets[id],
            subscribe: () => undefined,
            unsubscribe: () => undefined
        },
        FetchChain: () => Promise.resolve()
    };
});

import AccountOrders from "../../../components/Account/AccountOrders";

const settleOrder = (id: string, assetId: string) =>
    Immutable.Map({
        id,
        balance: Immutable.Map({amount: "100", asset_id: assetId}),
        settlement_date: "2026-11-06T00:00:00"
    });

const account = (orders: string[], settle: string[]) =>
    Immutable.Map({
        id: "1.2.100",
        name: "tester",
        orders: Immutable.List(orders),
        settle_orders: Immutable.List(settle)
    });

// the cells of real rows (an empty table has one "No data" cell)
const dataCells = (container: HTMLElement) =>
    container.querySelectorAll("tbody td:not(.empty)").length;

describe("AccountOrders before the chain store has loaded what it shows", () => {
    beforeEach(() => {
        for (const k of Object.keys(mockObjects)) delete mockObjects[k];
        for (const k of Object.keys(mockAssets)) delete mockAssets[k];
        jest.spyOn(console, "error").mockImplementation(() => undefined);
    });
    afterEach(() => jest.restoreAllMocks());

    it("renders a settle order whose asset is not loaded yet, with no row for it", () => {
        mockObjects["1.4.1"] = settleOrder("1.4.1", "1.3.9");
        const {container} = render(
            <AccountOrders account={account([], ["1.4.1"])} />
        );
        expect(dataCells(container)).toBe(0);
    });

    it("renders a settle order whose own object is not loaded yet", () => {
        const {container} = render(
            <AccountOrders account={account([], ["1.4.2"])} />
        );
        expect(dataCells(container)).toBe(0);
    });

    it("renders a limit order whose own object is not loaded yet", () => {
        const {container} = render(
            <AccountOrders account={account(["1.7.5"], [])} />
        );
        expect(dataCells(container)).toBe(0);
    });
});
