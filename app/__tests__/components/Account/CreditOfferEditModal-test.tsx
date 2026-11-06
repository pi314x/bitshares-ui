// Regression: `initModal` (the Edit button of a credit offer) read the precision of the offer's asset and of every collateral
// asset straight from the chain store (`ChainStore.getAsset(id).get("precision")`), which is undefined until the asset has
// loaded - a TypeError on a phone's cold start. It now waits for the assets the store has not loaded yet.
// HelpContent uses webpack's `require.context`, which Jest does not have
jest.mock("../../../components/Utility/HelpContent", () => () => null);

import * as React from "react";
import {render, act} from "@testing-library/react";
import Immutable from "immutable";

const mockAssets: Record<string, any> = {};
let mockFetches: Array<{ids: string[]; done: () => void}> = [];

jest.mock("bitsharesjs", () => {
    const actual = jest.requireActual("bitsharesjs");
    return {
        ...actual,
        ChainStore: {
            ...actual.ChainStore,
            getObject: () => undefined,
            getAccount: () => undefined,
            getAsset: (id: string) => mockAssets[id],
            subscribe: () => undefined,
            unsubscribe: () => undefined
        },
        FetchChain: (_name: string, ids: string[]) =>
            new Promise(resolve =>
                mockFetches.push({ids, done: () => resolve(undefined)})
            )
    };
});
jest.mock("../../../components/Utility/AmountSelectorStyleGuide", () => () =>
    null
);
jest.mock("../../../components/Utility/FeeAssetSelector", () => () => null);
jest.mock("../../../components/Utility/BalanceComponent", () => () => null);
jest.mock("../../../components/Utility/AssetSelector", () => () => null);
jest.mock("../../../components/Account/AccountSelector", () => () => null);
jest.mock("../../../components/Utility/AccountName", () => () => null);

import EditModal, {
    EditModalHandle
} from "../../../components/Account/CreditOffer/EditModal";

const asset = (id: string, precision: number) =>
    Immutable.Map({id, precision, symbol: id});

const offer = {
    id: "1.21.1",
    owner_account: "1.2.100",
    asset_type: "1.3.7",
    current_balance: "100000",
    total_balance: "100000",
    fee_rate: 10000,
    max_duration_seconds: 3600,
    auto_disable_time: "2027-01-01T00:00:00",
    min_deal_amount: "10",
    acceptable_collateral: [
        [
            "1.3.8",
            {
                base: {asset_id: "1.3.7", amount: 1},
                quote: {asset_id: "1.3.8", amount: 2}
            }
        ]
    ],
    acceptable_borrowers: []
};

describe("the credit offer edit dialog before the chain store has loaded the offer's assets", () => {
    let handle: EditModalHandle | null = null;
    beforeEach(() => {
        for (const k of Object.keys(mockAssets)) delete mockAssets[k];
        mockFetches = [];
        handle = null;
        jest.spyOn(console, "error").mockImplementation(() => undefined);
    });
    afterEach(() => jest.restoreAllMocks());

    const mount = () =>
        render(
            <EditModal
                refCallback={(h: EditModalHandle | null) => {
                    handle = h;
                }}
            />
        );

    it("does not throw when asked to open, and asks for the assets it lacks", () => {
        mount();
        expect(() =>
            act(() => {
                (handle as EditModalHandle).initModal(offer);
            })
        ).not.toThrow();
        expect(mockFetches).toHaveLength(1);
        expect(mockFetches[0].ids.sort()).toEqual(["1.3.7", "1.3.8"]);
    });

    it("opens once the assets have arrived", async () => {
        const {baseElement} = mount();
        act(() => {
            (handle as EditModalHandle).initModal(offer);
        });
        // (shut while the assets are on their way)
        expect(
            baseElement.querySelectorAll(".modal--transaction-confirm")
        ).toHaveLength(0);
        mockAssets["1.3.7"] = asset("1.3.7", 5);
        mockAssets["1.3.8"] = asset("1.3.8", 4);
        await act(async () => {
            mockFetches[0].done();
        });
        expect(
            baseElement.querySelectorAll(".modal--transaction-confirm")
        ).toHaveLength(1);
    });

    it("opens at once, without asking, when the assets are already loaded", () => {
        mockAssets["1.3.7"] = asset("1.3.7", 5);
        mockAssets["1.3.8"] = asset("1.3.8", 4);
        const {baseElement} = mount();
        act(() => {
            (handle as EditModalHandle).initModal(offer);
        });
        expect(mockFetches).toHaveLength(0);
        expect(
            baseElement.querySelectorAll(".modal--transaction-confirm")
        ).toHaveLength(1);
    });
});
