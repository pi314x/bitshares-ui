import * as React from "react";
import {render, screen, act} from "@testing-library/react";
import counterpart from "counterpart";
import OperationFacts, {
    TransactionIdShort
} from "../../../components/Blockchain/OperationFacts";
import {fetchTransactionId} from "../../../lib/common/transactionId";
import localeEn from "../../../assets/locales/locale-en.json";

jest.mock("../../../lib/common/clipboard", () => ({
    copyText: jest.fn().mockResolvedValue(true)
}));
jest.mock("../../../lib/common/transactionId", () => ({
    ...jest.requireActual("../../../lib/common/transactionId"),
    fetchTransactionId: jest.fn()
}));
const fetchId = fetchTransactionId as jest.Mock;

const ID = "1ff9fd3f6d2aa27d35aeca7474d4e819e8be47c2";
const transfer = {
    ref_block_num: 16442,
    ref_block_prefix: 2076179124,
    expiration: "2026-10-26T09:13:38",
    operations: [
        [
            0,
            {
                fee: {amount: 86869, asset_id: "1.3.0"},
                from: "1.2.26848",
                to: "1.2.26849",
                amount: {amount: 1000, asset_id: "1.3.0"},
                extensions: []
            }
        ]
    ],
    extensions: []
};

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});
beforeEach(() => fetchId.mockReset());

// (this jsdom has no MutationObserver, so no `waitFor`): let the promises settle
const settle = () =>
    act(async () => {
        await new Promise(r => setTimeout(r, 0));
    });

describe("OperationFacts", () => {
    it("shows the operation id, the block and the transaction id, each id with a copy button", async () => {
        fetchId.mockResolvedValue({id: ID});
        render(
            <OperationFacts
                operationId="1.11.1400657532"
                blockNum={101728315}
                trxInBlock={0}
                opInTrx={0}
                opType={1}
            />
        );
        await settle();
        expect(screen.getByText(ID)).toBeTruthy();
        expect(fetchId).toHaveBeenCalledWith(101728315, 0, 0, 1);
        expect(screen.getByText("Operation ID")).toBeTruthy();
        expect(screen.getByText("1.11.1400657532")).toBeTruthy();
        expect(screen.getByText("101728315")).toBeTruthy();
        expect(screen.getByText("Transaction ID")).toBeTruthy();
        expect(
            screen.getByRole("button", {
                name: `Copy to clipboard: ${ID}`
            })
        ).toBeTruthy();
        expect(
            screen.getByRole("button", {
                name: "Copy to clipboard: 1.11.1400657532"
            })
        ).toBeTruthy();
    });

    it("says that a virtual operation has no transaction of its own", async () => {
        fetchId.mockResolvedValue({virtual: true});
        render(
            <OperationFacts
                operationId="1.11.5"
                blockNum={10}
                trxInBlock={3}
                opInTrx={0}
                opType={4}
            />
        );
        await settle();
        expect(
            screen.getByText(/virtual operation has no transaction/)
        ).toBeTruthy();
        expect(screen.queryAllByRole("button")).toHaveLength(1); // the operation id's
    });

    it("says so when the block could not be read", async () => {
        fetchId.mockResolvedValue(null);
        render(<OperationFacts blockNum={10} trxInBlock={3} />);
        await settle();
        expect(screen.getByText("Not available")).toBeTruthy();
    });

    it("needs no request when it is given the transaction (the block page)", () => {
        render(<OperationFacts trx={transfer} />);
        expect(screen.getByText(ID)).toBeTruthy();
        expect(fetchId).not.toHaveBeenCalled();
    });

    it("waits with an ellipsis while the block is read", async () => {
        let resolve: (v: any) => void = () => {};
        fetchId.mockReturnValue(new Promise(r => (resolve = r)));
        render(<OperationFacts blockNum={10} trxInBlock={3} />);
        expect(screen.getByText("…")).toBeTruthy();
        await act(async () => resolve({id: ID}));
        expect(screen.getByText(ID)).toBeTruthy();
    });

    it("puts the transaction id right under the operation id, the block after it", async () => {
        fetchId.mockResolvedValue({id: ID});
        const {container} = render(
            <OperationFacts
                operationId="1.11.5"
                blockNum={10}
                trxInBlock={3}
                opInTrx={0}
                opType={1}
            />
        );
        await settle();
        const labels = Array.from(container.querySelectorAll("dt")).map(
            n => n.textContent
        );
        expect(labels).toEqual(["Operation ID", "Transaction ID", "Block"]);
    });
});

describe("TransactionIdShort", () => {
    it("shows the first 8 and last 6 characters and copies all of the id", async () => {
        fetchId.mockResolvedValue({id: ID});
        render(<TransactionIdShort blockNum={10} trxInBlock={3} opType={1} />);
        await settle();
        expect(
            screen.getByText(`${ID.slice(0, 8)}…${ID.slice(-6)}`)
        ).toBeTruthy();
        expect(
            screen.getByRole("button", {name: `Copy to clipboard: ${ID}`})
        ).toBeTruthy();
    });

    it("shows nothing for an operation the chain made", async () => {
        fetchId.mockResolvedValue({virtual: true});
        const {container} = render(
            <TransactionIdShort blockNum={10} trxInBlock={3} opType={4} />
        );
        await settle();
        expect(container.textContent).toBe("");
    });
});
