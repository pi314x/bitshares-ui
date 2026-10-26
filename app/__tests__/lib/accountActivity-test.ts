import {
    ActivityContext,
    describeActivity,
    newOperations,
    referencedIds,
    startedByAccount
} from "../../lib/common/accountActivity";
import {HistoryEntry} from "../../lib/common/fills";

const ME = "1.2.10";
const NAMES: {[code: number]: string} = {
    0: "transfer",
    1: "limit_order_create",
    2: "limit_order_cancel",
    3: "call_order_update",
    4: "fill_order",
    17: "asset_settle",
    42: "asset_settle_cancel",
    6: "account_update"
};
const ASSETS: {[id: string]: {symbol: string; precision: number}} = {
    "1.3.0": {symbol: "BTS", precision: 5},
    "1.3.5": {symbol: "USD", precision: 4}
};
const ACCOUNTS: {[id: string]: string} = {
    "1.2.10": "me",
    "1.2.99": "alice"
};
const WORDS: {[key: string]: string} = {
    sent: "Sent {amount} to {to}",
    received: "Received {amount} from {from}",
    order_placed: "Sell {sell} for at least {receive}",
    order_cancelled: "Order {order} cancelled",
    borrow_changed: "Collateral {collateral}, debt {debt}",
    margin_call_title: "Margin call",
    margin_call: "Sold {pays}, covered {receives}",
    settlement_title: "Settlement",
    settle_requested: "Settlement of {amount} requested",
    settle_instant: "Settled {amount} at once, received {received}",
    settle_done: "Settled: paid {pays}, received {receives}",
    settle_cancelled: "Settlement of {amount} cancelled",
    trade_done: "Trade done",
    trade_sold: "Sold {pays}, received {receives}",
    trade_sold_maker: "Your order sold {pays} for {receives}"
};
const ctx: ActivityContext = {
    accountId: ME,
    opName: code => NAMES[code],
    assetOf: id => ASSETS[id] || null,
    accountName: id => ACCOUNTS[id],
    t: (key, params = {}) =>
        (WORDS[key] || key).replace(/\{(\w+)\}/g, (_, k) => params[k]),
    typeLabel: name => `<${name}>`
};

const entry = (
    n: number,
    code: number,
    data: any,
    result?: any
): HistoryEntry => ({id: `1.11.${n}`, op: [code, data], result});
const bts = (units: number) => ({
    amount: String(units * 1e5),
    asset_id: "1.3.0"
});
const usd = (units: number) => ({
    amount: String(units * 1e4),
    asset_id: "1.3.5"
});

describe("newOperations", () => {
    const entries = [entry(12, 0, {}), entry(11, 6, {}), entry(10, 0, {})];

    it("returns what is newer than the baseline, oldest first", () => {
        expect(newOperations(entries, 10).map(e => e.id)).toEqual([
            "1.11.11",
            "1.11.12"
        ]);
        expect(newOperations(entries, 12)).toEqual([]);
    });

    it("keeps the newest when there are more than the limit", () => {
        const many = Array.from({length: 8}, (_, i) => entry(100 + i, 0, {}));
        expect(newOperations(many, 0, 3).map(e => e.id)).toEqual([
            "1.11.105",
            "1.11.106",
            "1.11.107"
        ]);
    });

    it("does not stop at the trades: every kind of operation is in", () => {
        const kinds = [0, 1, 2, 3, 4, 17, 42, 6].map((code, i) =>
            entry(200 + i, code, {})
        );
        expect(newOperations(kinds, 0)).toHaveLength(8);
    });
});

describe("referencedIds", () => {
    it("lists the assets and accounts an operation names, once each", () => {
        const ids = referencedIds([
            entry(1, 0, {from: ME, to: "1.2.99", amount: bts(1)}),
            entry(2, 4, {account_id: ME, pays: usd(1), receives: bts(2)}),
            entry(3, 17, {account: ME, amount: usd(1)}, [2, bts(3)])
        ]);
        expect(ids.accounts.sort()).toEqual(["1.2.10", "1.2.99"]);
        expect(ids.assets.sort()).toEqual(["1.3.0", "1.3.5"]);
    });

    it("also finds the asset a settlement result names", () => {
        const ids = referencedIds([
            entry(
                3,
                17,
                {account: ME, amount: {amount: "1", asset_id: "1.3.9"}},
                [2, {amount: "5", asset_id: "1.3.7"}]
            )
        ]);
        expect(ids.assets.sort()).toEqual(["1.3.7", "1.3.9"]);
    });
});

describe("startedByAccount", () => {
    it("is true for what the account sent, false for what it received", () => {
        expect(startedByAccount("transfer", {from: ME, to: "1.2.99"}, ME)).toBe(
            true
        );
        expect(startedByAccount("transfer", {from: "1.2.99", to: ME}, ME)).toBe(
            false
        );
    });

    it("is false for what the chain did on its own", () => {
        expect(startedByAccount("fill_order", {account_id: ME}, ME)).toBe(
            false
        );
        expect(startedByAccount("asset_settle_cancel", {account: ME}, ME)).toBe(
            false
        );
    });
});

describe("describeActivity", () => {
    it("writes a transfer out and a transfer in", () => {
        const out = describeActivity(
            entry(1, 0, {from: ME, to: "1.2.99", amount: bts(5)}),
            ctx
        );
        expect(out).toMatchObject({
            kind: "success",
            title: "<transfer>",
            description: "Sent 5.00000 BTS to alice",
            mine: true
        });
        const incoming = describeActivity(
            entry(2, 0, {from: "1.2.99", to: ME, amount: usd(2)}),
            ctx
        );
        expect(incoming).toMatchObject({
            description: "Received 2.0000 USD from alice",
            mine: false
        });
    });

    it("writes an order placed and cancelled", () => {
        expect(
            describeActivity(
                entry(3, 1, {
                    seller: ME,
                    amount_to_sell: bts(10),
                    min_to_receive: usd(2)
                }),
                ctx
            ).description
        ).toBe("Sell 10.00000 BTS for at least 2.0000 USD");
        expect(
            describeActivity(
                entry(4, 2, {fee_paying_account: ME, order: "1.7.55"}),
                ctx
            ).description
        ).toBe("Order 1.7.55 cancelled");
    });

    it("tells a trade, a forced settlement and a margin call apart by the order that filled", () => {
        const fill = (order: string, extra = {}) =>
            describeActivity(
                entry(5, 4, {
                    account_id: ME,
                    order_id: order,
                    pays: usd(1),
                    receives: bts(20),
                    ...extra
                }),
                ctx
            );
        expect(fill("1.7.1")).toMatchObject({
            title: "Trade done",
            description: "Sold 1.0000 USD, received 20.00000 BTS",
            kind: "success",
            mine: false
        });
        expect(fill("1.7.1", {is_maker: true}).description).toBe(
            "Your order sold 1.0000 USD for 20.00000 BTS"
        );
        expect(fill("1.4.9")).toMatchObject({
            title: "Settlement",
            description: "Settled: paid 1.0000 USD, received 20.00000 BTS",
            kind: "success"
        });
        expect(fill("1.8.3")).toMatchObject({
            title: "Margin call",
            kind: "warning"
        });
    });

    it("writes a requested settlement, an instant one and a cancelled one", () => {
        const requested = describeActivity(
            entry(6, 17, {account: ME, amount: usd(3)}, [1, "1.4.2"]),
            ctx
        );
        expect(requested).toMatchObject({
            title: "Settlement",
            description: "Settlement of 3.0000 USD requested",
            mine: true
        });
        const instant = describeActivity(
            entry(7, 17, {account: ME, amount: usd(3)}, [2, bts(60)]),
            ctx
        );
        expect(instant.description).toBe(
            "Settled 3.0000 USD at once, received 60.00000 BTS"
        );
        const cancelled = describeActivity(
            entry(8, 42, {account: ME, amount: usd(3)}),
            ctx
        );
        expect(cancelled).toMatchObject({
            kind: "warning",
            description: "Settlement of 3.0000 USD cancelled",
            mine: false
        });
    });

    it("writes a change of the borrow position", () => {
        expect(
            describeActivity(
                entry(9, 3, {
                    funding_account: ME,
                    delta_collateral: bts(100),
                    delta_debt: usd(-4)
                }),
                ctx
            ).description
        ).toBe("Collateral 100.00000 BTS, debt -4.0000 USD");
    });

    it("gives any other operation its name, with no description when it moves nothing", () => {
        expect(describeActivity(entry(10, 6, {account: ME}), ctx)).toEqual({
            kind: "info",
            title: "<account_update>",
            description: "",
            mine: true
        });
    });

    it("does not break on an operation this wallet has no name for", () => {
        const note = describeActivity(entry(11, 999, {}), ctx);
        expect(note.title).toBe("999");
    });

    it("writes the raw amount while an asset is not known yet", () => {
        const unknown = describeActivity(
            entry(12, 0, {
                from: ME,
                to: "1.2.99",
                amount: {amount: "42", asset_id: "1.3.77"}
            }),
            ctx
        );
        expect(unknown.description).toBe("Sent 42 1.3.77 to alice");
    });
});
