// The recent activity list: the search above it narrows it as it is typed (what an operation says: its kind, its
// accounts, its assets, its amounts), and on the dashboard the first operations the node sends are listed and older
// ones are loaded only when the reader steps forward to the end of what is loaded.
import * as React from "react";
import {act, render} from "@testing-library/react";
import Immutable from "immutable";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

const mockExtend = jest.fn<Promise<number>, any[]>();
let mockOnPage: ((page: number, size: number) => void) | undefined;
jest.mock("../../lib/chain/extendAccountHistory", () => ({
    extendAccountHistory: (...args: any[]) => mockExtend(...args)
}));
jest.mock("../../actions/BalanceHistoryActions", () => ({
    __esModule: true,
    default: {getOlderFromOtherNodes: jest.fn()}
}));
jest.mock("bitsharesjs-ws", () => ({
    Apis: {instance: () => ({history_api: () => ({exec: jest.fn()})})}
}));

let mockObjects = new Map<string, any>();
let mockAccount: any;
jest.mock("bitsharesjs", () => ({
    ...jest.requireActual("bitsharesjs"),
    ChainStore: {
        get objects_by_id() {
            return mockObjects;
        },
        getAccount: () => mockAccount,
        getAsset: (id: string) => mockObjects.get(id),
        getObject: (id: string) =>
            id === "2.1.0"
                ? jest
                      .requireActual("immutable")
                      .fromJS({last_irreversible_block_num: 1000000})
                : mockObjects.get(id)
    }
}));

// the parts that are not what is tested: the list shows its row keys and the button under it
jest.mock("../../components/Utility/PaginatedList", () => ({
    __esModule: true,
    default: ({rows, extraRow, onPage}: any) => {
        mockOnPage = onPage;
        return (
            <div>
                <ul>
                    {rows.map((row: any) => (
                        <li key={row.key} data-row={row.key} />
                    ))}
                </ul>
                {extraRow}
            </div>
        );
    }
}));
jest.mock("../../components/Blockchain/OperationAnt", () => ({
    __esModule: true,
    default: class {
        getColumn() {
            return {column: "column", color: "info"};
        }
    }
}));
jest.mock("components/Modal/JSONModal", () => ({
    __esModule: true,
    default: () => null
}));
jest.mock("../../components/Blockchain/OperationFacts", () => ({
    __esModule: true,
    default: () => null,
    TransactionIdShort: () => null
}));
jest.mock("../../components/Blockchain/BlockTime", () => ({
    __esModule: true,
    default: () => null
}));
jest.mock("../../components/Utility/PendingBlock", () => ({
    __esModule: true,
    default: () => null
}));
jest.mock("../../components/Utility/FormattedAsset", () => ({
    __esModule: true,
    default: () => null
}));
jest.mock("../../components/Utility/CopyIconButton", () => ({
    __esModule: true,
    default: () => null
}));
jest.mock("../../components/LoadingIndicator", () => ({
    __esModule: true,
    default: () => <span>spinner</span>
}));
jest.mock("../../components/AddressBook/AddToAddressBook", () => ({
    __esModule: true,
    default: () => null
}));
jest.mock("../../services/AccountHistoryExporter", () => ({
    __esModule: true,
    default: class {},
    FULL: "full",
    COINBASE: "coinbase"
}));
jest.mock("../../next/hooks/useChainStoreTick", () => ({
    useChainStoreTick: () => 0
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    useReduxState: () => ({
        marketDirections: jest.requireActual("immutable").Map()
    })
}));

import {RecentTransactions} from "../../components/Account/RecentTransactions";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

const FEE = {amount: "100", asset_id: "1.3.0"};
const transfer = (n: number, to: string, amount: string, asset: string) => ({
    id: `1.11.${1000 - n}`,
    block_num: 5000 - n,
    trx_in_block: 0,
    op_in_trx: 0,
    virtual_op: 0,
    result: [0, {}],
    op: [
        0,
        {
            fee: FEE,
            from: "1.2.10",
            to,
            amount: {amount, asset_id: asset}
        }
    ]
});
const order = (n: number) => ({
    id: `1.11.${1000 - n}`,
    block_num: 5000 - n,
    trx_in_block: 0,
    op_in_trx: 0,
    virtual_op: 0,
    result: [0, "1.7.1"],
    op: [
        1,
        {
            fee: FEE,
            seller: "1.2.10",
            amount_to_sell: {amount: "3800000", asset_id: "1.3.0"},
            min_to_receive: {amount: "5000000", asset_id: "1.3.7"}
        }
    ]
});

const setHistory = (entries: any[]) => {
    mockAccount = Immutable.fromJS({
        id: "1.2.10",
        name: "me",
        history: entries
    });
};

beforeEach(() => {
    jest.clearAllMocks();
    mockExtend.mockResolvedValue(0);
    mockObjects = new Map<string, any>([
        ["1.2.10", Immutable.fromJS({id: "1.2.10", name: "thmsfnd02"})],
        ["1.2.50", Immutable.fromJS({id: "1.2.50", name: "xbts-hive"})],
        ["1.2.60", Immutable.fromJS({id: "1.2.60", name: "bob"})],
        ["1.3.0", Immutable.fromJS({id: "1.3.0", symbol: "BTS", precision: 5})],
        [
            "1.3.7",
            Immutable.fromJS({id: "1.3.7", symbol: "XBTSX.HIVE", precision: 6})
        ]
    ]);
    setHistory([
        transfer(1, "1.2.50", "820211111", "1.3.7"),
        order(2),
        transfer(3, "1.2.60", "500000", "1.3.0")
    ]);
});

const list = (props: any = {}) => (
    <RecentTransactions
        accountsList={Immutable.List(["1.2.10"])}
        compactView
        fullHeight
        showFilters={false}
        limit={50}
        {...props}
    />
);
const rows = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("[data-row]")).map(
        r => (r as HTMLElement).dataset.row
    );
const flush = () => act(async () => {});

describe("the search in the recent activity", () => {
    it("lists everything when nothing is typed", () => {
        const {container} = render(list());
        expect(rows(container)).toEqual(["1.11.999", "1.11.998", "1.11.997"]);
        expect(rows(render(list({search: "   "})).container)).toHaveLength(3);
    });

    it("finds an operation by an account, an asset, an amount or its kind, as it is typed", () => {
        const view = render(list({search: "xbts-hive"}));
        expect(rows(view.container)).toEqual(["1.11.999"]);
        // the asset
        view.rerender(list({search: "xbtsx.hive"}));
        expect(rows(view.container)).toEqual(["1.11.999", "1.11.998"]);
        // the amount as the row shows it, and the kind of operation
        view.rerender(list({search: "820.211111"}));
        expect(rows(view.container)).toEqual(["1.11.999"]);
        view.rerender(list({search: "place order"}));
        expect(rows(view.container)).toEqual(["1.11.998"]);
        // every word has to be there, in any order and case
        view.rerender(list({search: "BTS transfer"}));
        expect(rows(view.container)).toEqual(["1.11.999", "1.11.997"]);
        view.rerender(list({search: "bob transfer"}));
        expect(rows(view.container)).toEqual(["1.11.997"]);
        view.rerender(list({search: "bob hive"}));
        expect(rows(view.container)).toEqual([]);
        // and everything again when it is cleared
        view.rerender(list({search: ""}));
        expect(rows(view.container)).toHaveLength(3);
    });

    it("searches what is loaded without asking the node for any account or asset it does not have", () => {
        mockObjects.delete("1.2.60");
        const view = render(list({search: "bob"}));
        // bob's name is not in the store: not found by name, but the id still is
        expect(rows(view.container)).toEqual([]);
        view.rerender(list({search: "1.2.60"}));
        expect(rows(view.container)).toEqual(["1.11.997"]);
        // once the account is there, the name finds it (the text was not kept while it was missing)
        mockObjects.set(
            "1.2.60",
            Immutable.fromJS({id: "1.2.60", name: "bob"})
        );
        view.rerender(list({search: "bob"}));
        expect(rows(view.container)).toEqual(["1.11.997"]);
    });
});

describe("the older operations on the dashboard", () => {
    const hundred = () =>
        setHistory(
            Array.from({length: 100}, (_, i) =>
                transfer(i, "1.2.50", "1", "1.3.0")
            )
        );
    const step = (page: number, size: number) =>
        act(async () => {
            (mockOnPage as any)(page, size);
        });

    it("loads nothing by itself: the first operations are listed and that is all", async () => {
        hundred();
        const {container} = render(list({loadOnStep: true, limit: 500}));
        await flush();
        await flush();
        expect(mockExtend).not.toHaveBeenCalled();
        expect(rows(container)).toHaveLength(100);
    });

    it("loads the next hundred when the reader steps to the last page that is loaded, and not before", async () => {
        hundred();
        render(list({loadOnStep: true, limit: 500}));
        // pages of 25: 2 and 3 still have a full page after them
        await step(2, 25);
        await step(3, 25);
        expect(mockExtend).not.toHaveBeenCalled();
        await step(4, 25);
        expect(mockExtend).toHaveBeenCalledTimes(1);
        // for the first hundred (the page the chain store loaded), 100 more
        expect(mockExtend.mock.calls[0][3]).toBe(100);
    });

    it("loads when a page size is chosen that needs more than there is, and not for one that does not", async () => {
        hundred();
        render(list({loadOnStep: true, limit: 500}));
        await step(1, 50);
        expect(mockExtend).not.toHaveBeenCalled();
        await step(1, 100);
        expect(mockExtend).toHaveBeenCalledTimes(1);
    });

    it("counts what the search found: the end of a short list of matches is the end of what to step through", async () => {
        hundred();
        // 8 of them go to somebody else
        setHistory(
            Array.from({length: 100}, (_, i) =>
                transfer(i, i < 8 ? "1.2.60" : "1.2.50", "1", "1.3.0")
            )
        );
        render(list({loadOnStep: true, limit: 500, search: "bob"}));
        await step(1, 25);
        expect(mockExtend).toHaveBeenCalledTimes(1);
    });

    it("asks once while a request is out, and nothing more once the node has no more", async () => {
        hundred();
        let done: (n: number) => void = () => undefined;
        mockExtend.mockReturnValueOnce(
            new Promise(resolve => (done = resolve))
        );
        render(list({loadOnStep: true, limit: 500}));
        await step(4, 25);
        await step(4, 25);
        expect(mockExtend).toHaveBeenCalledTimes(1);
        await act(async () => done(0));
        // the node had nothing: no more asking
        await step(4, 25);
        await step(1, 100);
        expect(mockExtend).toHaveBeenCalledTimes(1);
    });

    it("does nothing where the list is not told to load on a step", async () => {
        hundred();
        render(list({limit: 500}));
        await step(4, 25);
        expect(mockExtend).not.toHaveBeenCalled();
    });

    it("leaves the button, and tries again on the next step, after a failure", async () => {
        hundred();
        mockExtend.mockRejectedValueOnce(new Error("node gone"));
        const {container} = render(list({loadOnStep: true, limit: 500}));
        await step(4, 25);
        await flush();
        expect(mockExtend).toHaveBeenCalledTimes(1);
        expect(container.textContent).toContain("Load older");
        await step(4, 25);
        expect(mockExtend).toHaveBeenCalledTimes(2);
    });
});
