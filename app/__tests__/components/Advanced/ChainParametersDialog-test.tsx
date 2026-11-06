import * as React from "react";
import {render, fireEvent, act, screen} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../../assets/locales/locale-en.json";
import vectors from "../../fixtures/coreOperationVectors.json";

const mock = {getParameters: jest.fn(), propose: jest.fn()};
jest.mock("../../../actions/AdvancedActions", () => ({
    __esModule: true,
    default: {
        getAccountByName: async (name: string) =>
            name === "alice" ? {id: "1.2.100", name} : null,
        getAccountById: async (id: string) =>
            id === "1.2.100" ? {id, name: "alice"} : null,
        getParameters: (...a: any[]) => mock.getParameters(...a),
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
import ChainParametersDialog from "../../../components/Advanced/ChainParametersDialog";

const LIVE = (vectors as any)["committee_member_update_global_parameters"].op[1]
    .new_parameters;

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    mock.getParameters.mockReset();
    mock.propose.mockReset();
    mock.getParameters.mockResolvedValue(JSON.parse(JSON.stringify(LIVE)));
    mock.propose.mockResolvedValue(undefined);
    reduxStore.dispatch(patchState({currentAccount: "alice"} as any));
});

afterEach(async () => {
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 60));
    });
});

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
const input = (label: string) =>
    screen.getByLabelText(label) as HTMLInputElement;
const noop = () => undefined;

describe("ChainParametersDialog", () => {
    it("shows the parameters as the chain has them, grouped", async () => {
        render(<ChainParametersDialog onCancel={noop} onDone={noop} />);
        await until(() => text().includes("block_interval"));
        expect(input("block_interval").value).toBe("3");
        expect(input("maker_fee_discount_percent").value).toBe("9600");
        expect(input("market_fee_network_percent").value).toBe("");
        [
            "Blocks and time",
            "Limits",
            "Fees",
            "Pay",
            "Voting",
            "HTLC"
        ].forEach(group => expect(text()).toContain(group));
        // nothing edited, nothing to propose
        expect(button("Propose").disabled).toBe(true);
    });

    it("proposes the change from the current account, the fee schedule as it was", async () => {
        render(<ChainParametersDialog onCancel={noop} onDone={noop} />);
        await until(() => text().includes("block_interval"));
        fireEvent.change(input("block_interval"), {target: {value: "5"}});
        await until(() =>
            text().includes("The proposal changes: block_interval")
        );
        fireEvent.click(button("Propose"));
        await until(() => mock.propose.mock.calls.length === 1);
        const proposal = mock.propose.mock.calls[0][0];
        expect(proposal.fee_paying_account).toBe("1.2.100");
        const [id, operation] = proposal.proposed_ops[0].op;
        expect(id).toBe(31);
        expect(operation.new_parameters.block_interval).toBe(5);
        expect(operation.new_parameters.maintenance_interval).toBe(3600);
        expect(operation.new_parameters.current_fees).toEqual(
            LIVE.current_fees
        );
    });

    it("says what the chain would refuse, and sends nothing", async () => {
        render(<ChainParametersDialog onCancel={noop} onDone={noop} />);
        await until(() => text().includes("block_interval"));
        // 3600 is not a multiple of 7
        fireEvent.change(input("block_interval"), {target: {value: "7"}});
        await until(() =>
            text().includes("The value of maintenance_interval is not allowed.")
        );
        expect(button("Propose").disabled).toBe(true);
        expect(mock.propose).not.toHaveBeenCalled();
    });

    it("says so when the node cannot be reached", async () => {
        mock.getParameters.mockRejectedValue(new Error("down"));
        render(<ChainParametersDialog onCancel={noop} onDone={noop} />);
        await until(() => text().includes("Could not reach the node"));
        expect(button("Propose").disabled).toBe(true);
    });
});
