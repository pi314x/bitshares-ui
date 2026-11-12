// The user's own accounts as the address book gets them: the wallet's accounts (the account menu's) and the account the
// extension is connected as - the hook reads the same stores the shell does.
import * as React from "react";
import {render} from "@testing-library/react";

const mockState: {
    wallet: string[] | undefined;
    status: string;
    signer: {account: {accountName: string} | null};
} = {wallet: ["alice"], status: "disconnected", signer: {account: null}};

jest.mock("../../store/slices/accountSlice", () => ({
    __esModule: true,
    selectAccountState: () => ({
        myActiveAccounts: mockState.wallet
            ? {toArray: () => mockState.wallet}
            : undefined
    })
}));
jest.mock("../../store/slices/externalSignerSlice", () => ({
    __esModule: true,
    selectExternalSigner: () => mockState.signer,
    selectExternalSigningActive: () =>
        mockState.status === "connected" && !!mockState.signer.account
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    __esModule: true,
    useReduxState: (selector: any) => selector({})
}));

import {useOwnAccounts} from "../../components/AddressBook/useOwnAccounts";

let seen: any[] = [];
const Probe = () => {
    seen = useOwnAccounts();
    return null;
};

describe("useOwnAccounts", () => {
    beforeEach(() => {
        mockState.wallet = ["alice", "bob"];
        mockState.status = "disconnected";
        mockState.signer = {account: null};
    });

    it("is the wallet's accounts while the extension is not connected", () => {
        render(<Probe />);
        expect(seen.map(a => `${a.name}:${a.source}`)).toEqual([
            "alice:wallet",
            "bob:wallet"
        ]);
    });

    it("adds the extension's account first, once it is connected as one", () => {
        mockState.status = "connected";
        mockState.signer = {account: {accountName: "carol"}};
        render(<Probe />);
        expect(seen.map(a => `${a.name}:${a.source}`)).toEqual([
            "carol:extension",
            "alice:wallet",
            "bob:wallet"
        ]);
    });

    it("does not count an extension that is not connected", () => {
        mockState.status = "disconnected";
        mockState.signer = {account: {accountName: "carol"}};
        render(<Probe />);
        expect(seen.map(a => a.name)).toEqual(["alice", "bob"]);
    });

    it("copes with a wallet whose accounts are not there yet", () => {
        mockState.wallet = undefined;
        render(<Probe />);
        expect(seen).toEqual([]);
    });
});
