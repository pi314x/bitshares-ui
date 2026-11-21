// The sending helpers of `AdvancedActions` that a page uses when it shows the operations itself (the strategies page): the unlock
// first (and its cancel), and a send whose failure is a rejection, with no second confirmation dialog.
const mockNewTransaction = jest.fn();
jest.mock("api/WalletApi", () => ({
    __esModule: true,
    default: {new_transaction: (...a: any[]) => mockNewTransaction(...a)}
}));
const mockProcess = jest.fn();
jest.mock("../../stores/WalletDb", () => ({
    __esModule: true,
    default: {process_transaction: (...a: any[]) => mockProcess(...a)}
}));
const mockIsSigningFor = jest.fn();
jest.mock("../../actions/ExternalSignerActions", () => ({
    __esModule: true,
    default: {isSigningFor: (...a: any[]) => mockIsSigningFor(...a)}
}));
const mockUnlock = jest.fn();
const mockCancel = jest.fn();
jest.mock("../../actions/WalletUnlockActions", () => ({
    __esModule: true,
    default: {
        unlock: (...a: any[]) => mockUnlock(...a),
        cancel: (...a: any[]) => mockCancel(...a)
    }
}));
jest.mock("../../lib/chain/extraOperations", () => ({}));
jest.mock("bitsharesjs-ws", () => ({Apis: {instance: () => ({})}}));

import AdvancedActions from "../../actions/AdvancedActions";

beforeEach(() => {
    [
        mockNewTransaction,
        mockProcess,
        mockIsSigningFor,
        mockUnlock,
        mockCancel
    ].forEach(m => m.mockReset());
});

describe("AdvancedActions.sendNow", () => {
    it("puts the operations into one transaction and signs and sends it strictly, with no confirmation dialog of its own", async () => {
        const tr = {add_type_operation: jest.fn()};
        mockNewTransaction.mockReturnValue(tr);
        mockProcess.mockResolvedValue([{id: "abc"}]);
        const ops: Array<[string, any]> = [
            ["limit_order_create", {n: 1}],
            ["limit_order_create", {n: 2}]
        ];
        await expect(AdvancedActions.sendNow(ops)).resolves.toEqual([
            {id: "abc"}
        ]);
        expect(tr.add_type_operation.mock.calls).toEqual([
            ["limit_order_create", {n: 1}],
            ["limit_order_create", {n: 2}]
        ]);
        expect(mockProcess).toHaveBeenCalledWith(tr, null, true, [], {
            strict: true,
            confirm: false
        });
    });

    it("rejects when the send fails: nothing that failed is reported as sent", async () => {
        mockNewTransaction.mockReturnValue({add_type_operation: jest.fn()});
        mockProcess.mockRejectedValue(new Error("refused"));
        await expect(
            AdvancedActions.sendNow([["limit_order_create", {}]])
        ).rejects.toThrow("refused");
    });
});

describe("AdvancedActions.ensureUnlocked and cancelUnlock", () => {
    it("opens the wallet's unlock prompt", async () => {
        mockIsSigningFor.mockReturnValue(false);
        mockUnlock.mockResolvedValue(undefined);
        await AdvancedActions.ensureUnlocked("me");
        expect(mockUnlock).toHaveBeenCalledTimes(1);
    });

    it("asks nothing where the extension signs for the account: it asks for its own approval", async () => {
        mockIsSigningFor.mockReturnValue(true);
        await AdvancedActions.ensureUnlocked("me");
        expect(mockIsSigningFor).toHaveBeenCalledWith("me");
        expect(mockUnlock).not.toHaveBeenCalled();
    });

    it("unlocks with no account named (nothing to ask the extension about)", async () => {
        mockUnlock.mockResolvedValue(undefined);
        await AdvancedActions.ensureUnlocked(null);
        expect(mockIsSigningFor).not.toHaveBeenCalled();
        expect(mockUnlock).toHaveBeenCalledTimes(1);
    });

    it("a refused unlock is the rejection", async () => {
        mockIsSigningFor.mockReturnValue(false);
        mockUnlock.mockRejectedValue(new Error("cancelled"));
        await expect(AdvancedActions.ensureUnlocked("me")).rejects.toThrow(
            "cancelled"
        );
    });

    it("closes the prompt", () => {
        AdvancedActions.cancelUnlock();
        expect(mockCancel).toHaveBeenCalledTimes(1);
    });
});
