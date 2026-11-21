import {ownAccounts} from "../../lib/common/ownAccounts";

describe("ownAccounts", () => {
    it("lists the accounts of the wallet, in their order", () => {
        expect(ownAccounts(["alice", "bob"], null)).toEqual([
            {name: "alice", source: "wallet"},
            {name: "bob", source: "wallet"}
        ]);
    });

    it("puts the account the extension is connected as first, though it is not in the wallet", () => {
        expect(ownAccounts(["alice"], "carol")).toEqual([
            {name: "carol", source: "extension"},
            {name: "alice", source: "wallet"}
        ]);
    });

    it("lists an account once, as the extension's, when the wallet has it too", () => {
        expect(ownAccounts(["alice", "carol"], "carol")).toEqual([
            {name: "carol", source: "extension"},
            {name: "alice", source: "wallet"}
        ]);
    });

    it("has nobody when there is nobody", () => {
        expect(ownAccounts([], null)).toEqual([]);
    });
});
