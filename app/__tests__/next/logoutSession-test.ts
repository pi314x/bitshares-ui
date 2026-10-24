// Log out ends the session: the wallet is locked, and neither the cloud
// wallet's password account nor the current account pinned to it is kept.
// Real AccountStore and AccountActions; only the wallet's lock action and the
// idb layer are stubbed.
jest.mock("idb-instance", () => ({
    __esModule: true,
    default: {instance: () => ({db: () => ({transaction: () => ({})})})}
}));

const mockLock = jest.fn();
jest.mock("actions/WalletUnlockActions", () => ({
    __esModule: true,
    default: {lock: () => mockLock()}
}));

import {patchState} from "../../store/slices/accountSlice";
import {reduxStore} from "../../store/reduxStore";
import AccountStore from "../../stores/AccountStore";
import {logoutSession} from "../../next/logoutSession";

const state = () => (AccountStore as any).getState();

describe("logoutSession", () => {
    beforeEach(() => {
        mockLock.mockClear();
        window.localStorage.clear();
    });

    it("locks the wallet and leaves no password account and no current account", () => {
        reduxStore.dispatch(
            patchState({passwordAccount: "cloudwallet"} as any)
        );
        (AccountStore as any).setCurrentAccount("cloudwallet");
        expect(state().currentAccount).toBe("cloudwallet");

        logoutSession();

        expect(mockLock).toHaveBeenCalledTimes(1);
        expect(state().passwordAccount).toBeFalsy();
        expect(state().currentAccount).toBeNull();
    });

    it("does not bring the account back when the store looks for a default", () => {
        reduxStore.dispatch(
            patchState({passwordAccount: "cloudwallet"} as any)
        );
        (AccountStore as any).setCurrentAccount("cloudwallet");

        logoutSession();
        (AccountStore as any).tryToSetCurrentAccount();

        expect(state().currentAccount).toBeNull();
    });
});
