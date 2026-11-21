// The Lifetime membership page: the chain's figures (mocked here as the live ones), the fee of a trade
// that can be changed, and what is said for a Basic and for a Lifetime member.
import * as React from "react";
import {act, fireEvent, render} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

const info: any = {
    lifetimeFee: BigInt("579131307"),
    networkBp: 2000,
    exchangeFee: BigInt(100000),
    orderFee: BigInt(48260),
    vestingThreshold: BigInt(10000000),
    vestingDays: 90,
    status: "basic",
    core: {symbol: "BTS", precision: 5}
};
// thmsfnd02 on the live chain: 28,277.62603 BTS of fees in 226,457 operations; in the last two days the
// node shows, 100 BTS of fees (60 of them trading) for 40 operations
const own = (over: any = {}): any => ({
    accountId: "1.2.10",
    lifetimeFees: BigInt("2827762603"),
    totalOps: 226457,
    recent: {
        fees: {
            coreUnits: BigInt("10000000"),
            trading: BigInt("6000000"),
            ops: 40,
            unpriced: 0,
            firstBlock: 1,
            lastBlock: 2
        },
        entries: 100,
        from: new Date(Date.UTC(2026, 9, 25)),
        to: new Date(Date.UTC(2026, 9, 27)),
        days: 2
    },
    ...over
});
const mockLoad = jest.fn<Promise<any>, [string | null]>();
jest.mock("../../lib/chain/membershipData", () => ({
    loadMembership: (name: string | null) => (mockLoad as any)(name)
}));
const mockOwn = jest.fn<Promise<any>, [string]>();
jest.mock("../../lib/chain/feesPaid", () => ({
    loadOwnFees: (name: string) => (mockOwn as any)(name)
}));
let mockAccount: any = {currentAccount: "me", passwordAccount: null};
jest.mock("../../next/hooks/useReduxState", () => ({
    useReduxState: () => mockAccount
}));

import LifetimeBreakEven from "../../components/Membership/LifetimeBreakEven";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});
beforeEach(() => {
    mockAccount = {currentAccount: "me", passwordAccount: null};
    mockLoad.mockReset();
    mockLoad.mockImplementation(() => Promise.resolve({...info}));
    mockOwn.mockReset();
    mockOwn.mockImplementation(() => Promise.resolve(own()));
});

const settle = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
    });
const field = (container: HTMLElement, label: string) =>
    container.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
const type = (container: HTMLElement, label: string, value: string) =>
    fireEvent.change(field(container, label), {target: {value}});

describe("Lifetime membership: break-even", () => {
    it("reads the chain for the account, then says what a membership costs, gives back and after how many trades it pays", async () => {
        const {container} = render(<LifetimeBreakEven />);
        expect(container.textContent).toContain("Reading the chain's fees");
        await settle();
        const text = container.textContent || "";
        expect(mockLoad).toHaveBeenCalledWith("me");
        expect(container.querySelector("h1")!.textContent).toBe(
            "Lifetime membership: break-even"
        );
        // the live figures: 5,791.31307 BTS, 20% to the network, 80% back
        expect(text).toContain("80%");
        expect(text).toContain("costs 5,791.31307 BTS, once");
        // a limit order (0.4826 BTS) by default: 0.38608 BTS back each, 15,001 trades at 20 a day
        expect(text).toContain(
            "gives back 0.38608 BTS (80%) of the 0.4826 BTS network fee of each trade"
        );
        expect(text).toContain(
            "after 15,001 trades: about 751 days at 20 trades a day"
        );
        expect(text).toContain("Your account is a Basic member");
        // what the usual trades pay, to type from
        expect(text).toContain(
            "A limit order pays 0.4826 BTS, a pool exchange 1 BTS, a route of three pool exchanges 3 BTS."
        );
    });

    it("takes the fee that is typed, with a comma or a point, and the trades per day", async () => {
        const {container} = render(<LifetimeBreakEven />);
        await settle();
        expect(field(container, "Network fee per trade").placeholder).toBe(
            "0.4826"
        );
        // three pool exchanges: 2.4 BTS back each, 2,414 trades
        type(container, "Network fee per trade", "3");
        expect(container.textContent).toContain("of the 3 BTS network fee");
        expect(container.textContent).toContain(
            "after 2,414 trades: about 121 days at 20 trades a day"
        );
        type(container, "Network fee per trade", "1,5");
        expect(container.textContent).toContain("of the 1.5 BTS network fee");
        // 1.2 BTS back each: 4,827 trades
        expect(container.textContent).toContain("after 4,827 trades");
        type(container, "Trades per day", "100");
        expect(container.textContent).toContain(
            "about 49 days at 100 trades a day"
        );
    });

    it("says it never pays for itself where there is no cashback, and asks for a number it can use", async () => {
        const {container} = render(<LifetimeBreakEven />);
        await settle();
        type(container, "Network fee per trade", "0");
        expect(container.textContent).toContain("never pays for itself");
        type(container, "Network fee per trade", "abc");
        expect(container.textContent).toContain(
            "Not an amount this asset can have."
        );
        type(container, "Trades per day", "0");
        expect(container.textContent).toContain("Enter a number above 0.");
        // without a rate the trades are still counted
        type(container, "Network fee per trade", "3");
        expect(container.textContent).toContain(
            "pays for itself after 2,414 trades."
        );
    });

    it("uses the symbol and precision of the chain's core asset", async () => {
        mockLoad.mockImplementation(() =>
            Promise.resolve({...info, core: {symbol: "TEST", precision: 4}})
        );
        const {container} = render(<LifetimeBreakEven />);
        await settle();
        expect(container.textContent).toContain("TEST");
        // no amount is given in BTS (the notes name the core asset of the main chain in words)
        expect(container.textContent).not.toMatch(/\d\s?BTS/);
        // four decimals: a fifth is not an amount
        type(container, "Network fee per trade", "1.23456");
        expect(container.textContent).toContain(
            "Not an amount this asset can have."
        );
    });

    it("tells a Lifetime member what it already gets back, and an unknown member that it does not know", async () => {
        mockLoad.mockImplementation(() =>
            Promise.resolve({...info, status: "lifetime"})
        );
        const member = render(<LifetimeBreakEven />);
        await settle();
        type(member.container, "Network fee per trade", "3");
        expect(member.container.textContent).toContain(
            "Lifetime member: you already get the cashback"
        );
        expect(member.container.textContent).toContain(
            "You get back 2.4 BTS on every trade"
        );
        expect(member.container.textContent).not.toContain(
            "It pays for itself after"
        );
        member.unmount();
        mockAccount = {currentAccount: null, passwordAccount: null};
        mockLoad.mockImplementation(() =>
            Promise.resolve({...info, status: "unknown"})
        );
        const nobody = render(<LifetimeBreakEven />);
        await settle();
        expect(mockLoad).toHaveBeenLastCalledWith(null);
        expect(nobody.container.textContent).toContain("is not known");
    });

    it("asks about the password account when no other is chosen", async () => {
        mockAccount = {currentAccount: null, passwordAccount: "pw-account"};
        render(<LifetimeBreakEven />);
        await settle();
        expect(mockLoad).toHaveBeenCalledWith("pw-account");
    });

    it("says so when the chain's fees cannot be read", async () => {
        mockLoad.mockImplementation(() => Promise.reject(new Error("offline")));
        const {container} = render(<LifetimeBreakEven />);
        await settle();
        expect(container.textContent).toContain("could not be read");
    });

    describe("what the account has paid", () => {
        const text = (container: HTMLElement) => container.textContent || "";

        it("says what was paid, what a Lifetime member would have got back, and that the membership would have paid for itself", async () => {
            const {container} = render(<LifetimeBreakEven />);
            await settle();
            expect(mockOwn).toHaveBeenCalledWith("me");
            const out = text(container);
            expect(out).toContain("What your account has paid");
            expect(out).toContain(
                "paid 28,277.62603 BTS in network fees, in 226,457 operations, since it was created"
            );
            // 80% of it
            expect(out).toContain("That would have been 22,622.10082 BTS");
            // less the membership's 5,791.31307
            expect(out).toContain(
                "so it would have paid for itself and left you 16,830.78775 BTS ahead"
            );
        });

        it("gives the recent pace, a month of it, and when the membership pays for itself at that pace", async () => {
            const {container} = render(<LifetimeBreakEven />);
            await settle();
            const out = text(container);
            expect(out).toContain(
                "In the last 2.0 days the node still shows (100 operations), the account paid 100 BTS in fees for 40 operations, 60 BTS of it for trading."
            );
            // 100 BTS in 2 days: 1,500 a month, 1,200 of it back, 5,791.31307 / 1,200 = 4.8 months
            expect(out).toContain("about 1,500 BTS of fees a month");
            expect(out).toContain("would get 1,200 BTS of it back");
            expect(out).toContain("in about 4.8 months at this pace");
        });

        it("says by how much the membership would not have paid for itself, when it would not", async () => {
            mockOwn.mockImplementation(() =>
                Promise.resolve(own({lifetimeFees: BigInt("100000000")}))
            );
            const {container} = render(<LifetimeBreakEven />);
            await settle();
            const out = text(container);
            // 80% of 1,000 BTS is 800; the membership costs 5,791.31307
            expect(out).toContain("That would have been 800 BTS");
            expect(out).toContain(
                "would not have paid for itself yet: 4,991.31307 BTS short"
            );
        });

        it("tells a Lifetime member what it has paid and gets back, without a loss to count", async () => {
            mockLoad.mockImplementation(() =>
                Promise.resolve({...info, status: "lifetime"})
            );
            const {container} = render(<LifetimeBreakEven />);
            await settle();
            const out = text(container);
            expect(out).toContain(
                "Your account is a Lifetime member: it has paid 28,277.62603 BTS in network fees since it was created, and gets 80% of every fee back."
            );
            expect(out).not.toContain("what this account lost");
            expect(out).toContain("you get 1,200 BTS of it back");
        });

        it("keeps the exact total when the node's history could not be read, and mentions fees it could not price", async () => {
            mockOwn.mockImplementation(() =>
                Promise.resolve(own({recent: null}))
            );
            const first = render(<LifetimeBreakEven />);
            await settle();
            expect(text(first.container)).toContain("28,277.62603 BTS");
            expect(text(first.container)).not.toContain("a month");
            first.unmount();

            const priced = own();
            priced.recent.fees.unpriced = 3;
            mockOwn.mockImplementation(() => Promise.resolve(priced));
            const second = render(<LifetimeBreakEven />);
            await settle();
            expect(text(second.container)).toContain(
                "3 fees in assets with no price against BTS are left out."
            );
        });

        it("asks to log in without an account, and says so when the fees cannot be read", async () => {
            mockAccount = {currentAccount: null, passwordAccount: null};
            const nobody = render(<LifetimeBreakEven />);
            await settle();
            expect(text(nobody.container)).toContain(
                "Log in to see what your account has paid in fees."
            );
            expect(mockOwn).not.toHaveBeenCalled();
            nobody.unmount();

            mockAccount = {currentAccount: "me", passwordAccount: null};
            mockOwn.mockImplementation(() =>
                Promise.reject(new Error("offline"))
            );
            const broken = render(<LifetimeBreakEven />);
            await settle();
            expect(text(broken.container)).toContain(
                "Your account's fees could not be read."
            );
        });

        it("says what the estimate is, and what it is not", async () => {
            const {container} = render(<LifetimeBreakEven />);
            await settle();
            expect(text(container)).toContain(
                "market fees are not network fees"
            );
            expect(text(container)).toContain("not a promise");
        });
    });
});
