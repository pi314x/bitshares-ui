import {LocalDataInput, localFacts} from "../../lib/common/localData";
import localeEn from "../../assets/locales/locale-en.json";

const base: LocalDataInput = {
    walletNames: ["default"],
    currentWallet: "default",
    passwordLogin: false,
    locked: true,
    keyCount: 3,
    linkedAccounts: 2,
    hiddenAccounts: 0,
    currentAccount: "johnr",
    extensionConnected: false,
    language: "en",
    theme: "dark",
    node: "wss://node.xbts.io/ws"
};
const byId = (facts: ReturnType<typeof localFacts>) =>
    Object.fromEntries(facts.map(f => [f.id, f]));

describe("localFacts", () => {
    it("states the wallet, its lock, the keys and the accounts", () => {
        const f = byId(localFacts(base));
        expect(f.wallet).toMatchObject({
            value: "wallet_one",
            params: {name: "default"},
            tone: "ok"
        });
        expect(f.lock).toMatchObject({value: "locked", tone: "neutral"});
        expect(f.keys).toMatchObject({value: "keys_some", params: {count: 3}});
        expect(f.accounts).toMatchObject({value: "accounts_some"});
        expect(f.current).toMatchObject({params: {name: "johnr"}});
        expect(f.extension.value).toBe("extension_off");
    });

    it("warns while the wallet is unlocked", () => {
        expect(byId(localFacts({...base, locked: false})).lock).toMatchObject({
            value: "unlocked",
            tone: "warn"
        });
    });

    it("says there is no wallet, or that a password is the sign-in, and has no lock row", () => {
        const none = byId(
            localFacts({
                ...base,
                walletNames: [],
                keyCount: 0,
                linkedAccounts: 0
            })
        );
        expect(none.wallet.value).toBe("wallet_none");
        expect(none.lock).toBeUndefined();
        expect(none.keys.value).toBe("keys_none");
        expect(none.accounts.value).toBe("accounts_none");
        const pw = byId(
            localFacts({
                ...base,
                walletNames: [],
                keyCount: 0,
                passwordLogin: true
            })
        );
        expect(pw.wallet.value).toBe("wallet_password");
    });

    it("counts several wallets and hidden accounts", () => {
        const f = byId(
            localFacts({
                ...base,
                walletNames: ["default", "second"],
                hiddenAccounts: 1
            })
        );
        expect(f.wallet).toMatchObject({
            value: "wallet_several",
            params: {count: 2, name: "default"}
        });
        expect(f.accounts).toMatchObject({
            value: "accounts_hidden",
            params: {count: 2, hidden: 1}
        });
    });

    it("has a locale string for every label and value it can name", () => {
        const strings = (localeEn as any).settings.local_data;
        const inputs: LocalDataInput[] = [
            base,
            {...base, locked: false, extensionConnected: true},
            {
                ...base,
                walletNames: [],
                keyCount: 0,
                linkedAccounts: 0,
                currentAccount: null,
                passwordLogin: true
            },
            {...base, walletNames: ["a", "b"], hiddenAccounts: 1}
        ];
        inputs.forEach(input =>
            localFacts(input).forEach(fact => {
                expect(strings[`label_${fact.id}`]).toBeTruthy();
                expect(strings[fact.value]).toBeTruthy();
            })
        );
    });
});
