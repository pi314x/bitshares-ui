// The optional extension-signing path wired into the app (Phase 6): detection,
// connecting, which account signs (the one chosen in the account menu: the
// extension's through the extension, any other through the local wallet), and
// the one place it hooks into `WalletDb.process_transaction`. Uses the real
// stores and the real `ExternalSignerActions`; only the extension (a fake
// `window.bitsharesWallet`) and the idb layer are stubbed. The point of most
// tests: while the extension is not connected nothing changes, and for its
// account nothing local is touched.
jest.mock("idb-instance", () => ({
    __esModule: true,
    default: {instance: () => ({db: () => ({transaction: () => ({})})})}
}));

import counterpart from "counterpart";
import Immutable from "immutable";
import {Apis} from "bitsharesjs-ws";
import {PrivateKey, TransactionBuilder} from "bitsharesjs";
import {EXTENSION_MEMO_NONCE} from "../../wallet-extension/transaction";
import localeEn from "../../assets/locales/locale-en.json";
import {patchState} from "../../store/slices/accountSlice";
import {reduxStore} from "../../store/reduxStore";
import {
    initialExternalSignerState,
    patchExternalSigner
} from "../../store/slices/externalSignerSlice";
import {selectNotification} from "../../store/slices/notificationSlice";
import ExternalSignerActions from "../../actions/ExternalSignerActions";
import WalletUnlockActions from "../../actions/WalletUnlockActions";
import WalletDb from "../../stores/WalletDb";
import AccountStore from "../../stores/AccountStore";
import {startExternalAccountSync} from "../../stores/ExternalAccountSync";
import {CAPABILITIES, makeFakeProvider, MAINNET} from "../utils/fakeProvider";

const win = window as any;
let fake: ReturnType<typeof makeFakeProvider>;

function transferTx(overrides: any = {}) {
    const tr = new (TransactionBuilder as any)();
    tr.add_type_operation("transfer", {
        fee: {amount: 0, asset_id: 0},
        from: "1.2.100",
        to: "1.2.200",
        amount: {amount: 5000, asset_id: "1.3.0"},
        ...overrides
    });
    return tr;
}

const notification = () => selectNotification(reduxStore.getState());
const signCalls = () => fake.calls.filter(c => c.method === "signTransaction");

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
    startExternalAccountSync();
});

beforeEach(() => {
    jest.spyOn(Apis as any, "instance").mockReturnValue({chain_id: MAINNET});
    fake = makeFakeProvider({connected: true});
    win.bitsharesWallet = fake.provider;
    reduxStore.dispatch(patchExternalSigner({...initialExternalSignerState}));
    reduxStore.dispatch(
        patchState({
            currentAccount: null,
            passwordAccount: null,
            myActiveAccounts: (Immutable as any).Set()
        } as any)
    );
    window.localStorage.clear();
});

afterEach(() => {
    jest.restoreAllMocks();
    delete win.bitsharesWallet;
});

async function useExtension() {
    await ExternalSignerActions.connect();
}

/** A local wallet account next to the extension's, chosen in the account menu. */
function chooseLocalAccount(name = "localwallet") {
    const state = (AccountStore as any).getState();
    reduxStore.dispatch(
        patchState({
            myActiveAccounts: state.myActiveAccounts.add(name)
        } as any)
    );
    (AccountStore as any).setCurrentAccount(name);
}

describe("connecting the extension", () => {
    it("is not connected by default, so nothing signs with it", async () => {
        expect(ExternalSignerActions.getState().status).toBe("unknown");
        expect(ExternalSignerActions.isActive()).toBe(false);
        expect(ExternalSignerActions.isSigningFor("alice")).toBe(false);
    });

    it("signs for its own account only while it is connected", async () => {
        await ExternalSignerActions.connect();
        expect(ExternalSignerActions.isActive()).toBe(true);
        expect(ExternalSignerActions.isSigningFor("alice")).toBe(true);
        // every other account is the local wallet's to sign
        expect(ExternalSignerActions.isSigningFor("localwallet")).toBe(false);
        expect(ExternalSignerActions.isSigningFor(null)).toBe(false);
        await ExternalSignerActions.disconnect();
        expect(ExternalSignerActions.isActive()).toBe(false);
        expect(ExternalSignerActions.isSigningFor("alice")).toBe(false);
    });

    it("has no signing-method preference any more", async () => {
        await ExternalSignerActions.connect();
        expect((ExternalSignerActions.getState() as any).preference).toBe(
            undefined
        );
        expect((ExternalSignerActions as any).setPreference).toBe(undefined);
    });

    it("restores an earlier approval silently", async () => {
        await ExternalSignerActions.init();
        expect(ExternalSignerActions.isActive()).toBe(true);
        expect(fake.calls.map(c => c.method)).not.toContain("connect");
    });

    it("stays disconnected on start-up when it was never approved", async () => {
        fake = makeFakeProvider({connected: false});
        win.bitsharesWallet = fake.provider;
        await ExternalSignerActions.init();
        expect(ExternalSignerActions.getState().status).toBe("disconnected");
        expect(ExternalSignerActions.isActive()).toBe(false);
    });

    it("reports a missing extension instead of throwing", async () => {
        delete win.bitsharesWallet;
        await ExternalSignerActions.connect();
        const state = ExternalSignerActions.getState();
        expect(state.status).toBe("unavailable");
        expect(state.error).toMatch(/not found/i);
        expect(ExternalSignerActions.isActive()).toBe(false);
    });

    it("keeps the app disconnected when the extension is on another network", async () => {
        fake = makeFakeProvider({chainId: "00".repeat(32)});
        win.bitsharesWallet = fake.provider;
        await ExternalSignerActions.connect();
        expect(ExternalSignerActions.isActive()).toBe(false);
        expect(ExternalSignerActions.getState().error).toMatch(
            /Chain ID mismatch|different network/
        );
    });
});

describe("WalletDb.process_transaction", () => {
    it("delegates to the extension and never touches the local unlock", async () => {
        await useExtension();
        const unlock = jest.spyOn(WalletUnlockActions as any, "unlock");
        const result = await (WalletDb as any).process_transaction(
            transferTx(),
            null,
            true
        );
        expect(result).toEqual({id: "abc", block_num: 42});
        expect(unlock).not.toHaveBeenCalled();
        expect(signCalls()).toHaveLength(1);
        expect(signCalls()[0].params.operations[0][1]).toMatchObject({
            from: "1.2.100",
            to: "1.2.200",
            amount: {amount: "5000", asset_id: "1.3.0"}
        });
        expect((notification() as any).message).toMatch(/sent/i);
    });

    it("keeps using the local wallet while the extension is not connected", async () => {
        const unlock = jest
            .spyOn(WalletUnlockActions as any, "unlock")
            .mockRejectedValue("stop here");
        jest.spyOn(console, "error").mockImplementation(() => {});
        await (WalletDb as any).process_transaction(transferTx(), null, true);
        expect(unlock).toHaveBeenCalledTimes(1);
        expect(signCalls()).toHaveLength(0);
    });

    it("sends a transaction for another account to the local wallet, not the extension", async () => {
        // The account switcher can hold the extension's account and the local
        // wallet's side by side: a transfer *from* a local account is signed
        // with the local wallet, the extension (which holds only its own key)
        // is not asked.
        await useExtension();
        const unlock = jest
            .spyOn(WalletUnlockActions as any, "unlock")
            .mockRejectedValue("stop here");
        jest.spyOn(console, "error").mockImplementation(() => {});
        await (WalletDb as any).process_transaction(
            transferTx({from: "1.2.999"}),
            null,
            true
        );
        expect(unlock).toHaveBeenCalledTimes(1);
        expect(signCalls()).toHaveLength(0);
    });

    it("still sends the extension account's own transactions to the extension", async () => {
        await useExtension();
        const unlock = jest.spyOn(WalletUnlockActions as any, "unlock");
        await (WalletDb as any).process_transaction(transferTx(), null, true);
        expect(unlock).not.toHaveBeenCalled();
        expect(signCalls()).toHaveLength(1);
    });

    it("treats the recipient of a vesting balance as a recipient, not a signer", async () => {
        // vesting_balance_create is signed by `creator`; `owner` only receives.
        await useExtension();
        const tr = new (TransactionBuilder as any)();
        tr.add_type_operation("vesting_balance_create", {
            fee: {amount: 0, asset_id: 0},
            creator: "1.2.100",
            owner: "1.2.200",
            amount: {amount: 1000, asset_id: "1.3.0"},
            policy: [
                0,
                {
                    begin_timestamp: "2027-01-15T08:00:00",
                    vesting_cliff_seconds: 3600,
                    vesting_duration_seconds: 3600
                }
            ]
        });
        const result = await (WalletDb as any).process_transaction(
            tr,
            null,
            true
        );
        expect(result).toEqual({id: "abc", block_num: 42});
        expect(signCalls()).toHaveLength(1);
        expect(signCalls()[0].params.operations[0][1]).toMatchObject({
            creator: "1.2.100",
            owner: "1.2.200"
        });
    });

    it("unlockForSigning skips the local unlock only for the extension's account", async () => {
        const unlock = jest
            .spyOn(WalletUnlockActions as any, "unlock")
            .mockResolvedValue(undefined);
        await (WalletUnlockActions as any).unlockForSigning();
        expect(unlock).toHaveBeenCalledTimes(1);
        // connected, and its account is the chosen one: nothing to unlock
        await useExtension();
        expect((AccountStore as any).getState().currentAccount).toBe("alice");
        await (WalletUnlockActions as any).unlockForSigning();
        expect(unlock).toHaveBeenCalledTimes(1);
        // connected, but a local wallet account is the chosen one: unlock it
        chooseLocalAccount();
        await (WalletUnlockActions as any).unlockForSigning();
        expect(unlock).toHaveBeenCalledTimes(2);
    });

    it.each([
        [
            "a transaction that is not to be broadcast",
            (tr: any) => [tr, null, false],
            /signs and broadcasts/i
        ],
        [
            "a balance claim signed with extra keys",
            (tr: any) => [tr, ["BTS_key"], true],
            /keys the extension does not hold/i
        ],
        [
            "a memo",
            () => {
                const key = (PrivateKey as any)
                    .fromSeed("m")
                    .toPublicKey()
                    .toPublicKeyString();
                return [
                    transferTx({
                        memo: {from: key, to: key, nonce: "1", message: "00"}
                    }),
                    null,
                    true
                ];
            },
            /memo/i
        ],
        [
            "a fee in another asset",
            () => [
                transferTx({fee: {amount: 0, asset_id: "1.3.5"}}),
                null,
                true
            ],
            /core asset/i
        ]
    ])("refuses %s and tells the user", async (_label, args, message) => {
        await useExtension();
        const result = await (WalletDb as any).process_transaction(
            ...(args(transferTx()) as [any, any, any])
        );
        expect(result).toBeUndefined();
        expect(signCalls()).toHaveLength(0);
        expect((notification() as any).level).toBe("error");
        expect((notification() as any).message).toMatch(message);
    });

    it("shows a rejection and resolves undefined", async () => {
        await useExtension();
        fake.provider.signTransaction = async () => {
            throw new Error("User rejected transaction");
        };
        const result = await (WalletDb as any).process_transaction(
            transferTx(),
            null,
            true
        );
        expect(result).toBeUndefined();
        expect((notification() as any).message).toMatch(/rejected/i);
    });

    it("does not tell the user to retry after an unknown outcome", async () => {
        await useExtension();
        fake.provider.signTransaction = async () => {
            throw new Error("Request timeout");
        };
        await (WalletDb as any).process_transaction(transferTx(), null, true);
        const message = (notification() as any).message;
        expect(message).toMatch(/may still have been sent/i);
        expect(message).toMatch(/before trying again/i);
        expect(message).not.toMatch(/did not sign/i);
    });
});

describe("the connected account in the UI", () => {
    const chainAccount = (id: string) =>
        (Immutable as any).fromJS({
            id,
            owner: {
                weight_threshold: 1,
                key_auths: [],
                account_auths: [],
                address_auths: []
            },
            active: {
                weight_threshold: 1,
                key_auths: [],
                account_auths: [],
                address_auths: []
            }
        });

    it("counts the extension's account as the user's own, and only that one", async () => {
        expect(
            (AccountStore as any).getMyAuthorityForAccount(
                chainAccount("1.2.100")
            )
        ).toBe("none");
        await useExtension();
        expect(
            (AccountStore as any).getMyAuthorityForAccount(
                chainAccount("1.2.100")
            )
        ).toBe("full");
        expect(
            (AccountStore as any).getMyAuthorityForAccount(
                chainAccount("1.2.101")
            )
        ).toBe("none");
        await ExternalSignerActions.disconnect();
        expect(
            (AccountStore as any).getMyAuthorityForAccount(
                chainAccount("1.2.100")
            )
        ).toBe("none");
    });

    it("makes it the current account when the user connects, and takes it away afterwards", async () => {
        await useExtension();
        const state = (AccountStore as any).getState();
        expect(state.myActiveAccounts.has("alice")).toBe(true);
        expect(state.currentAccount).toBe("alice");
        await ExternalSignerActions.disconnect();
        expect(
            (AccountStore as any).getState().myActiveAccounts.has("alice")
        ).toBe(false);
    });

    it("lets the user switch to another account while the extension is connected", async () => {
        await useExtension();
        // a local wallet account next to the extension's
        const state = (AccountStore as any).getState();
        reduxStore.dispatch(
            patchState({
                myActiveAccounts: state.myActiveAccounts.add("localwallet")
            })
        );
        (AccountStore as any).setCurrentAccount("localwallet");
        // an unrelated store update must not put the extension account back
        reduxStore.dispatch(patchState({}));
        expect((AccountStore as any).getState().currentAccount).toBe(
            "localwallet"
        );
        expect(
            (AccountStore as any).getState().myActiveAccounts.has("alice")
        ).toBe(true);
    });

    it("can be chosen even in cloud-wallet mode, and is not remembered", async () => {
        // cloud mode pins the current account to the password account
        reduxStore.dispatch(
            patchState({passwordAccount: "cloudwallet"} as any)
        );
        (AccountStore as any).setCurrentAccount("somebody-else");
        expect((AccountStore as any).getState().currentAccount).toBe(
            "cloudwallet"
        );

        await useExtension();
        // the user connected it just now: its account is the chosen one
        expect((AccountStore as any).getState().currentAccount).toBe("alice");
        // the user can go back to the cloud account and to the extension's
        (AccountStore as any).setCurrentAccount("cloudwallet");
        expect((AccountStore as any).getState().currentAccount).toBe(
            "cloudwallet"
        );
        (AccountStore as any).setCurrentAccount("alice");
        expect((AccountStore as any).getState().currentAccount).toBe("alice");
        // not persisted: the next start without the extension is not left on it
        const stored = Object.keys(window.localStorage)
            .filter(k => k.indexOf("currentAccount") !== -1)
            .map(k => window.localStorage.getItem(k));
        expect(stored.join("|")).not.toContain("alice");

        await ExternalSignerActions.disconnect();
        reduxStore.dispatch(patchState({passwordAccount: null} as any));
    });

    it("does not take the choice away from the user", async () => {
        // a start-up restore (not a click) puts the extension's account into the
        // menu but leaves the account the user was on
        chooseLocalAccount();
        await ExternalSignerActions.init();
        expect(ExternalSignerActions.isActive()).toBe(true);
        const state = (AccountStore as any).getState();
        expect(state.myActiveAccounts.has("alice")).toBe(true);
        expect(state.currentAccount).toBe("localwallet");
        // neither does anything that re-selects the default account
        (AccountStore as any).tryToSetCurrentAccount();
        expect((AccountStore as any).getState().currentAccount).toBe(
            "localwallet"
        );
        // choosing the extension's account makes it the signer, and it stays
        (AccountStore as any).setCurrentAccount("alice");
        (AccountStore as any).tryToSetCurrentAccount();
        expect((AccountStore as any).getState().currentAccount).toBe("alice");
    });

    it("is the current account after a restore only when there is no other", async () => {
        await ExternalSignerActions.init();
        expect((AccountStore as any).getState().currentAccount).toBe("alice");
    });

    it("leaves a local account chosen when the extension is disconnected", async () => {
        await useExtension();
        chooseLocalAccount();
        await ExternalSignerActions.disconnect();
        expect((AccountStore as any).getState().currentAccount).toBe(
            "localwallet"
        );
    });

    it("follows the extension when the user switches account there", async () => {
        await useExtension();
        fake.emit("accountChanged", {name: "carol", id: "1.2.300"});
        expect(ExternalSignerActions.getState().account).toEqual({
            accountName: "carol",
            accountId: "1.2.300"
        });
        // it was the chosen account, so the new one is
        expect((AccountStore as any).getState().currentAccount).toBe("carol");
        // an event with a made-up id is ignored
        fake.emit("accountChanged", {name: "mallory", id: "oops"});
        expect(ExternalSignerActions.getState().account!.accountName).toBe(
            "carol"
        );
    });
});

describe("the account menu decides who signs", () => {
    it("signs the extension account's transaction with the extension and a local one locally", async () => {
        await useExtension();
        chooseLocalAccount();
        // the extension's account is in the menu, a local one is chosen:
        // a transaction for the extension's account still goes to it ...
        const unlock = jest
            .spyOn(WalletUnlockActions as any, "unlock")
            .mockRejectedValue("stop here");
        jest.spyOn(console, "error").mockImplementation(() => {});
        await (WalletDb as any).process_transaction(transferTx(), null, true);
        expect(signCalls()).toHaveLength(1);
        expect(unlock).not.toHaveBeenCalled();
        // ... and one for a local account is never offered to it
        await (WalletDb as any).process_transaction(
            transferTx({from: "1.2.999"}),
            null,
            true
        );
        expect(signCalls()).toHaveLength(1);
        expect(unlock).toHaveBeenCalledTimes(1);
    });

    it("does not follow the extension to another account while a local one is chosen", async () => {
        await useExtension();
        chooseLocalAccount();
        fake.emit("accountChanged", {name: "carol", id: "1.2.300"});
        expect((AccountStore as any).getState().currentAccount).toBe(
            "localwallet"
        );
        expect(
            (AccountStore as any).getState().myActiveAccounts.has("carol")
        ).toBe(true);
    });
});

describe("memos, fee assets and operations through the extension", () => {
    const memoKey = (PrivateKey as any)
        .fromSeed("memo-key")
        .toPublicKey()
        .toPublicKeyString();
    const markedMemo = (text: string) => ({
        from: memoKey,
        to: memoKey,
        nonce: EXTENSION_MEMO_NONCE,
        message: Buffer.from(text, "utf-8")
    });

    it("hands a memo over as plain text for the extension to encrypt", async () => {
        fake = makeFakeProvider({connected: true, capabilities: CAPABILITIES});
        win.bitsharesWallet = fake.provider;
        await useExtension();
        await (WalletDb as any).process_transaction(
            transferTx({memo: markedMemo("Rechnung 42")}),
            null,
            true
        );
        expect(signCalls()).toHaveLength(1);
        // text, not the app's own marker object: nothing readable by the app was encrypted
        expect(signCalls()[0].params.operations[0][1].memo).toBe("Rechnung 42");
    });

    it("refuses a memo, with a reason, for an extension that cannot encrypt one", async () => {
        // (no capabilities: an older extension)
        await useExtension();
        await (WalletDb as any).process_transaction(
            transferTx({memo: markedMemo("Rechnung 42")}),
            null,
            true
        );
        expect(signCalls()).toHaveLength(0);
        expect((notification() as any).message).toMatch(/memo/i);
        expect((notification() as any).message).toMatch(/unencrypted/);
    });

    it("pays the fee in the asset chosen, when the extension honours it", async () => {
        fake = makeFakeProvider({connected: true, capabilities: CAPABILITIES});
        win.bitsharesWallet = fake.provider;
        await useExtension();
        await (WalletDb as any).process_transaction(
            transferTx({fee: {amount: 0, asset_id: "1.3.861"}}),
            null,
            true
        );
        expect(signCalls()).toHaveLength(1);
        expect(signCalls()[0].params.operations[0][1].fee.asset_id).toBe(
            "1.3.861"
        );
    });

    it("does not ask the extension to sign what it says it does not sign", async () => {
        fake = makeFakeProvider({connected: true, capabilities: CAPABILITIES});
        win.bitsharesWallet = fake.provider;
        await useExtension();
        const tr = new (TransactionBuilder as any)();
        tr.add_type_operation("account_transfer", {
            fee: {amount: 0, asset_id: 0},
            account_id: "1.2.100",
            new_owner: "1.2.200"
        });
        await (WalletDb as any).process_transaction(tr, null, true);
        expect(signCalls()).toHaveLength(0);
        expect((notification() as any).message).toMatch(/account_transfer/);
    });
});

describe("the extension switches account", () => {
    const bob = {name: "bob", id: "1.2.300"};
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    it("goes on when the account it switched to is connected to this site", async () => {
        await useExtension();
        fake.state.connectedIds.add(bob.id);
        fake.switchTo(bob);
        await flush();
        const state = ExternalSignerActions.getState();
        expect(state.status).toBe("connected");
        expect(state.account).toEqual({
            accountName: "bob",
            accountId: "1.2.300"
        });
        expect(ExternalSignerActions.isSigningFor("bob")).toBe(true);
    });

    it("says so, and offers to connect, when it is not connected: it cannot sign here", async () => {
        await useExtension();
        fake.switchTo(bob);
        await flush();
        const state = ExternalSignerActions.getState();
        // not "Connected as bob": the extension would refuse to sign for him on this site
        expect(state.status).toBe("disconnected");
        expect(state.account).toBeNull();
        expect(state.error).toMatch(/bob/);
        expect(state.error).toMatch(/not connected to this site/);
        expect(ExternalSignerActions.isSigningFor("bob")).toBe(false);
        expect(ExternalSignerActions.isActive()).toBe(false);
    });

    it("is connected as him once he is connected, one click", async () => {
        await useExtension();
        fake.switchTo(bob);
        await flush();
        expect(ExternalSignerActions.getState().status).toBe("disconnected");
        await ExternalSignerActions.connect();
        const state = ExternalSignerActions.getState();
        expect(state.status).toBe("connected");
        expect(state.account).toEqual({
            accountName: "bob",
            accountId: "1.2.300"
        });
        expect(state.error).toBeNull();
    });

    it("looks again when the user comes back to the page after approving in the extension", async () => {
        await useExtension();
        fake.switchTo(bob);
        await flush();
        expect(ExternalSignerActions.getState().status).toBe("disconnected");
        // the user approved the connection in the extension's popup ...
        fake.state.connectedIds.add(bob.id);
        fake.state.connected = true;
        // ... and returns to this window
        window.dispatchEvent(new Event("focus"));
        await flush();
        await flush();
        expect(ExternalSignerActions.getState().status).toBe("connected");
        expect(ExternalSignerActions.getState().account?.accountName).toBe(
            "bob"
        );
    });
});
