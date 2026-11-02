// The recent activity list: the search above it narrows it as it is typed (what an operation says: its kind, its
// accounts, its assets, its amounts), and on the dashboard it asks the node for older operations again and again until
// the node has no more.
import * as React from "react";
import {act, render} from "@testing-library/react";
import Immutable from "immutable";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

const mockExtend = jest.fn<Promise<number>, any[]>();
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
    default: ({rows, extraRow}: any) => (
        <div>
            <ul>
                {rows.map((row: any) => (
                    <li key={row.key} data-row={row.key} />
                ))}
            </ul>
            {extraRow}
        </div>
    )
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

import {
    AUTO_LOAD_MAX,
    RecentTransactions
} from "../../components/Account/RecentTransactions";

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
    it("are asked for again and again until the node has no more", async () => {
        mockExtend
            .mockResolvedValueOnce(100)
            .mockResolvedValueOnce(100)
            .mockResolvedValueOnce(0);
        render(list({loadAllOlder: true}));
        await flush();
        await flush();
        await flush();
        await flush();
        expect(mockExtend).toHaveBeenCalledTimes(3);
        // no more once it said so
        await flush();
        expect(mockExtend).toHaveBeenCalledTimes(3);
    });

    it("are not asked for by themselves where the list is not told to", async () => {
        render(list());
        await flush();
        await flush();
        expect(mockExtend).not.toHaveBeenCalled();
    });

    it("stop at a failure, and leave the button", async () => {
        mockExtend.mockRejectedValue(new Error("node gone"));
        const {container} = render(list({loadAllOlder: true}));
        await flush();
        await flush();
        await flush();
        expect(mockExtend).toHaveBeenCalledTimes(1);
        expect(container.textContent).toContain("Load older");
    });

    it("say how many are there while they are loaded", async () => {
        let done: (n: number) => void = () => undefined;
        mockExtend.mockReturnValue(new Promise(resolve => (done = resolve)));
        const {container} = render(list({loadAllOlder: true}));
        await flush();
        expect(container.textContent).toContain(
            "Loading older operations: 3 so far"
        );
        await act(async () => done(0));
    });

    it("are not asked for beyond the most that is loaded by itself", async () => {
        setHistory(
            Array.from({length: AUTO_LOAD_MAX}, (_, i) =>
                transfer(i, "1.2.50", "1", "1.3.0")
            )
        );
        render(list({loadAllOlder: true, limit: AUTO_LOAD_MAX + 10}));
        await flush();
        await flush();
        expect(mockExtend).not.toHaveBeenCalled();
    });
});
