// The optional extension-signing path wired into the app (Phase 6): detection,
// connecting, the choice between local and extension signing, and the one place
// it hooks into `WalletDb.process_transaction`. Uses the real stores and the
// real `ExternalSignerActions`; only the extension (a fake `window.bitsharesWallet`)
// and the idb layer are stubbed. The point of most tests: with the default
// preference nothing changes, and with the extension nothing local is touched.
jest.mock("idb-instance", () => ({
    __esModule: true,
    default: {instance: () => ({db: () => ({transaction: () => ({})})})}
}));

import counterpart from "counterpart";
import Immutable from "immutable";
import {Apis} from "bitsharesjs-ws";
import {PrivateKey, TransactionBuilder} from "bitsharesjs";
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
import {makeFakeProvider, MAINNET} from "../utils/fakeProvider";

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
    window.localStorage.clear();
});

afterEach(() => {
    jest.restoreAllMocks();
    delete win.bitsharesWallet;
});

async function useExtension() {
    ExternalSignerActions.setPreference("extension");
    await ExternalSignerActions.connect();
}

describe("choosing the signing method", () => {
    it("is the local wallet by default, even with a connected extension", async () => {
        await ExternalSignerActions.connect();
        expect(ExternalSignerActions.getState().status).toBe("connected");
        expect(ExternalSignerActions.isActive()).toBe(false);
    });

    it("is the extension only when chosen AND connected", async () => {
        ExternalSignerActions.setPreference("extension");
        expect(ExternalSignerActions.isActive()).toBe(false);
        await ExternalSignerActions.connect();
        expect(ExternalSignerActions.isActive()).toBe(true);
        await ExternalSignerActions.disconnect();
        expect(ExternalSignerActions.isActive()).toBe(false);
    });

    it("remembers the choice and restores an earlier approval silently", async () => {
        ExternalSignerActions.setPreference("extension");
        reduxStore.dispatch(
            patchExternalSigner({...initialExternalSignerState})
        );
        await ExternalSignerActions.init();
        expect(ExternalSignerActions.getState().preference).toBe("extension");
        expect(ExternalSignerActions.isActive()).toBe(true);
        expect(fake.calls.map(c => c.method)).not.toContain("connect");
    });

    it("reports a missing extension instead of throwing", async () => {
        delete win.bitsharesWallet;
        ExternalSignerActions.setPreference("extension");
        await ExternalSignerActions.connect();
        const state = ExternalSignerActions.getState();
        expect(state.status).toBe("unavailable");
        expect(state.error).toMatch(/not found/i);
        expect(ExternalSignerActions.isActive()).toBe(false);
    });

    it("keeps the app disconnected when the extension is on another network", async () => {
        fake = makeFakeProvider({chainId: "00".repeat(32)});
        win.bitsharesWallet = fake.provider;
        ExternalSignerActions.setPreference("extension");
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

    it("keeps using the local wallet when the extension was not chosen", async () => {
        await ExternalSignerActions.connect(); // connected, but preference is local
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

    it("unlockForSigning skips the local unlock only for the extension", async () => {
        const unlock = jest
            .spyOn(WalletUnlockActions as any, "unlock")
            .mockResolvedValue(undefined);
        await (WalletUnlockActions as any).unlockForSigning();
        expect(unlock).toHaveBeenCalledTimes(1);
        await useExtension();
        await (WalletUnlockActions as any).unlockForSigning();
        expect(unlock).toHaveBeenCalledTimes(1);
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
        ExternalSignerActions.setPreference("local");
        expect(
            (AccountStore as any).getMyAuthorityForAccount(
                chainAccount("1.2.100")
            )
        ).toBe("none");
    });

    it("makes it the current account while connected and takes it away afterwards", async () => {
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

    it("follows the extension when the user switches account there", async () => {
        await useExtension();
        fake.emit("accountChanged", {name: "carol", id: "1.2.300"});
        expect(ExternalSignerActions.getState().account).toEqual({
            accountName: "carol",
            accountId: "1.2.300"
        });
        // an event with a made-up id is ignored
        fake.emit("accountChanged", {name: "mallory", id: "oops"});
        expect(ExternalSignerActions.getState().account!.accountName).toBe(
            "carol"
        );
    });
});
