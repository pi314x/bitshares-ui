import * as React from "react";
import {render} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

// one position: 100 USD of debt (precision 2), `mockCollateral` BTS of collateral (precision 5), the feed pricing
// 1 USD at 1 BTS, called at 175%
let mockCollateral = 400;
let mockLoaded = true;
let mockPositions = ["1.8.1"];

const mockCall = () =>
    jest.requireActual("immutable").fromJS({
        id: "1.8.1",
        debt: "10000",
        collateral: String(mockCollateral * 100000),
        call_price: {
            base: {amount: "1", asset_id: "1.3.0"},
            quote: {amount: "1", asset_id: "1.3.5"}
        }
    });
const mockAsset = (id: string) => {
    if (!mockLoaded && id === "1.3.5") return undefined;
    const base = {id, precision: id === "1.3.5" ? 2 : 5};
    return jest.requireActual("immutable").fromJS(
        id === "1.3.5"
            ? {
                  ...base,
                  symbol: "USD",
                  bitasset: {
                      current_feed: {
                          settlement_price: {
                              base: {amount: "100", asset_id: "1.3.5"},
                              quote: {amount: "100000", asset_id: "1.3.0"}
                          },
                          maintenance_collateral_ratio: 1750
                      }
                  }
              }
            : {...base, symbol: "BTS"}
    );
};

jest.mock("bitsharesjs", () => ({
    ChainStore: {
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        getAccount: () =>
            jest
                .requireActual("immutable")
                .fromJS({id: "1.2.10", call_orders: mockPositions}),
        getObject: (id: string) => (id === "1.8.1" ? mockCall() : undefined),
        getAsset: (id: string) => mockAsset(id)
    }
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    useReduxState: () => ({currentAccount: "me"})
}));
const mockToast = jest.fn();
jest.mock("../../design-system/Notification", () => {
    const toast = (kind: string) => (args: any) => mockToast(kind, args);
    return {
        Notification: {
            success: toast("success"),
            info: toast("info"),
            warning: toast("warning"),
            error: toast("error")
        }
    };
});

import AccountRiskNotifications from "../../components/Notifications/AccountRiskNotifications";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    window.localStorage.clear();
    mockToast.mockClear();
    mockCollateral = 400;
    mockLoaded = true;
    mockPositions = ["1.8.1"];
});

const MEMORY = "__graphene__riskAlerts_me";

describe("AccountRiskNotifications", () => {
    it("says nothing about a position that is far from a call", () => {
        render(<AccountRiskNotifications />);
        expect(mockToast).not.toHaveBeenCalled();
        expect(window.localStorage.getItem(MEMORY)).toBeNull();
    });

    it("warns once when a position gets close, with how far the price may fall, and not again on a reload", () => {
        mockCollateral = 230;
        const view = render(<AccountRiskNotifications />);
        expect(mockToast).toHaveBeenCalledTimes(1);
        const [kind, args] = mockToast.mock.calls[0];
        expect(kind).toBe("warning");
        expect(args.message).toBe("Margin position getting close");
        expect(args.description).toBe(
            "Your USD position holds 230% collateral. It is called if the collateral's price falls 23.9%."
        );
        expect(
            JSON.parse(window.localStorage.getItem(MEMORY) || "{}")
        ).toEqual({"1.8.1": "watch"});
        // the same look again, and a new mount of the page (a reload): nothing more
        view.rerender(<AccountRiskNotifications />);
        view.unmount();
        render(<AccountRiskNotifications />);
        expect(mockToast).toHaveBeenCalledTimes(1);
    });

    it("tells again as the position gets closer: danger, then called", () => {
        mockCollateral = 230;
        const view = render(<AccountRiskNotifications />);
        mockCollateral = 190;
        view.rerender(<AccountRiskNotifications />);
        expect(mockToast).toHaveBeenCalledTimes(2);
        expect(mockToast.mock.calls[1][0]).toBe("error");
        expect(mockToast.mock.calls[1][1].message).toBe("Margin call is close");
        mockCollateral = 170;
        view.rerender(<AccountRiskNotifications />);
        expect(mockToast).toHaveBeenCalledTimes(3);
        const [kind, args] = mockToast.mock.calls[2];
        expect(kind).toBe("error");
        expect(args.message).toBe("Margin call possible now");
        expect(args.description).toBe(
            "Your USD position holds 170% collateral, below the call ratio 175%. It can be margin-called at any moment: add collateral or repay debt."
        );
    });

    it("waits for the assets: a position whose asset is not loaded yet is looked at when it is", () => {
        mockCollateral = 230;
        mockLoaded = false;
        const view = render(<AccountRiskNotifications />);
        expect(mockToast).not.toHaveBeenCalled();
        mockLoaded = true;
        view.rerender(<AccountRiskNotifications />);
        expect(mockToast).toHaveBeenCalledTimes(1);
    });

    it("does not forget what it told about a position while the position is not loaded, and forgets a position the account closed", () => {
        mockCollateral = 230;
        const view = render(<AccountRiskNotifications />);
        expect(mockToast).toHaveBeenCalledTimes(1);
        // the asset goes out of the store for a moment: nothing changes, and nothing is told again
        mockLoaded = false;
        view.rerender(<AccountRiskNotifications />);
        mockLoaded = true;
        view.rerender(<AccountRiskNotifications />);
        expect(mockToast).toHaveBeenCalledTimes(1);
        expect(
            JSON.parse(window.localStorage.getItem(MEMORY) || "{}")
        ).toEqual({"1.8.1": "watch"});
        // the account no longer has the position
        mockPositions = [];
        view.rerender(<AccountRiskNotifications />);
        expect(JSON.parse(window.localStorage.getItem(MEMORY) || "{}")).toEqual(
            {}
        );
    });

    it("takes nothing from storage that this component did not write", () => {
        window.localStorage.setItem(
            MEMORY,
            JSON.stringify({"1.8.1": "<script>", "1.2.3": "danger"})
        );
        mockCollateral = 230;
        render(<AccountRiskNotifications />);
        // the junk is ignored: the position is told about
        expect(mockToast).toHaveBeenCalledTimes(1);
        expect(
            JSON.parse(window.localStorage.getItem(MEMORY) || "{}")
        ).toEqual({"1.8.1": "watch"});
    });
});
