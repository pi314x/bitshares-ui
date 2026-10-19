// The dialogs of the Advanced operations page. The chain layer is mocked; what is checked
// is what each dialog decides: what it lets the person send, and exactly which operations
// reach the transaction layer.
import * as React from "react";
import {render, fireEvent, act, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import counterpart from "counterpart";
import localeEn from "../../../assets/locales/locale-en.json";
import vectors from "../../fixtures/coreOperationVectors.json";

const mock = {
    send: jest.fn(),
    propose: jest.fn(),
    getCommitteeMember: jest.fn(),
    getParameters: jest.fn(),
    getFund: jest.fn()
};
const mockAccounts: Record<string, string> = {
    alice: "1.2.100",
    bob: "1.2.101",
    carol: "1.2.102"
};
const mockAssets: Record<string, any> = {
    USD: {
        id: "1.3.121",
        symbol: "USD",
        precision: 4,
        issuer: "1.2.100",
        flags: 0
    },
    GOLD: {
        id: "1.3.130",
        symbol: "GOLD",
        precision: 4,
        issuer: "1.2.100",
        flags: 4
    },
    OTHER: {
        id: "1.3.140",
        symbol: "OTHER",
        precision: 4,
        issuer: "1.2.999",
        flags: 4
    },
    BTS: {id: "1.3.0", symbol: "BTS", precision: 5, issuer: "1.2.3", flags: 0}
};
jest.mock("../../../actions/AdvancedActions", () => ({
    __esModule: true,
    default: {
        getAccountByName: async (name: string) =>
            mockAccounts[name] ? {id: mockAccounts[name], name} : null,
        getAccountById: async (id: string) => {
            const name = Object.keys(mockAccounts).find(
                n => mockAccounts[n] === id
            );
            return name ? {id, name} : null;
        },
        getAssetBySymbol: async (symbol: string) => mockAssets[symbol] || null,
        getAssetById: async (id: string) =>
            Object.keys(mockAssets)
                .map(k => mockAssets[k])
                .find(a => a.id === id) || null,
        getAccountIds: async (names: string[]) =>
            Object.fromEntries(names.map(n => [n, mockAccounts[n] || null])),
        getAssetIds: async (symbols: string[]) =>
            Object.fromEntries(
                symbols.map(s => [s, mockAssets[s] ? mockAssets[s].id : null])
            ),
        getCommitteeMember: (...a: any[]) => mock.getCommitteeMember(...a),
        getParameters: (...a: any[]) => mock.getParameters(...a),
        getFund: (...a: any[]) => mock.getFund(...a),
        send: (...a: any[]) => mock.send(...a),
        propose: (...a: any[]) => mock.propose(...a)
    }
}));
jest.mock("../../../design-system/Notification", () => ({
    Notification: {
        success: jest.fn(),
        error: jest.fn(),
        warning: jest.fn(),
        info: jest.fn()
    }
}));

import {reduxStore} from "../../../store/reduxStore";
import {patchState} from "../../../store/slices/accountSlice";
import AdvancedPage from "../../../components/Advanced/AdvancedPage";
import AccountTransferDialog from "../../../components/Advanced/AccountTransferDialog";
import AssertDialog from "../../../components/Advanced/AssertDialog";
import BlindTransferDialog from "../../../components/Advanced/BlindTransferDialog";
import CommitteeMemberDialog from "../../../components/Advanced/CommitteeMemberDialog";
import CustomDataDialog from "../../../components/Advanced/CustomDataDialog";
import FlashLoanDialog from "../../../components/Advanced/FlashLoanDialog";
import OperationJsonDialog from "../../../components/Advanced/OperationJsonDialog";
import OverrideTransferDialog from "../../../components/Advanced/OverrideTransferDialog";

const vector = (name: string) => (vectors as any)[name];

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    Object.values(mock).forEach(fn => fn.mockReset());
    mock.send.mockResolvedValue(undefined);
    mock.propose.mockResolvedValue(undefined);
    mock.getParameters.mockResolvedValue({max_predicate_opcode: 1});
    reduxStore.dispatch(patchState({currentAccount: "alice"} as any));
});

// let what a test started finish before its document goes away
afterEach(async () => {
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 60));
    });
});

// (this jsdom has no MutationObserver, so no waitFor: poll under act)
const until = async (check: () => boolean) => {
    for (let i = 0; i < 200 && !check(); i++) {
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
        });
    }
    expect(check()).toBe(true);
};
const text = () => document.body.textContent || "";
const button = (name: string) =>
    screen.getByRole("button", {name}) as HTMLButtonElement;
const field = (label: string) =>
    screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) =>
    fireEvent.change(field(label), {target: {value}});

const open = (ui: React.ReactElement) =>
    render(<MemoryRouter>{ui}</MemoryRouter>);
const noop = () => undefined;

describe("AdvancedPage", () => {
    it("has a card for each operation, in its section, with the chain's names", () => {
        open(<AdvancedPage />);
        const page = text();
        [
            "Custom authorities",
            "Custom data",
            "Assertion",
            "Transfer account",
            "Override transfer",
            "Update committee member",
            "Propose chain parameters",
            "Flash loan",
            "Blind transfers",
            "Operation from JSON"
        ].forEach(title => expect(page).toContain(title));
        [
            "Your account",
            "Assets",
            "Committee",
            "Flash loans",
            "Confidential"
        ].forEach(section => expect(page).toContain(section));
        [
            "54 55 56",
            "35",
            "36",
            "9",
            "38",
            "30",
            "31",
            "67 68",
            "39 40 41"
        ].forEach(ids => expect(page).toContain(ids));
        expect(page).toContain("samet_fund_borrow + samet_fund_repay");
        expect(page).toContain("You act as alice");
    });

    it("cannot be used without an account", () => {
        reduxStore.dispatch(
            patchState({currentAccount: null, passwordAccount: null} as any)
        );
        open(<AdvancedPage />);
        expect(text()).toContain("Log in to use these");
        expect(button("Write data").disabled).toBe(true);
    });

    it("opens a card's dialog and closes it again", async () => {
        open(<AdvancedPage />);
        fireEvent.click(button("Write data"));
        await until(() => text().includes("Pays the fee and sends: alice"));
        fireEvent.click(button("Cancel"));
        await until(() => !text().includes("Pays the fee and sends"));
    });
});

describe("AccountTransferDialog", () => {
    it("says the chain does not accept it, and sends it once the new owner is found", async () => {
        open(<AccountTransferDialog onCancel={noop} onDone={noop} />);
        expect(text()).toContain("The chain does not accept this");
        expect(button("Transfer account").disabled).toBe(true);
        type("New owner", "bob");
        await until(() => text().includes("bob (1.2.101)"));
        await until(() => !button("Transfer account").disabled);
        fireEvent.click(button("Transfer account"));
        await until(() => mock.send.mock.calls.length === 1);
        expect(mock.send.mock.calls[0][0]).toEqual([
            [
                "account_transfer",
                {
                    fee: {amount: 0, asset_id: "1.3.0"},
                    account_id: "1.2.100",
                    new_owner: "1.2.101",
                    extensions: []
                }
            ]
        ]);
    });

    it("keeps Send shut for an account that does not exist", async () => {
        open(<AccountTransferDialog onCancel={noop} onDone={noop} />);
        type("New owner", "nobody");
        await until(() => text().includes("Not found"));
        expect(button("Transfer account").disabled).toBe(true);
    });
});

describe("CommitteeMemberDialog", () => {
    it("starts with the url the member has, and sends a new one", async () => {
        mock.getCommitteeMember.mockResolvedValue({
            id: "1.5.3",
            url: "https://old.example"
        });
        open(<CommitteeMemberDialog onCancel={noop} onDone={noop} />);
        await until(() => text().includes("committee member 1.5.3"));
        expect(field("Url").value).toBe("https://old.example");
        // nothing is different yet
        expect(button("Update").disabled).toBe(true);
        type("Url", "https://new.example/c");
        await until(() => !button("Update").disabled);
        fireEvent.click(button("Update"));
        await until(() => mock.send.mock.calls.length === 1);
        expect(mock.send.mock.calls[0][0]).toEqual([
            [
                "committee_member_update",
                {
                    fee: {amount: 0, asset_id: "1.3.0"},
                    committee_member: "1.5.3",
                    committee_member_account: "1.2.100",
                    new_url: "https://new.example/c"
                }
            ]
        ]);
        expect(mock.getCommitteeMember).toHaveBeenCalledWith("1.2.100");
    });

    it("says so when the account is no committee member", async () => {
        mock.getCommitteeMember.mockResolvedValue(null);
        open(<CommitteeMemberDialog onCancel={noop} onDone={noop} />);
        await until(() =>
            text().includes("This account is not a committee member.")
        );
        expect(button("Update").disabled).toBe(true);
    });

    it("refuses a url that is too long", async () => {
        mock.getCommitteeMember.mockResolvedValue({id: "1.5.3", url: ""});
        open(<CommitteeMemberDialog onCancel={noop} onDone={noop} />);
        await until(() => text().includes("committee member 1.5.3"));
        type("Url", "x".repeat(127));
        await until(() => text().includes("too long"));
        expect(button("Update").disabled).toBe(true);
    });
});

describe("CustomDataDialog", () => {
    it("turns the text into bytes and names the accounts that must sign", async () => {
        open(<CustomDataDialog onCancel={noop} onDone={noop} />);
        await until(() => text().includes("Pays the fee and sends: alice"));
        type("Number", "7");
        type("Data", "hi");
        type("Accounts that must sign too", "bob, carol");
        await until(() => !button("Send").disabled);
        fireEvent.click(button("Send"));
        await until(() => mock.send.mock.calls.length === 1);
        const [[name, op]] = mock.send.mock.calls[0][0];
        expect(name).toBe("custom");
        expect(op).toMatchObject({
            payer: "1.2.100",
            id: 7,
            data: "6869"
        });
        expect(op.required_auths.sort()).toEqual(["1.2.101", "1.2.102"]);
    });

    it("waits for the accounts to be found, and refuses one that is not there", async () => {
        open(<CustomDataDialog onCancel={noop} onDone={noop} />);
        type("Accounts that must sign too", "bob, ghost");
        await until(() => text().includes("Not found: ghost"));
        expect(button("Send").disabled).toBe(true);
    });
});

describe("AssertDialog", () => {
    it("offers only the conditions the chain allows, and sends the assertion", async () => {
        open(<AssertDialog onCancel={noop} onDone={noop} />);
        await until(() => text().includes("allows only the first 1 kind"));
        expect(text()).toContain("An account has this name");
        type("Account name", "bob");
        await until(() => text().includes("Account 1.2.101"));
        await until(() => !button("Send").disabled);
        fireEvent.click(button("Send"));
        await until(() => mock.send.mock.calls.length === 1);
        expect(mock.send.mock.calls[0][0]).toEqual([
            [
                "assert",
                {
                    fee: {amount: 0, asset_id: "1.3.0"},
                    fee_paying_account: "1.2.100",
                    predicates: [[0, {account_id: "1.2.101", name: "bob"}]],
                    required_auths: [],
                    extensions: []
                }
            ]
        ]);
    });

    it("cannot be sent with a condition that is not found", async () => {
        open(<AssertDialog onCancel={noop} onDone={noop} />);
        type("Account name", "ghost");
        await until(() => text().includes("Not found"));
        expect(button("Send").disabled).toBe(true);
    });

    it("puts the operations that follow into the same transaction", async () => {
        open(<AssertDialog onCancel={noop} onDone={noop} />);
        type("Account name", "bob");
        await until(() => !button("Send").disabled);
        fireEvent.click(button("Add an operation"));
        await until(() => text().includes("Fields of transfer"));
        fireEvent.click(button("Send"));
        await until(() => mock.send.mock.calls.length === 1);
        expect(mock.send.mock.calls[0][0].map((s: any) => s[0])).toEqual([
            "assert",
            "transfer"
        ]);
    });
});

describe("OverrideTransferDialog", () => {
    const fill = async (symbol: string) => {
        open(<OverrideTransferDialog onCancel={noop} onDone={noop} />);
        await until(() => text().includes("Issuer: alice"));
        type("Asset", symbol);
        await until(() => text().includes("decimals"));
        type("Take from", "bob");
        type("Give to", "carol");
        type("Amount", "1.5");
        await until(() => text().includes("carol (1.2.102)"));
    };

    it("says when the asset does not allow overriding", async () => {
        await fill("USD");
        expect(text()).toContain("does not allow its issuer to override");
        expect(button("Override").disabled).toBe(true);
    });

    it("says when the asset is someone else's", async () => {
        await fill("OTHER");
        expect(text()).toContain("You are not the issuer");
        expect(button("Override").disabled).toBe(true);
    });

    it("sends the override for an asset that allows it", async () => {
        await fill("GOLD");
        await until(() => !button("Override").disabled);
        fireEvent.click(button("Override"));
        await until(() => mock.send.mock.calls.length === 1);
        expect(mock.send.mock.calls[0][0]).toEqual([
            [
                "override_transfer",
                {
                    fee: {amount: 0, asset_id: "1.3.0"},
                    issuer: "1.2.100",
                    from: "1.2.101",
                    to: "1.2.102",
                    amount: {amount: "15000", asset_id: "1.3.130"},
                    extensions: []
                }
            ]
        ]);
    });
});

describe("BlindTransferDialog", () => {
    it("sends the blind transfer pieces another tool made, as the operation", async () => {
        const sample = vector("transfer_to_blind").op[1];
        open(<BlindTransferDialog onCancel={noop} onDone={noop} />);
        type("Asset", "BTS");
        await until(() => text().includes("decimals"));
        type("Amount", "0.01");
        type("Blinding factor", sample.blinding_factor);
        fireEvent.change(field("Outputs (JSON list)"), {
            target: {value: JSON.stringify(sample.outputs.slice(0, 1))}
        });
        await until(() => !button("Send into blinded balances").disabled);
        fireEvent.click(button("Send into blinded balances"));
        await until(() => mock.send.mock.calls.length === 1);
        const [[name, op]] = mock.send.mock.calls[0][0];
        expect(name).toBe("transfer_to_blind");
        expect(op.from).toBe("1.2.100");
        expect(op.amount).toEqual({amount: "1000", asset_id: "1.3.0"});
    });

    it("says what is wrong with the pieces", async () => {
        const sample = vector("transfer_to_blind").op[1];
        open(<BlindTransferDialog onCancel={noop} onDone={noop} />);
        type("Asset", "BTS");
        await until(() => text().includes("decimals"));
        type("Amount", "1");
        type("Blinding factor", "00");
        fireEvent.change(field("Outputs (JSON list)"), {
            target: {value: "[]"}
        });
        await until(() =>
            text().includes("blinding_factor is not hexadecimal")
        );
        expect(button("Send into blinded balances").disabled).toBe(true);
        type("Blinding factor", sample.blinding_factor);
        fireEvent.change(field("Outputs (JSON list)"), {
            target: {value: "nope"}
        });
        await until(() => text().includes("This is not valid"));
        expect(button("Send into blinded balances").disabled).toBe(true);
        expect(mock.send).not.toHaveBeenCalled();
    });
});

describe("FlashLoanDialog", () => {
    beforeEach(() => {
        mock.getFund.mockImplementation(async (id: string) =>
            id === "1.20.2"
                ? {
                      id,
                      asset_type: "1.3.0",
                      balance: "1000000",
                      unpaid_amount: "0",
                      fee_rate: 300
                  }
                : null
        );
    });

    const fill = async () => {
        open(<FlashLoanDialog onCancel={noop} onDone={noop} />);
        type("Fund", "2");
        await until(() => text().includes("Available to borrow"));
        type("Amount to borrow (BTS)", "1");
    };

    it("shows the fund, the fee, and sends the borrow and the repay", async () => {
        await fill();
        // 1 BTS = 100000 units; 300/1e6 of it is 30 units
        await until(() => text().includes("Repaying costs 0.00030 BTS"));
        expect(text()).toContain("0.03%");
        await until(() => !button("Borrow and repay").disabled);
        fireEvent.click(button("Borrow and repay"));
        await until(() => mock.send.mock.calls.length === 1);
        const operations = mock.send.mock.calls[0][0];
        expect(operations.map((s: any) => s[0])).toEqual([
            "samet_fund_borrow",
            "samet_fund_repay"
        ]);
        expect(operations[0][1].borrow_amount).toEqual({
            amount: "100000",
            asset_id: "1.3.0"
        });
        expect(operations[1][1].fund_fee).toEqual({
            amount: "30",
            asset_id: "1.3.0"
        });
        expect(operations[1][1].repay_amount).toEqual({
            amount: "100000",
            asset_id: "1.3.0"
        });
    });

    it("runs the operations added in between, in order", async () => {
        await fill();
        await until(() => !button("Borrow and repay").disabled);
        fireEvent.click(button("Add an operation"));
        await until(() => text().includes("Fields of transfer"));
        fireEvent.click(button("Borrow and repay"));
        await until(() => mock.send.mock.calls.length === 1);
        expect(mock.send.mock.calls[0][0].map((s: any) => s[0])).toEqual([
            "samet_fund_borrow",
            "transfer",
            "samet_fund_repay"
        ]);
    });

    it("refuses more than the fund can lend, and a fund that does not exist", async () => {
        await fill();
        type("Amount to borrow (BTS)", "11");
        await until(() => text().includes("does not hold that much"));
        expect(button("Borrow and repay").disabled).toBe(true);
        type("Fund", "9");
        await until(() => text().includes("There is no such fund."));
        expect(button("Borrow and repay").disabled).toBe(true);
    });
});

describe("OperationJsonDialog", () => {
    it("sends the operation as it is written, with its fee left to the transaction", async () => {
        open(<OperationJsonDialog onCancel={noop} onDone={noop} />);
        await until(() => !button("Send").disabled);
        fireEvent.click(button("Send"));
        await until(() => mock.send.mock.calls.length === 1);
        const [[name, op]] = mock.send.mock.calls[0][0];
        expect(name).toBe("transfer");
        expect(op.fee).toEqual({amount: 0, asset_id: "1.3.0"});
        expect(op.amount).toEqual({amount: "0", asset_id: "1.3.0"});
    });

    it("says where it cannot be read, and sends nothing", async () => {
        open(<OperationJsonDialog onCancel={noop} onDone={noop} />);
        fireEvent.change(field("Fields (JSON)"), {
            target: {value: '{"from": "alice"}'}
        });
        await until(() => text().includes("This is not valid"));
        expect(button("Send").disabled).toBe(true);
        expect(mock.send).not.toHaveBeenCalled();
    });

    it("proposes it from the current account instead, when asked", async () => {
        open(<OperationJsonDialog onCancel={noop} onDone={noop} />);
        fireEvent.click(screen.getByLabelText(/Propose it from alice/));
        await until(() => !button("Propose").disabled);
        fireEvent.click(button("Propose"));
        await until(() => mock.propose.mock.calls.length === 1);
        const proposal = mock.propose.mock.calls[0][0];
        expect(proposal.fee_paying_account).toBe("1.2.100");
        expect(proposal.proposed_ops[0].op[0]).toBe(0);
        expect(mock.send).not.toHaveBeenCalled();
    });
});
