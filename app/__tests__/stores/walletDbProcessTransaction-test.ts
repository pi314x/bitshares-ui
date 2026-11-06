// `WalletDb.process_transaction`: what every screen written for it relies on (a failure is logged and
// the promise still resolves; the "Confirm transaction" dialog comes first) and what a page that
// shows the operations itself asks for with `{strict, confirm}` (no second dialog, and a refusal of the node - or a cancelled
// unlock - is the rejection, so that a trade that failed is never reported as sent). The real store
// and the real actions; the transaction is a fake that records what was done to it.
jest.mock("idb-instance", () => ({
    __esModule: true,
    default: {instance: () => ({db: () => ({transaction: () => ({})})})}
}));

import {Apis} from "bitsharesjs-ws";
import WalletDb from "../../stores/WalletDb";
import WalletUnlockActions from "../../actions/WalletUnlockActions";
import TransactionConfirmActions from "../../actions/TransactionConfirmActions";

const fakeTransaction = (broadcast: () => Promise<any>) => ({
    set_required_fees: jest.fn(() => Promise.resolve()),
    update_head_block: jest.fn(() => Promise.resolve()),
    get_potential_signatures: jest.fn(() =>
        Promise.resolve({pubkeys: [], addys: []})
    ),
    get_required_signatures: jest.fn(() => Promise.resolve([])),
    add_signer: jest.fn(),
    broadcast: jest.fn(broadcast),
    serialize: jest.fn(() => ({operations: []})),
    has_proposed_operation: () => false
});

let confirm: jest.SpyInstance;
beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Apis as any, "instance").mockReturnValue({chain_id: "x"});
    jest.spyOn(WalletUnlockActions as any, "unlock").mockImplementation(() =>
        Promise.resolve()
    );
    jest.spyOn(console, "error").mockImplementation(() => {});
    // the dialog "answers" the way a user who confirms does: the broadcast result, or its failure
    confirm = jest
        .spyOn(TransactionConfirmActions as any, "confirm")
        .mockImplementation(((tr: any, resolve: any, reject: any) =>
            tr.broadcast().then(resolve, reject)) as any);
    (WalletDb as any).confirm_transactions = true;
});

describe("WalletDb.process_transaction", () => {
    it("by default shows the confirmation, and a failure is only logged: the promise resolves", async () => {
        const tr = fakeTransaction(() => Promise.reject(new Error("refused")));
        const result = await (WalletDb as any).process_transaction(
            tr,
            null,
            true
        );
        expect(confirm).toHaveBeenCalledTimes(1);
        expect(result).toBeUndefined();
    });

    it("with strict and no confirmation it broadcasts at once and returns what the node answered", async () => {
        const tr = fakeTransaction(() => Promise.resolve([{id: "abc"}]));
        const result = await (WalletDb as any).process_transaction(
            tr,
            null,
            true,
            [],
            {strict: true, confirm: false}
        );
        expect(confirm).not.toHaveBeenCalled();
        expect(tr.broadcast).toHaveBeenCalledTimes(1);
        expect(result).toEqual([{id: "abc"}]);
    });

    it("with strict, a refusal of the node is the rejection (a trade that failed is not 'sent')", async () => {
        const tr = fakeTransaction(() =>
            Promise.reject(
                new Error("3050101 - Killing limit order due to unable to fill")
            )
        );
        await expect(
            (WalletDb as any).process_transaction(tr, null, true, [], {
                strict: true,
                confirm: false
            })
        ).rejects.toThrow("unable to fill");
    });

    it("with strict, a cancelled unlock rejects and nothing is signed or sent", async () => {
        (WalletUnlockActions as any).unlock.mockImplementation(() =>
            Promise.reject(new Error("cancelled"))
        );
        const tr = fakeTransaction(() => Promise.resolve([]));
        await expect(
            (WalletDb as any).process_transaction(tr, null, true, [], {
                strict: true,
                confirm: false
            })
        ).rejects.toThrow("cancelled");
        expect(tr.set_required_fees).not.toHaveBeenCalled();
        expect(tr.broadcast).not.toHaveBeenCalled();
        // without strict the same cancel is only logged, as before
        await expect(
            (WalletDb as any).process_transaction(tr, null, true)
        ).resolves.toBeUndefined();
    });

    it("with strict but the confirmation kept, a cancel in the dialog is a rejection too", async () => {
        confirm.mockImplementation(((_tr: any, _resolve: any, reject: any) =>
            reject()) as any);
        const tr = fakeTransaction(() => Promise.resolve([]));
        await expect(
            (WalletDb as any).process_transaction(tr, null, true, [], {
                strict: true
            })
        ).rejects.toBeUndefined();
        expect(confirm).toHaveBeenCalledTimes(1);
    });
});
