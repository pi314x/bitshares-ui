// HelpContent uses webpack's `require.context`, which Jest does not have
jest.mock("../../../components/Utility/HelpContent", () => () => null);

import * as React from "react";
import {render, fireEvent, act, screen} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../../assets/locales/locale-en.json";

const mockGetByAccount = jest.fn();
const mockUpdate = jest.fn();
jest.mock("../../../actions/TicketActions", () => ({
    __esModule: true,
    default: {
        getByAccount: (...a: any[]) => mockGetByAccount(...a),
        update: (...a: any[]) => mockUpdate(...a)
    }
}));

import TicketsList, {
    toStepsText
} from "../../../components/Account/TicketsList";

const ticket = {
    id: "1.18.4",
    account: "1.2.100",
    targetType: 2,
    currentType: 1,
    status: "charging",
    assetId: "1.3.0",
    amount: "5000000",
    value: "20000000",
    nextUpdate: "2026-11-01T00:00:00"
};

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

// let what a test started finish before its document goes away
afterEach(async () => {
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 60));
    });
});

beforeEach(() => {
    mockGetByAccount.mockReset();
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(undefined);
});

// (this jsdom has no MutationObserver, so no waitFor: poll under act)
const until = async (check: () => boolean) => {
    for (let i = 0; i < 100 && !check(); i++) {
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
        });
    }
    expect(check()).toBe(true);
};

describe("toStepsText", () => {
    it("turns a human amount into the smallest steps, as text", () => {
        expect(toStepsText("12.5", 5)).toBe("1250000");
        expect(toStepsText("0.00001", 5)).toBe("1");
        expect(toStepsText("3", 2)).toBe("300");
        expect(toStepsText("1,5", 1)).toBe("15");
    });

    it("refuses what is not an amount or has too many decimals", () => {
        expect(toStepsText("", 5)).toBeNull();
        expect(toStepsText("abc", 5)).toBeNull();
        expect(toStepsText("-1", 5)).toBeNull();
        expect(toStepsText("1.123456", 5)).toBeNull();
    });
});

describe("TicketsList", () => {
    it("shows nothing for an account without locks", async () => {
        mockGetByAccount.mockResolvedValue([]);
        const {container} = render(
            <TicketsList account="1.2.100" canChange={true} />
        );
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        expect(container.textContent).toBe("");
    });

    it("lists a lock with its type, its target and its next change", async () => {
        mockGetByAccount.mockResolvedValue([ticket]);
        const {container} = render(
            <TicketsList account="1.2.100" canChange={false} />
        );
        await until(() => (container.textContent || "").includes("1.18.4"));
        const text = container.textContent || "";
        expect(text).toContain("Your locks");
        expect(text).toContain("Claimable 180 days after unlock request");
        expect(text).toContain("Claimable 360 days after unlock request");
        expect(text).toContain("Charging");
        expect(text).toContain("2026-11-01 00:00:00");
        // someone else's locks cannot be changed from here
        expect(screen.queryByRole("button", {name: "Change"})).toBeNull();
    });

    it("changes a whole lock to another type", async () => {
        mockGetByAccount.mockResolvedValue([ticket]);
        render(<TicketsList account="1.2.100" canChange={true} />);
        await until(
            () => screen.queryByRole("button", {name: "Change"}) !== null
        );
        fireEvent.click(screen.getByRole("button", {name: "Change"}));
        await until(
            () => screen.queryByRole("button", {name: "Change lock"}) !== null
        );
        const submit = screen.getByRole("button", {name: "Change lock"});
        await until(() => (submit as HTMLButtonElement).disabled === false);
        fireEvent.click(submit);
        await until(() => mockUpdate.mock.calls.length === 1);
        const op = mockUpdate.mock.calls[0][0];
        expect(op.ticket).toBe("1.18.4");
        expect(op.account).toBe("1.2.100");
        // the first target offered: Liquid (the present target is 360 days)
        expect(op.target_type).toBe(0);
        expect(op.amount_for_new_target).toBeUndefined();
    });
});
