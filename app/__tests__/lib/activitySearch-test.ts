import {matchesQuery, searchText} from "../../lib/common/activitySearch";

const accounts: Record<string, string> = {
    "1.2.10": "thmsfnd02",
    "1.2.50": "xbts-hive"
};
const assets: Record<string, {symbol: string; precision: number}> = {
    "1.3.0": {symbol: "BTS", precision: 5},
    "1.3.7": {symbol: "XBTSX.HIVE", precision: 6}
};
const env = {
    account: (id: string) => accounts[id] || null,
    asset: (id: string) => assets[id] || null
};
const kind = {name: "transfer", label: "Transfer"};
const transfer = {
    id: "1.11.1401111864",
    block_num: 123456,
    op: [
        0,
        {
            fee: {amount: "91958", asset_id: "1.3.0"},
            from: "1.2.10",
            to: "1.2.50",
            amount: {amount: "820211111", asset_id: "1.3.7"},
            memo: {from: "BTS1", to: "BTS2", nonce: "99", message: "deadbeef"}
        }
    ] as [number, any]
};

describe("searchText", () => {
    it("says an operation in the words a person uses: the kind, accounts by name, assets by symbol, amounts as shown", () => {
        const {text, complete} = searchText(transfer, kind, env);
        expect(complete).toBe(true);
        for (const word of [
            "transfer",
            "thmsfnd02",
            "xbts-hive",
            "xbtsx.hive",
            "820.211111",
            "1.11.1401111864",
            "123456"
        ]) {
            expect(text).toContain(word);
        }
    });

    it("leaves out the fee (it is on every row) and the memo (it is encrypted)", () => {
        const {text} = searchText(transfer, kind, env);
        expect(text).not.toContain("0.91958");
        expect(text).not.toContain("deadbeef");
        expect(text).not.toContain("nonce");
    });

    it("reads the amounts and assets of orders and fills inside nested fields", () => {
        const order = {
            id: "1.11.5",
            block_num: 9,
            op: [
                1,
                {
                    seller: "1.2.10",
                    amount_to_sell: {amount: "3800000", asset_id: "1.3.0"},
                    min_to_receive: {amount: "5000000", asset_id: "1.3.7"},
                    fee: {amount: "1", asset_id: "1.3.0"}
                }
            ] as [number, any]
        };
        const {text} = searchText(
            order,
            {name: "limit_order_create", label: "Place order"},
            env
        );
        expect(text).toContain("place order");
        expect(text).toContain("38 bts");
        expect(text).toContain("5 xbtsx.hive");
    });

    it("says it is not complete while an account or an asset is not loaded, and keeps the id", () => {
        const half = {
            account: () => null,
            asset: (id: string) => assets[id] || null
        };
        const {text, complete} = searchText(transfer, kind, half);
        expect(complete).toBe(false);
        expect(text).toContain("1.2.50");
        const none = searchText(transfer, kind, {
            account: env.account,
            asset: () => null
        });
        expect(none.complete).toBe(false);
        // the amount as the chain has it, and the asset id, until the asset is there
        expect(none.text).toContain("820211111");
        expect(none.text).toContain("1.3.7");
    });

    it("copes with fields it does not know: nothing, null, a deep tree", () => {
        let deep: any = {value: "end"};
        for (let i = 0; i < 20; i++) deep = {inner: deep};
        const odd = {
            id: "1.11.1",
            op: [99, {a: null, b: undefined, c: deep}] as [number, any]
        };
        expect(() =>
            searchText(odd, {name: "x", label: "X"}, env)
        ).not.toThrow();
        expect(
            searchText(odd, {name: "x", label: "X"}, env).text
        ).not.toContain("end");
    });
});

describe("matchesQuery", () => {
    const {text} = searchText(transfer, kind, env);
    it("finds every word typed, in any order, in any case", () => {
        expect(matchesQuery(text, "xbts-hive transfer")).toBe(true);
        expect(matchesQuery(text, "  HIVE   thmsfnd02 ")).toBe(true);
        expect(matchesQuery(text, "820")).toBe(true);
    });
    it("finds nothing when one word is missing, and everything when nothing is typed", () => {
        expect(matchesQuery(text, "xbts-hive bitcoin")).toBe(false);
        expect(matchesQuery(text, "")).toBe(true);
        expect(matchesQuery(text, "   ")).toBe(true);
    });
});
