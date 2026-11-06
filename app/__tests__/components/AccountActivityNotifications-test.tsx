import * as React from "react";
import {act, render} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";
import {
    clearNotifications,
    getNotifications,
    reloadNotifications
} from "../../lib/common/notificationHistory";

let mockHistory: any[] = [];

jest.mock("bitsharesjs", () => ({
    ChainStore: {
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        getAccount: () =>
            jest
                .requireActual("immutable")
                .fromJS({id: "1.2.10", history: mockHistory})
    },
    ChainTypes: {
        operations: {
            transfer: 0,
            limit_order_create: 1,
            fill_order: 4,
            asset_settle: 17,
            made_up_operation: 55
        }
    }
}));
let mockAccountState: any = {currentAccount: "me"};
jest.mock("../../next/hooks/useReduxState", () => ({
    useReduxState: () => mockAccountState
}));
const mockTelegram = jest.fn();
jest.mock("../../lib/common/telegram", () => ({
    ...jest.requireActual("../../lib/common/telegram"),
    telegramNotify: (...args: any[]) => mockTelegram(...args)
}));
jest.mock("../../actions/SametFundActions", () => ({
    __esModule: true,
    default: {
        getAssets: (ids: string[]) =>
            Promise.resolve(
                ids.reduce((all: any, id) => {
                    all[id] = {
                        id,
                        symbol: id === "1.3.0" ? "BTS" : "USD",
                        precision: 5
                    };
                    return all;
                }, {})
            ),
        getAccounts: (ids: string[]) =>
            Promise.resolve(
                ids.reduce((all: any, id) => {
                    all[id] = {id, name: id === "1.2.10" ? "me" : "alice"};
                    return all;
                }, {})
            )
    }
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

import AccountActivityNotifications, {
    TelegramActivity
} from "../../components/Notifications/AccountActivityNotifications";
import {DEFAULT_TELEGRAM, saveTelegram} from "../../lib/common/telegram";

const op = (n: number, code: number, data: any, result?: any) => ({
    id: `1.11.${n}`,
    op: [code, data],
    result
});
const bts = (units: number) => ({
    amount: String(units * 1e5),
    asset_id: "1.3.0"
});

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    window.localStorage.clear();
    clearNotifications();
    reloadNotifications();
    mockToast.mockClear();
    mockTelegram.mockClear();
    mockAccountState = {currentAccount: "me"};
});

// the names are asked for first: let those requests finish before looking
const settle = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
    });

const titles = () => getNotifications().map(n => n.title);

describe("AccountActivityNotifications", () => {
    it("announces nothing for what was there when the user first came", () => {
        mockHistory = [
            op(5, 0, {from: "1.2.99", to: "1.2.10", amount: bts(1)})
        ];
        render(<AccountActivityNotifications />);
        expect(getNotifications()).toHaveLength(0);
        expect(mockToast).not.toHaveBeenCalled();
        expect(
            window.localStorage.getItem("__graphene__lastActivityNotified_me")
        ).toBe("5");
    });

    it("puts a settlement the account asked for in the history, without a toast of its own", async () => {
        mockHistory = [
            op(5, 0, {from: "1.2.99", to: "1.2.10", amount: bts(1)})
        ];
        const view = render(<AccountActivityNotifications />);
        mockHistory = [
            op(
                6,
                17,
                {
                    account: "1.2.10",
                    amount: {amount: "30000", asset_id: "1.3.5"}
                },
                [1, "1.4.2"]
            ),
            ...mockHistory
        ];
        view.rerender(<AccountActivityNotifications />);
        await settle();
        expect(getNotifications()).toHaveLength(1);
        expect(getNotifications()[0]).toMatchObject({
            kind: "info",
            title: "Settlement",
            description: "Settlement of 0.30000 USD requested"
        });
        expect(mockToast).not.toHaveBeenCalled();
    });

    it("toasts what happened to the account, and keeps it in the history", async () => {
        mockHistory = [
            op(5, 0, {from: "1.2.99", to: "1.2.10", amount: bts(1)})
        ];
        const view = render(<AccountActivityNotifications />);
        mockHistory = [
            op(6, 0, {from: "1.2.99", to: "1.2.10", amount: bts(2)}),
            ...mockHistory
        ];
        view.rerender(<AccountActivityNotifications />);
        await settle();
        expect(mockToast).toHaveBeenCalledTimes(1);
        expect(mockToast).toHaveBeenCalledWith("success", {
            message: "Transfer",
            description: "Received 2.00000 BTS from alice"
        });
        // the toast records itself in the history (the design system does that)
        expect(getNotifications()).toHaveLength(0);
    });

    it("announces everything that happened while the page was closed, each once", async () => {
        window.localStorage.setItem("__graphene__lastActivityNotified_me", "5");
        mockHistory = [
            op(8, 4, {
                account_id: "1.2.10",
                order_id: "1.4.9",
                pays: {amount: "10000", asset_id: "1.3.5"},
                receives: bts(3)
            }),
            op(7, 1, {
                seller: "1.2.10",
                amount_to_sell: bts(1),
                min_to_receive: bts(2)
            }),
            op(6, 0, {from: "1.2.10", to: "1.2.99", amount: bts(1)}),
            op(5, 0, {from: "1.2.99", to: "1.2.10", amount: bts(1)})
        ];
        const view = render(<AccountActivityNotifications />);
        await settle();
        expect(mockToast).toHaveBeenCalledTimes(1);
        // the settlement fill is a toast (the chain did it); the two the account started are in the history
        expect(mockToast.mock.calls[0][1].message).toBe("Settlement");
        expect(titles().sort()).toEqual(["Place order", "Transfer"]);
        // a second look at the same history says nothing more
        view.rerender(<AccountActivityNotifications />);
        await settle();
        expect(mockToast).toHaveBeenCalledTimes(1);
        expect(getNotifications()).toHaveLength(2);
        expect(
            window.localStorage.getItem("__graphene__lastActivityNotified_me")
        ).toBe("8");
    });

    it("names an operation the locale has no name for by the chain's own name, not by a missing-translation text", async () => {
        mockHistory = [
            op(5, 0, {from: "1.2.99", to: "1.2.10", amount: bts(1)})
        ];
        const view = render(<AccountActivityNotifications />);
        mockHistory = [op(6, 55, {account: "1.2.10"}), ...mockHistory];
        view.rerender(<AccountActivityNotifications />);
        await settle();
        expect(titles()).toEqual(["made_up_operation"]);
        expect(titles().join(" ")).not.toContain("missing translation");
    });

    it("tells Telegram what happened, with its topic and the page of the transaction, and the toast leads to that page", async () => {
        mockHistory = [
            op(5, 0, {from: "1.2.99", to: "1.2.10", amount: bts(1)})
        ];
        const view = render(<AccountActivityNotifications />);
        mockHistory = [
            {
                ...op(6, 0, {from: "1.2.99", to: "1.2.10", amount: bts(2)}),
                block_num: 7000,
                trx_in_block: 3
            },
            ...mockHistory
        ];
        view.rerender(<AccountActivityNotifications />);
        await settle();
        expect(mockTelegram).toHaveBeenCalledTimes(1);
        expect(mockTelegram).toHaveBeenCalledWith("me", [
            {
                topic: "transfer",
                title: "Transfer",
                description: "Received 2.00000 BTS from alice",
                link: "/block/7000/3"
            }
        ]);
        expect(mockToast).toHaveBeenCalledWith("success", {
            message: "Transfer",
            description: "Received 2.00000 BTS from alice",
            to: "/block/7000/3"
        });
    });

    it("tells Telegram about a transaction's operations in one go, those the account started too", async () => {
        window.localStorage.setItem("__graphene__lastActivityNotified_me", "5");
        mockHistory = [
            op(7, 1, {
                seller: "1.2.10",
                amount_to_sell: bts(1),
                min_to_receive: bts(2)
            }),
            op(6, 0, {from: "1.2.10", to: "1.2.99", amount: bts(1)}),
            op(5, 0, {from: "1.2.99", to: "1.2.10", amount: bts(1)})
        ];
        render(<AccountActivityNotifications />);
        await settle();
        expect(mockTelegram).toHaveBeenCalledTimes(1);
        const notes = mockTelegram.mock.calls[0][1];
        expect(notes.map((n: any) => `${n.topic}:${n.title}`)).toEqual([
            "transfer:Transfer",
            "trade:Place order"
        ]);
    });

    describe("TelegramActivity: the other accounts of the user", () => {
        const mine = new Set(["me", "other"]);

        it("watches nothing while Telegram is not set up", async () => {
            window.localStorage.setItem(
                "__graphene__lastTelegramNotified_other",
                "5"
            );
            mockAccountState = {currentAccount: "me", myActiveAccounts: mine};
            mockHistory = [
                op(6, 0, {from: "1.2.99", to: "1.2.10", amount: bts(2)}),
                op(5, 0, {from: "1.2.99", to: "1.2.10", amount: bts(1)})
            ];
            render(<TelegramActivity />);
            await settle();
            expect(mockTelegram).not.toHaveBeenCalled();
        });

        it("tells about an account that is not the one on screen, from its own baseline, once", async () => {
            saveTelegram({
                ...DEFAULT_TELEGRAM,
                enabled: true,
                token: `123456789:${"A".repeat(35)}`,
                chatId: "42"
            });
            window.localStorage.setItem(
                "__graphene__lastTelegramNotified_other",
                "5"
            );
            mockAccountState = {currentAccount: "me", myActiveAccounts: mine};
            mockHistory = [
                op(6, 0, {from: "1.2.99", to: "1.2.10", amount: bts(2)}),
                op(5, 0, {from: "1.2.99", to: "1.2.10", amount: bts(1)})
            ];
            const view = render(<TelegramActivity />);
            await settle();
            // only "other" (the page's own account is watched by the notifications, not twice)
            expect(mockTelegram).toHaveBeenCalledTimes(1);
            expect(mockTelegram.mock.calls[0][0]).toBe("other");
            expect(mockTelegram.mock.calls[0][1][0].description).toBe(
                "Received 2.00000 BTS from alice"
            );
            // the bell of the page is not filled by it
            expect(getNotifications()).toHaveLength(0);
            view.rerender(<TelegramActivity />);
            await settle();
            expect(mockTelegram).toHaveBeenCalledTimes(1);
        });
    });
});
