import {
    SimState,
    simPairKey,
    simulateOperations
} from "../../lib/common/chainSim";
import {NO_MARKET_FEE, quoteExactIn} from "../../lib/common/poolSwap";

const CORE = "1.3.0";
const FUND = "1.3.1";
const ME = "1.2.8";
const big = (n: number | string) => BigInt(n);

// the orders of a check against a real core node: four makers sell FUND for 100,000 core units each, at
// 4, 3, 2 and 1 FUND units per core unit
const ladder = () =>
    [400000, 300000, 200000, 100000].map(f => ({
        for_sale: String(f),
        sell_price: {
            base: {amount: String(f), asset_id: FUND},
            quote: {amount: "100000", asset_id: CORE}
        }
    }));

const state = (overrides: Partial<SimState> = {}): SimState => ({
    assets: new Map([
        [CORE, {fee: NO_MARKET_FEE}],
        [FUND, {fee: NO_MARKET_FEE}]
    ]),
    pools: new Map([
        [
            "1.19.0",
            {
                assetA: CORE,
                assetB: FUND,
                balanceA: big(2000000),
                balanceB: big(2000000),
                takerFeePercent: 30
            }
        ]
    ]),
    books: new Map([[simPairKey(CORE, FUND), ladder() as any]]),
    balances: new Map([[CORE, big(1000000)]]),
    ...overrides
});

const order = (
    sell: number,
    least: number,
    fillOrKill = true
): [string, any] => [
    "limit_order_create",
    {
        seller: ME,
        amount_to_sell: {amount: String(sell), asset_id: CORE},
        min_to_receive: {amount: String(least), asset_id: FUND},
        fill_or_kill: fillOrKill,
        expiration: "2030-01-01T00:00:00",
        extensions: []
    }
];
const exchange = (
    sell: number,
    least: number,
    from = CORE,
    to = FUND
): [string, any] => [
    "liquidity_pool_exchange",
    {
        account: ME,
        pool: "1.19.0",
        amount_to_sell: {amount: String(sell), asset_id: from},
        min_to_receive: {amount: String(least), asset_id: to},
        extensions: []
    }
];

describe("simulateOperations: a fill-or-kill order over a ladder of orders (as the chain does it)", () => {
    // the real chain (a private chain made with core's witness_node): killed at the walk's total, killed a unit above the worst order's price,
    // filled at the worst order's price
    it("kills an order that asks for the total of the walk: the average price cannot reach the worse orders", () => {
        const out = simulateOperations(state(), ME, [order(400000, 1000000)]);
        expect(out.ok).toBe(false);
        if (!out.ok) expect([out.index, out.reason]).toEqual([0, "killed"]);
    });

    it("kills an order a unit above the worst order's price, and fills it at the worst order's price", () => {
        const above = simulateOperations(state(), ME, [order(400000, 400001)]);
        expect(above.ok).toBe(false);
        const at = simulateOperations(state(), ME, [order(400000, 400000)]);
        expect(at.ok).toBe(true);
        if (at.ok) {
            // every order was matched at its maker's price: the walk's total
            expect(at.balances.get(FUND)).toBe(big(1000000));
            expect(at.balances.get(CORE)).toBe(big(600000));
            expect(at.steps[0]).toMatchObject({
                kind: "order",
                sold: big(400000),
                received: big(1000000)
            });
            // and the orders are gone for what comes after
            expect(at.books.get(simPairKey(CORE, FUND))).toHaveLength(0);
        }
    });

    it("uses up what the order before it took: a second order finds the book empty", () => {
        const out = simulateOperations(state(), ME, [
            order(400000, 400000),
            order(100000, 100000)
        ]);
        expect(out.ok).toBe(false);
        if (!out.ok) expect([out.index, out.reason]).toEqual([1, "killed"]);
    });

    it("takes part of an order and leaves the rest of it for the next", () => {
        const out = simulateOperations(state(), ME, [
            order(50000, 50000),
            order(50000, 50000)
        ]);
        expect(out.ok).toBe(true);
        if (out.ok) {
            // 50,000 core at 4 FUND each, then the rest of the first order (50,000 of its 100,000) at 4
            expect(out.balances.get(FUND)).toBe(big(400000));
            expect(out.books.get(simPairKey(CORE, FUND))).toHaveLength(3);
        }
    });

    it("lets an order that is not fill-or-kill match what it can and leaves the rest on the book", () => {
        const out = simulateOperations(state(), ME, [
            order(400000, 1000000, false)
        ]);
        expect(out.ok).toBe(true);
        if (out.ok) {
            // only the first two orders are at its price or better (4 and 3 against its limit of 2.5)
            expect(out.steps[0].received).toBe(big(700000));
            expect(out.steps[0].rests).toBe(big(200000));
            expect(out.balances.get(CORE)).toBe(big(600000));
            expect(out.balances.get(FUND)).toBe(big(700000));
        }
    });

    it("matches an order whose limit is exactly an order's price", () => {
        // 100,000 core for 400,000 FUND is exactly the first order's price
        expect(
            simulateOperations(state(), ME, [order(100000, 400000)]).ok
        ).toBe(true);
        expect(
            simulateOperations(state(), ME, [order(100000, 400001)]).ok
        ).toBe(false);
    });

    it("kills an order for a book with no order of that side", () => {
        const out = simulateOperations(state({books: new Map()}), ME, [
            order(1000, 1)
        ]);
        expect(out.ok).toBe(false);
    });
});

describe("simulateOperations: a pool exchange", () => {
    it("pays what the pool's curve pays, compared with min_to_receive as the chain does", () => {
        // the pool of that check: 200,000 core into 2,000,000 : 2,000,000 at 0.3% gave 181,273
        const out = simulateOperations(state(), ME, [exchange(200000, 181273)]);
        expect(out.ok).toBe(true);
        if (out.ok) {
            expect(out.steps[0].received).toBe(big(181273));
            expect(out.balances.get(FUND)).toBe(big(181273));
            const pool = out.pools.get("1.19.0")!;
            expect(pool.balanceA).toBe(big(2200000));
            expect(pool.balanceB < big(2000000)).toBe(true);
        }
        const dear = simulateOperations(state(), ME, [
            exchange(200000, 181274)
        ]);
        expect(dear.ok).toBe(false);
        if (!dear.ok) expect(dear.reason).toBe("below_minimum");
    });

    it("is the quote of the pool for the same swap", () => {
        const quote = quoteExactIn(
            {
                balanceIn: big(2000000),
                balanceOut: big(2000000),
                takerFeePercent: 30,
                feeIn: NO_MARKET_FEE,
                feeOut: NO_MARKET_FEE
            },
            big(123456)
        )!;
        const out = simulateOperations(state(), ME, [exchange(123456, 1)]);
        expect(out.ok && out.steps[0].received).toBe(quote.receive);
    });

    it("compares min_to_receive with what the account receives after the market fee of the received asset", () => {
        const fee = {
            charges: true,
            makerPercent: 100,
            takerPercent: null,
            max: big("1000000000")
        };
        const withFee = state();
        withFee.assets.set(FUND, {fee});
        const gross = 181273;
        // the fee is 1%: the account receives less than the pool pays
        const out = simulateOperations(withFee, ME, [exchange(200000, gross)]);
        expect(out.ok).toBe(false);
        const net = simulateOperations(withFee, ME, [exchange(200000, 1)]);
        expect(net.ok && net.steps[0].received < big(gross)).toBe(true);
        if (net.ok) {
            const ok = simulateOperations(withFee, ME, [
                exchange(200000, Number(net.steps[0].received))
            ]);
            expect(ok.ok).toBe(true);
        }
    });

    it("works in either direction of the pool", () => {
        const s = state({balances: new Map([[FUND, big(100000)]])});
        const out = simulateOperations(s, ME, [
            exchange(100000, 90000, FUND, CORE)
        ]);
        expect(out.ok).toBe(true);
        if (out.ok) expect(out.balances.get(CORE)! > big(90000)).toBe(true);
    });

    it("refuses an unknown pool and the wrong assets", () => {
        const op = exchange(1000, 1) as any;
        const unknown = simulateOperations(state(), ME, [
            ["liquidity_pool_exchange", {...op[1], pool: "1.19.9"}]
        ]);
        expect(!unknown.ok && unknown.reason).toBe("unknown_pool");
        const wrong = simulateOperations(state(), ME, [
            exchange(1000, 1, CORE, "1.3.9")
        ]);
        expect(!wrong.ok && wrong.reason).toBe("unknown_asset");
    });
});

describe("simulateOperations: a transaction", () => {
    it("applies the operations one after the other, each on what the one before left", () => {
        // sell core into the pool, then sell what came out into the pool again, back
        const out = simulateOperations(state(), ME, [
            exchange(200000, 1),
            exchange(150000, 1, FUND, CORE)
        ]);
        expect(out.ok).toBe(true);
        // the second finds the pool moved by the first: it pays less than a fresh pool would
        const fresh = simulateOperations(
            state({balances: new Map([[FUND, big(150000)]])}),
            ME,
            [exchange(150000, 1, FUND, CORE)]
        );
        if (out.ok && fresh.ok) {
            expect(out.steps[1].received).not.toBe(fresh.steps[0].received);
        }
    });

    it("refuses selling more than the account holds", () => {
        const out = simulateOperations(state(), ME, [exchange(1000001, 1)]);
        expect(!out.ok && out.reason).toBe("insufficient_balance");
        const out2 = simulateOperations(state(), ME, [
            order(600000, 1, false),
            order(600000, 1, false)
        ]);
        expect(!out2.ok && out2.index).toBe(1);
    });

    it("refuses the operations of another account and what it does not know", () => {
        const other = simulateOperations(state(), "1.2.99", [
            exchange(1000, 1)
        ]);
        expect(!other.ok && other.reason).toBe("wrong_account");
        const odd = simulateOperations(state(), ME, [["transfer", {from: ME}]]);
        expect(!odd.ok && odd.reason).toBe("unsupported");
    });

    it("leaves the state it was given as it was", () => {
        const s = state();
        const before = JSON.stringify([...s.balances], (_k, v) =>
            typeof v === "bigint" ? String(v) : v
        );
        const books = JSON.stringify(s.books.get(simPairKey(CORE, FUND)));
        simulateOperations(s, ME, [order(400000, 400000), exchange(1000, 1)]);
        expect(
            JSON.stringify([...s.balances], (_k, v) =>
                typeof v === "bigint" ? String(v) : v
            )
        ).toBe(before);
        expect(JSON.stringify(s.books.get(simPairKey(CORE, FUND)))).toBe(books);
        expect(s.pools.get("1.19.0")!.balanceA).toBe(big(2000000));
    });

    it("lets a flash loan be borrowed and repaid with its fee, and refuses one that is not repaid or cannot be", () => {
        const borrow: [string, any] = [
            "samet_fund_borrow",
            {
                borrower: ME,
                fund_id: "1.20.1",
                borrow_amount: {amount: "500000", asset_id: CORE},
                extensions: []
            }
        ];
        const repay = (fee: string): [string, any] => [
            "samet_fund_repay",
            {
                account: ME,
                fund_id: "1.20.1",
                repay_amount: {amount: "500000", asset_id: CORE},
                fund_fee: {amount: fee, asset_id: CORE},
                extensions: []
            }
        ];
        const empty = state({balances: new Map()});
        const ok = simulateOperations(empty, ME, [borrow, repay("100")]);
        expect(ok.ok).toBe(false); // the 100 for the fee is not there: the account held nothing
        const funded = state({balances: new Map([[CORE, big(100)]])});
        const paid = simulateOperations(funded, ME, [borrow, repay("100")]);
        expect(paid.ok).toBe(true);
        if (paid.ok) expect(paid.balances.get(CORE)).toBe(big(0));
        const owed = simulateOperations(funded, ME, [borrow]);
        expect(!owed.ok && owed.reason).toBe("loan_not_repaid");
    });
});
