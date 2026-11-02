import * as React from "react";
import {act, fireEvent, render} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

const mockPool = (n: number) => {
    const {Map} = jest.requireActual("immutable");
    return {
        id: `1.19.${n}`,
        share_asset: `1.3.${n}00`,
        asset_a: "1.3.0",
        asset_b: "1.3.1",
        balance_a: "100000",
        balance_b: "5000",
        taker_fee_percent: 20,
        withdrawal_fee_percent: 0,
        asset_a_obj: Map({id: "1.3.0", symbol: "BTS", precision: 5}),
        asset_b_obj: Map({id: "1.3.1", symbol: `USD${n}`, precision: 4}),
        share_asset_obj: Map({symbol: `POOL.${n}`, issuer: "1.2.5"})
    };
};
let mockListed: any[] = [];
const mockByShare = jest.fn((ids: string[]) =>
    Promise.resolve(
        [mockPool(1), mockPool(2), mockPool(3)].filter(p =>
            ids.includes(p.share_asset)
        )
    )
);
jest.mock("../../actions/PoolmartActions", () => ({
    __esModule: true,
    default: {
        resetLiquidityPools: jest.fn(),
        getLiquidityPools: {defer: jest.fn()},
        getLiquidityPoolsByShareAsset: {defer: jest.fn()},
        getPoolsByShareAssets: (ids: string[]) => mockByShare(ids)
    }
}));
jest.mock("bitsharesjs", () => ({
    ChainStore: {
        getAsset: () => ({}),
        getAccount: () => null,
        getObject: () => null,
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
    }
}));
jest.mock("../../stores/AccountStore", () => ({
    __esModule: true,
    default: {getState: () => ({myActiveAccounts: [], currentAccount: null})}
}));
jest.mock("../../components/Poolmart/useMyHoldings", () => ({
    useMyHoldings: () => ({pools: [], holdings: {}})
}));
jest.mock("../../components/Poolmart/usePoolAssets", () => ({
    usePoolAssets: () => ({assets: [], partners: {}, shares: []})
}));
jest.mock("../../components/Poolmart/PoolGraph", () => ({
    __esModule: true,
    default: () => null
}));
jest.mock("../../components/Modal/PoolExchangeModal", () => ({
    __esModule: true,
    default: () => null
}));
jest.mock("../../components/Modal/PoolStakeModal", () => ({
    __esModule: true,
    default: () => null
}));
jest.mock("../../components/Poolmart/PoolFeesModal", () => ({
    __esModule: true,
    default: () => null
}));
jest.mock("../../components/Utility/AssetName", () => ({
    __esModule: true,
    default: (props: any) =>
        jest.requireActual("react").createElement("span", null, props.name)
}));
jest.mock("../../next/hooks/useChainStoreTick", () => ({
    useChainStoreTick: () => 0
}));
// a phone: a card for each pool
jest.mock("../../next/hooks/useElementWidth", () => ({
    useElementWidth: () => [{current: null}, 500]
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    useReduxState: () => ({
        currentAccount: null,
        passwordAccount: null,
        liquidityPools: {
            size: mockListed.length,
            last: () => mockListed[mockListed.length - 1],
            forEach: (fn: any) => mockListed.forEach(fn)
        },
        lastPoolId: null
    })
}));

import LiquidityPoolsContainer from "../../components/Poolmart/LiquidityPools";
import {
    getFavoritePools,
    reloadFavoritePools
} from "../../lib/common/favoritePools";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    window.localStorage.clear();
    reloadFavoritePools();
    mockByShare.mockClear();
    mockListed = [mockPool(1), mockPool(2), mockPool(3)];
});

const settle = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
    });

const stars = (container: HTMLElement) =>
    Array.from(
        container.querySelectorAll("button[aria-label$='favorites']")
    ) as HTMLElement[];

describe("the pools screen, with favorites", () => {
    it("has no section of favorites until a pool is starred, then shows it on top and keeps it in the list", async () => {
        const {container} = render(
            <MemoryRouter>
                <LiquidityPoolsContainer />
            </MemoryRouter>
        );
        await settle();
        expect(container.textContent).not.toContain("Favorite pools");
        // three pools in the list, none starred
        expect(stars(container)).toHaveLength(3);
        expect(
            stars(container).every(
                s => s.getAttribute("aria-pressed") === "false"
            )
        ).toBe(true);

        await act(async () => {
            fireEvent.click(stars(container)[1]);
        });
        await settle();
        expect(getFavoritePools()).toEqual(["1.3.200"]);
        expect(container.textContent).toContain("Favorite pools");
        // the node is asked for the favorite by its share asset
        expect(mockByShare).toHaveBeenLastCalledWith(["1.3.200"]);
        // the favorite is on top: first in the page; and starred in both places
        const first = stars(container)[0];
        expect(first.getAttribute("aria-pressed")).toBe("true");
        expect(
            stars(container).filter(
                s => s.getAttribute("aria-pressed") === "true"
            )
        ).toHaveLength(2);

        // un-starring takes the section away
        await act(async () => {
            fireEvent.click(first);
        });
        await settle();
        expect(getFavoritePools()).toEqual([]);
        expect(container.textContent).not.toContain("Favorite pools");
    });

    it("shows a favorite even when the list does not have it (a filter, a page not read yet)", async () => {
        window.localStorage.setItem(
            "__graphene__favoritePools",
            JSON.stringify(["1.3.300"])
        );
        reloadFavoritePools();
        mockListed = [mockPool(1)];
        const {container} = render(
            <MemoryRouter>
                <LiquidityPoolsContainer />
            </MemoryRouter>
        );
        await settle();
        expect(container.textContent).toContain("Favorite pools");
        expect(container.textContent).toContain("POOL.3");
        // the pool of the list is there too, once
        expect(container.textContent).toContain("POOL.1");
    });
});
