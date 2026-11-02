// On the card of an address book entry for an asset: what the account holds of that asset.
import * as React from "react";
import {render} from "@testing-library/react";
import Immutable from "immutable";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

let mockAccount: any;
let mockObjects: Record<string, any> = {};
let mockAssets: Record<string, any> = {};
jest.mock("bitsharesjs", () => ({
    ...jest.requireActual("bitsharesjs"),
    ChainStore: {
        getAccount: () => mockAccount,
        getAsset: (symbol: string) => mockAssets[symbol],
        getObject: (id: string) => mockObjects[id]
    }
}));
let mockName: string | null = "thmsfnd02";
jest.mock("../../next/hooks/useReduxState", () => ({
    useReduxState: () => ({currentAccount: mockName, passwordAccount: null})
}));
jest.mock("../../next/hooks/useChainStoreTick", () => ({
    useChainStoreTick: () => 0
}));
import HeldBalance, {heldUnits} from "../../components/AddressBook/HeldBalance";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    mockName = "thmsfnd02";
    mockAssets = {
        "XBTSX.HIVE": Immutable.fromJS({
            id: "1.3.7",
            symbol: "XBTSX.HIVE",
            precision: 6
        })
    };
    mockObjects = {
        "2.5.1": Immutable.fromJS({
            id: "2.5.1",
            asset_type: "1.3.0",
            balance: "100"
        }),
        "2.5.2": Immutable.fromJS({
            id: "2.5.2",
            asset_type: "1.3.7",
            balance: "820211111"
        })
    };
    mockAccount = Immutable.fromJS({
        id: "1.2.10",
        balances: ["2.5.1", "2.5.2"]
    });
});

describe("HeldBalance", () => {
    it("shows what the account holds of the asset", () => {
        const {container} = render(<HeldBalance symbol="XBTSX.HIVE" />);
        expect(container.textContent).toContain("Balance");
        expect(container.textContent).toContain("820.211111 XBTSX.HIVE");
    });

    it("shows nothing held as zero, so that a withdrawal of it is known to have nothing to take", () => {
        mockObjects["2.5.2"] = Immutable.fromJS({
            id: "2.5.2",
            asset_type: "1.3.7",
            balance: 0
        });
        const empty = render(<HeldBalance symbol="XBTSX.HIVE" />);
        expect(empty.container.textContent).toContain("0.000000 XBTSX.HIVE");
        empty.unmount();
        // no balance of it at all
        mockAccount = Immutable.fromJS({id: "1.2.10", balances: ["2.5.1"]});
        const none = render(<HeldBalance symbol="XBTSX.HIVE" />);
        expect(none.container.textContent).toContain("0.000000 XBTSX.HIVE");
    });

    it("shows nothing until the account, its balances and the asset are loaded, and without an account", () => {
        mockAccount = undefined;
        expect(
            render(<HeldBalance symbol="XBTSX.HIVE" />).container.textContent
        ).toBe("");
        // a balance object that has not arrived: it may be the one
        mockAccount = Immutable.fromJS({
            id: "1.2.10",
            balances: ["2.5.1", "2.5.9"]
        });
        expect(
            render(<HeldBalance symbol="XBTSX.HIVE" />).container.textContent
        ).toBe("");
        mockAccount = Immutable.fromJS({
            id: "1.2.10",
            balances: ["2.5.1", "2.5.2"]
        });
        mockAssets = {};
        expect(
            render(<HeldBalance symbol="XBTSX.HIVE" />).container.textContent
        ).toBe("");
        mockAssets = {
            "XBTSX.HIVE": Immutable.fromJS({
                id: "1.3.7",
                symbol: "XBTSX.HIVE",
                precision: 6
            })
        };
        mockName = null;
        expect(
            render(<HeldBalance symbol="XBTSX.HIVE" />).container.textContent
        ).toBe("");
    });

    it("knows the units of one asset among the balances, and that a pending balance object may be it", () => {
        expect(heldUnits(mockAccount, "1.3.7")).toBe(820211111);
        expect(heldUnits(mockAccount, "1.3.0")).toBe(100);
        expect(heldUnits(mockAccount, "1.3.99")).toBe(0);
        // the one held is there even while another has not arrived
        const partly = Immutable.fromJS({
            id: "1.2.10",
            balances: ["2.5.2", "2.5.9"]
        });
        expect(heldUnits(partly, "1.3.7")).toBe(820211111);
        expect(heldUnits(partly, "1.3.0")).toBeNull();
        expect(heldUnits(undefined, "1.3.7")).toBeNull();
    });
});
