import * as React from "react";
import {fireEvent, render} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

jest.mock("../../components/Utility/AssetName", () => ({
    __esModule: true,
    default: (props: any) =>
        require("react").createElement("span", null, props.name)
}));

import {PoolCard, PoolCardData} from "../../components/Poolmart/PoolCard";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

const pool: PoolCardData = {
    id: "1.19.9",
    shareSymbol: "POOL.9",
    symbolA: "BTS",
    symbolB: "USD",
    metrics: {
        reserveA: 1000,
        reserveB: 50,
        priceBPerA: 0.05,
        poolValueA: 2000,
        volume24hA: null,
        feeYield24h: null,
        isStable: false
    } as any,
    takerFeePercent: 20,
    withdrawalFeePercent: 0,
    valueUnit: "BTS"
};

const mount = (props: any) =>
    render(
        <MemoryRouter>
            <PoolCard
                pool={pool}
                canAct={true}
                onSwap={() => undefined}
                onStake={() => undefined}
                {...props}
            />
        </MemoryRouter>
    );

describe("the favorite star of a pool", () => {
    it("is not there unless the list can toggle it", () => {
        const {container} = mount({});
        expect(container.querySelector("button[aria-pressed]")).toBeNull();
    });

    it("says whether the pool is a favorite, and toggles it", () => {
        const toggled = jest.fn();
        const off = mount({starred: false, onToggleStar: toggled});
        const star = off.container.querySelector(
            "button[aria-pressed]"
        ) as HTMLElement;
        expect(star.getAttribute("aria-pressed")).toBe("false");
        expect(star.getAttribute("aria-label")).toBe("Add to favorites");
        fireEvent.click(star);
        expect(toggled).toHaveBeenCalledTimes(1);
        off.unmount();
        const on = mount({starred: true, onToggleStar: toggled});
        const filled = on.container.querySelector(
            "button[aria-pressed]"
        ) as HTMLElement;
        expect(filled.getAttribute("aria-pressed")).toBe("true");
        expect(filled.getAttribute("aria-label")).toBe("Remove from favorites");
    });
});
