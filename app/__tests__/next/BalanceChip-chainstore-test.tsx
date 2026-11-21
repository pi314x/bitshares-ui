// The balance chip against the REAL chain store (BalanceChip-test.tsx has a stand-in): the updates are given to
// `ChainStore.onUpdate`, which is what a push of the node (and `AccountFreshness`, when it reads the account again)
// does, so what is proved is that the chip follows the store the way the app's other screens do - after every
// operation that moves the balance (an amount that changes, a balance object that is made for the first time),
// and when the account is switched.
import * as React from "react";
import {render, act} from "@testing-library/react";
import Immutable from "immutable";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import localeEn from "../../assets/locales/locale-en.json";

const mockCurrent = {name: "alice" as string | null};

jest.mock("actions/SettingsActions", () => ({
    __esModule: true,
    default: {changeViewSetting: () => undefined}
}));
jest.mock("../../store/slices/accountSlice", () => ({
    __esModule: true,
    selectAccountState: () => ({
        currentAccount: mockCurrent.name,
        passwordAccount: null
    })
}));
jest.mock("../../store/slices/settingsSlice", () => ({
    __esModule: true,
    selectSettingsState: () => ({viewSettings: {get: () => undefined}})
}));
jest.mock("../../store/slices/intlSlice", () => ({
    __esModule: true,
    selectIntlState: () => ({currentLocale: "en"})
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    __esModule: true,
    useReduxState: (selector: any) => selector({})
}));

import BalanceChip from "../../next/BalanceChip";

// (this jsdom has no MutationObserver, which `waitFor` needs: poll, letting the store's timer run)
async function eventually(check: () => void, ms = 1000) {
    const end = Date.now() + ms;
    for (;;) {
        try {
            check();
            return;
        } catch (e) {
            if (Date.now() > end) throw e;
            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
            });
        }
    }
}

// the parts of the store that a test seeds (they are plain Maps in bitsharesjs)
const store: any = ChainStore;

function seedAccount(name: string, id: string, balances: object) {
    store.accounts_by_name.set(name, id);
    // as if the full account had been read and subscribed (what `getAccount` does for an account it has not got): no
    // request goes out for it, and the store takes the pushes of its balances - it ignores those of other accounts
    store.subbed_accounts.add(id);
    store.get_full_accounts_subscriptions.set(id, true);
    store.get_full_accounts_subscriptions.set(name, true);
    store.objects_by_id.set(id, Immutable.fromJS({id, name, balances}));
}

function seedBalance(id: string, owner: string, amount: string) {
    store.objects_by_id.set(
        id,
        Immutable.fromJS({
            id,
            owner,
            asset_type: "1.3.0",
            balance: amount
        })
    );
}

/** What a push of the node does with a changed or new balance object. */
function push(id: string, owner: string, amount: string) {
    store.onUpdate([
        [{id, owner, asset_type: "1.3.0", balance: amount}] as any[]
    ]);
}

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    store.clearCache();
    // the store tells its subscribers at most every `dispatchFrequency` ms: at once, for the test
    store.setDispatchFrequency(0);
    mockCurrent.name = "alice";
    store.objects_by_id.set(
        "1.3.0",
        Immutable.fromJS({id: "1.3.0", symbol: "BTS", precision: 5})
    );
    seedAccount("alice", "1.2.100", {"1.3.0": "2.5.1"});
    seedBalance("2.5.1", "1.2.100", "10000000"); // 100 BTS
    seedAccount("bob", "1.2.101", {}); // loaded, holds no BTS
});

afterAll(() => {
    store.setDispatchFrequency(40);
    store.clearCache();
});

describe("BalanceChip on the real chain store", () => {
    it("shows the balance the store has", () => {
        const {container} = render(<BalanceChip />);
        expect(container.textContent).toContain("100 BTS");
    });

    it("changes with every operation that moves the balance, with no reload", async () => {
        const {container} = render(<BalanceChip />);
        expect(container.textContent).toContain("100 BTS");
        // a transfer in
        push("2.5.1", "1.2.100", "12550000");
        await eventually(() =>
            expect(container.textContent).toContain("125.5 BTS")
        );
        // a transfer out, with its fee, and a fill after it
        push("2.5.1", "1.2.100", "9999900");
        await eventually(() =>
            expect(container.textContent).toContain("99.999 BTS")
        );
        push("2.5.1", "1.2.100", "9999900"); // the same again: nothing breaks
        push("2.5.1", "1.2.100", "0");
        await eventually(() =>
            expect(container.textContent).toContain("0 BTS")
        );
    });

    it("picks up a balance object made for the first time (an account that held no BTS)", async () => {
        mockCurrent.name = "bob";
        const {container} = render(<BalanceChip />);
        expect(container.textContent).toContain("0 BTS");
        push("2.5.9", "1.2.101", "300000");
        await eventually(() =>
            expect(container.textContent).toContain("3 BTS")
        );
    });

    it("shows the other account's balance the moment the account is switched, and follows that one", async () => {
        seedBalance("2.5.2", "1.2.101", "700000");
        store.objects_by_id.set(
            "1.2.101",
            Immutable.fromJS({
                id: "1.2.101",
                name: "bob",
                balances: {"1.3.0": "2.5.2"}
            })
        );
        const {container, rerender} = render(<BalanceChip />);
        expect(container.textContent).toContain("100 BTS");
        mockCurrent.name = "bob";
        rerender(<BalanceChip />);
        expect(container.textContent).toContain("7 BTS");
        expect(container.textContent).not.toContain("100 BTS");
        // the account switched from keeps moving, and does not leak into the one shown
        push("2.5.1", "1.2.100", "5000000");
        push("2.5.2", "1.2.101", "800000");
        await eventually(() =>
            expect(container.textContent).toContain("8 BTS")
        );
        expect(container.textContent).not.toContain("50 BTS");
        // and back
        mockCurrent.name = "alice";
        rerender(<BalanceChip />);
        expect(container.textContent).toContain("50 BTS");
    });

    it("(premise) the store ignores a push for an account it has not subscribed to", () => {
        seedAccount("dave", "1.2.102", {"1.3.0": "2.5.4"});
        seedBalance("2.5.4", "1.2.102", "100000");
        store.subbed_accounts.delete("1.2.102");
        push("2.5.4", "1.2.102", "999999");
        expect(store.getObject("2.5.4").get("balance")).toBe("100000");
    });

    it("stops listening when it goes away (no update after unmount)", () => {
        const before = store.subscribers.size;
        const {unmount} = render(<BalanceChip />);
        expect(store.subscribers.size).toBe(before + 1);
        unmount();
        expect(store.subscribers.size).toBe(before);
    });
});
