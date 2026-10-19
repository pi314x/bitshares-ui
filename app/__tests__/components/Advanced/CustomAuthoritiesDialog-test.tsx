import * as React from "react";
import {render, fireEvent, act, screen} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../../assets/locales/locale-en.json";

const mock = {
    getParameters: jest.fn(),
    getHeadTime: jest.fn(),
    getCustomAuthorities: jest.fn(),
    send: jest.fn()
};
const mockAccounts: Record<string, string> = {
    alice: "1.2.100",
    bob: "1.2.101",
    carol: "1.2.102"
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
        getAccountIds: async (names: string[]) =>
            Object.fromEntries(names.map(n => [n, mockAccounts[n] || null])),
        getAssetIds: async (symbols: string[]) =>
            Object.fromEntries(
                symbols.map(s => [s, s === "USD" ? "1.3.121" : null])
            ),
        getParameters: (...a: any[]) => mock.getParameters(...a),
        getHeadTime: (...a: any[]) => mock.getHeadTime(...a),
        getCustomAuthorities: (...a: any[]) => mock.getCustomAuthorities(...a),
        send: (...a: any[]) => mock.send(...a)
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
import CustomAuthoritiesDialog from "../../../components/Advanced/CustomAuthoritiesDialog";

const LIMITS = {
    max_custom_authority_lifetime_seconds: 365 * 86400,
    max_custom_authorities_per_account: 10,
    max_custom_authorities_per_account_op: 5,
    max_custom_authority_restrictions: 10
};
const NOW = Math.floor(Date.now() / 1000);
const stored = {
    id: "1.17.4",
    account: "1.2.100",
    enabled: true,
    validFrom: new Date((NOW - 86400) * 1000).toISOString().slice(0, 19),
    validTo: new Date((NOW + 86400 * 30) * 1000).toISOString().slice(0, 19),
    operationType: 0,
    auth: {
        weight_threshold: 1,
        account_auths: [["1.2.101", 1]],
        key_auths: [],
        address_auths: []
    },
    restrictions: [
        [
            0,
            {
                member_index: 2,
                restriction_type: 0,
                argument: [7, "1.2.102"],
                extensions: []
            }
        ],
        [
            1,
            {
                member_index: 3,
                restriction_type: 10,
                argument: [
                    39,
                    [
                        {
                            member_index: 1,
                            restriction_type: 0,
                            argument: [8, "1.3.121"],
                            extensions: []
                        }
                    ]
                ],
                extensions: []
            }
        ]
    ]
};

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    Object.values(mock).forEach(fn => fn.mockReset());
    mock.getHeadTime.mockResolvedValue(NOW);
    mock.getParameters.mockResolvedValue({
        extensions: {custom_authority_options: LIMITS}
    });
    mock.getCustomAuthorities.mockResolvedValue([stored]);
    mock.send.mockResolvedValue(undefined);
    reduxStore.dispatch(patchState({currentAccount: "alice"} as any));
});

afterEach(async () => {
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 60));
    });
});

const until = async (check: () => boolean) => {
    for (let i = 0; i < 300 && !check(); i++) {
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
        });
    }
    expect(check()).toBe(true);
};
const text = () => document.body.textContent || "";
const button = (name: string) =>
    screen.getByRole("button", {name}) as HTMLButtonElement;
const input = (label: string) =>
    screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) =>
    fireEvent.change(input(label), {target: {value}});
const noop = () => undefined;

const openList = async () => {
    render(<CustomAuthoritiesDialog onCancel={noop} />);
    await until(() => text().includes("1.17.4"));
};

describe("the list", () => {
    it("shows an authority with its operation, its dates, who signs and what it restricts", async () => {
        await openList();
        const shown = text();
        expect(shown).toContain("0 transfer");
        expect(shown).toContain("In force");
        expect(shown).toContain("1.2.101 (1)");
        expect(shown).toContain("#0 to eq 1.2.102");
        expect(shown).toContain("#1 amount.asset_id eq 1.3.121");
        expect(mock.getCustomAuthorities).toHaveBeenCalledWith("1.2.100", []);
    });

    it("says there are none, and finds one added by its id", async () => {
        mock.getCustomAuthorities.mockResolvedValue([]);
        render(<CustomAuthoritiesDialog onCancel={noop} />);
        await until(() => text().includes("None found"));
        mock.getCustomAuthorities.mockResolvedValue([stored]);
        type("Add by id", "1.17.4");
        fireEvent.click(button("Add by id"));
        await until(() => text().includes("#0 to eq 1.2.102"));
        expect(mock.getCustomAuthorities).toHaveBeenLastCalledWith("1.2.100", [
            "1.17.4"
        ]);
    });
});

describe("delete", () => {
    it("asks first, then sends the delete", async () => {
        await openList();
        fireEvent.click(button("Delete"));
        await until(() => text().includes("Delete custom authority 1.17.4"));
        expect(mock.send).not.toHaveBeenCalled();
        // the confirm button of the dialog (the card's is behind it)
        const confirm = screen.getAllByRole("button", {name: "Delete"}).pop()!;
        fireEvent.click(confirm);
        await until(() => mock.send.mock.calls.length === 1);
        expect(mock.send.mock.calls[0][0]).toEqual([
            [
                "custom_authority_delete",
                {
                    fee: {amount: 0, asset_id: "1.3.0"},
                    account: "1.2.100",
                    authority_to_delete: "1.17.4",
                    extensions: []
                }
            ]
        ]);
    });
});

describe("create", () => {
    it("says a chain without custom authorities refuses a new one", async () => {
        mock.getParameters.mockResolvedValue({extensions: {}});
        await openList();
        fireEvent.click(button("New authority"));
        await until(() =>
            text().includes("has not switched custom authorities on")
        );
        type("Accounts that may sign", "bob");
        expect(button("Create").disabled).toBe(true);
    });

    it("sends the authority with the restrictions it was given, names turned into ids", async () => {
        await openList();
        fireEvent.click(button("New authority"));
        await until(() => text().includes("Accounts that may sign"));
        type("Accounts that may sign", "bob 2");
        type("Threshold", "2");
        fireEvent.click(button("Add a restriction"));
        // the first field is the fee's asset: choose the receiver
        fireEvent.click(screen.getByText("fee.asset_id"));
        fireEvent.click(screen.getByText("to"));
        fireEvent.change(screen.getByPlaceholderText("Value"), {
            target: {value: "carol"}
        });
        await until(() => !button("Create").disabled);
        fireEvent.click(button("Create"));
        await until(() => mock.send.mock.calls.length === 1);
        const [[name, op]] = mock.send.mock.calls[0][0];
        expect(name).toBe("custom_authority_create");
        expect(op).toMatchObject({
            account: "1.2.100",
            enabled: true,
            operation_type: 0,
            auth: {
                weight_threshold: 2,
                account_auths: [["1.2.101", 2]],
                key_auths: []
            },
            restrictions: [
                {member_index: 2, restriction_type: 0, argument: [7, "1.2.102"]}
            ]
        });
        expect(op.valid_to > op.valid_from).toBe(true);
    });

    it("keeps Create shut for an authority nobody can sign, and for a name that is not there", async () => {
        await openList();
        fireEvent.click(button("New authority"));
        await until(() => text().includes("Accounts that may sign"));
        expect(button("Create").disabled).toBe(true);
        type("Accounts that may sign", "ghost");
        await until(() => text().includes("Not found: ghost"));
        expect(button("Create").disabled).toBe(true);
    });
});

describe("change", () => {
    it("sends only what was changed: the state, and a restriction removed", async () => {
        await openList();
        fireEvent.click(button("Change"));
        await until(() => text().includes("Change custom authority"));
        expect(button("Save").disabled).toBe(true);
        fireEvent.click(screen.getByLabelText("Enabled"));
        fireEvent.click(screen.getByLabelText("#1 amount.asset_id eq 1.3.121"));
        await until(() => !button("Save").disabled);
        fireEvent.click(button("Save"));
        await until(() => mock.send.mock.calls.length === 1);
        const [[name, op]] = mock.send.mock.calls[0][0];
        expect(name).toBe("custom_authority_update");
        expect(op).toMatchObject({
            account: "1.2.100",
            authority_to_update: "1.17.4",
            new_enabled: false,
            restrictions_to_remove: [1],
            restrictions_to_add: []
        });
        expect(op.new_auth).toBeUndefined();
        expect(op.new_valid_from).toBeUndefined();
        expect(op.new_valid_to).toBeUndefined();
    });
});
