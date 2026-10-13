import {
    HistoryEntry,
    buildBalanceSeries,
    newOrderTracker,
    operationDelta
} from "../../lib/common/balanceHistory";

const ME = "1.2.10";
const OTHER = "1.2.20";
const BTS = "1.3.0";
const USD = "1.3.121";

const entry = (
    id: string,
    op: [number, any],
    block: number,
    result?: [number, any]
): HistoryEntry => ({id, op, block_num: block, result});

const asset = (amount: number | string, asset_id = BTS) => ({
    amount: String(amount),
    asset_id
});

const delta = (e: HistoryEntry, assetId = BTS, orders = newOrderTracker()) =>
    operationDelta(e, ME, assetId, orders);

describe("operationDelta", () => {
    it("transfer out: amount and fee; transfer in: amount only", () => {
        const out = entry(
            "1.11.1",
            [0, {from: ME, to: OTHER, amount: asset(1000), fee: asset(20)}],
            1
        );
        expect(delta(out)).toEqual({delta: BigInt(-1020), unresolved: false});
        const incoming = entry(
            "1.11.2",
            [0, {from: OTHER, to: ME, amount: asset(500), fee: asset(20)}],
            2
        );
        expect(delta(incoming)).toEqual({
            delta: BigInt(500),
            unresolved: false
        });
    });

    it("ignores other assets, and takes the fee in the asset it was paid in", () => {
        const e = entry(
            "1.11.3",
            [0, {from: ME, to: OTHER, amount: asset(7, USD), fee: asset(20)}],
            3
        );
        expect(delta(e, BTS).delta).toBe(BigInt(-20));
        expect(delta(e, USD).delta).toBe(BigInt(-7));
    });

    it("an order locks its sale amount, a fill pays the gross receive less market fee", () => {
        const orders = newOrderTracker();
        const create = entry(
            "1.11.4",
            [
                1,
                {
                    seller: ME,
                    amount_to_sell: asset(1000, USD),
                    min_to_receive: asset(50),
                    fee: asset(10)
                }
            ],
            4,
            [1, "1.7.55"]
        );
        expect(delta(create, USD, orders).delta).toBe(BigInt(-1000));
        expect(delta(create, BTS, orders).delta).toBe(BigInt(-10)); // fee
        const fill = entry(
            "1.11.5",
            [
                4,
                {
                    order_id: "1.7.55",
                    account_id: ME,
                    pays: asset(400, USD),
                    receives: asset(20),
                    fee: asset(1),
                    fill_price: {},
                    is_maker: true
                }
            ],
            5
        );
        expect(delta(fill, BTS, orders).delta).toBe(BigInt(19));
        expect(delta(fill, USD, orders).delta).toBe(BigInt(0)); // pays left at creation
    });

    it("a user cancel returns what the result says", () => {
        const cancel = entry(
            "1.11.6",
            [2, {fee_paying_account: ME, order: "1.7.55", fee: asset(0)}],
            6,
            [2, asset(600, USD)]
        );
        expect(delta(cancel, USD).delta).toBe(BigInt(600));
    });

    it("an expiry returns what was still for sale, from the tracked order", () => {
        const orders = newOrderTracker();
        delta(
            entry(
                "1.11.7",
                [
                    1,
                    {
                        seller: ME,
                        amount_to_sell: asset(1000, USD),
                        min_to_receive: asset(50),
                        fee: asset(0)
                    }
                ],
                7,
                [1, "1.7.60"]
            ),
            USD,
            orders
        );
        delta(
            entry(
                "1.11.8",
                [
                    4,
                    {
                        order_id: "1.7.60",
                        account_id: ME,
                        pays: asset(300, USD),
                        receives: asset(15),
                        fee: asset(0)
                    }
                ],
                8
            ),
            USD,
            orders
        );
        const expiry = entry(
            "1.11.9",
            [2, {fee_paying_account: ME, order: "1.7.60", fee: asset(0)}],
            9,
            [0, {}]
        );
        expect(delta(expiry, USD, orders)).toEqual({
            delta: BigInt(700),
            unresolved: false
        });
    });

    it("an expiry of an order not in the loaded history is unresolved", () => {
        const expiry = entry(
            "1.11.10",
            [2, {fee_paying_account: ME, order: "1.7.99", fee: asset(0, USD)}],
            10,
            [0, {}]
        );
        expect(delta(expiry, USD).unresolved).toBe(true);
    });

    it("vesting, margin and issuing", () => {
        expect(
            delta(
                entry(
                    "a",
                    [
                        33,
                        {
                            owner: ME,
                            vesting_balance: "1.13.1",
                            amount: asset(100),
                            fee: asset(0)
                        }
                    ],
                    1
                )
            ).delta
        ).toBe(BigInt(100));
        const call = entry(
            "b",
            [
                3,
                {
                    funding_account: ME,
                    delta_collateral: asset(500),
                    delta_debt: asset(20, USD),
                    fee: asset(0)
                }
            ],
            2
        );
        expect(delta(call, BTS).delta).toBe(BigInt(-500));
        expect(delta(call, USD).delta).toBe(BigInt(20));
        expect(
            delta(
                entry(
                    "c",
                    [
                        14,
                        {
                            issuer: ME,
                            asset_to_issue: asset(50, USD),
                            issue_to_account: OTHER,
                            fee: asset(0)
                        }
                    ],
                    3
                ),
                USD
            ).delta
        ).toBe(BigInt(0));
    });

    it("pool and exchange results are read from paid / received / fees", () => {
        const e = entry(
            "d",
            [
                63,
                {
                    account: ME,
                    pool: "1.19.1",
                    amount_to_sell: asset(100),
                    min_to_receive: asset(1, USD),
                    fee: asset(5)
                }
            ],
            1,
            [
                4,
                {
                    paid: [asset(100)],
                    received: [asset(9, USD)],
                    fees: [asset(5)]
                }
            ]
        );
        expect(delta(e, BTS).delta).toBe(BigInt(-105));
        expect(delta(e, USD).delta).toBe(BigInt(9));
    });

    it("flags an unknown operation that touches the asset, not one that does not", () => {
        const unknown = entry(
            "e",
            [99, {account: ME, amount: asset(5), fee: asset(0)}],
            1
        );
        expect(delta(unknown).unresolved).toBe(true);
        expect(delta(unknown, USD).unresolved).toBe(false);
    });
});

describe("buildBalanceSeries", () => {
    it("ends at the current balance and steps back through the deltas", () => {
        const entriesNewestFirst = [
            entry(
                "3",
                [0, {from: ME, to: OTHER, amount: asset(300), fee: asset(0)}],
                30
            ),
            entry(
                "2",
                [0, {from: OTHER, to: ME, amount: asset(1000), fee: asset(0)}],
                20
            ),
            entry(
                "1",
                [0, {from: OTHER, to: ME, amount: asset(500), fee: asset(0)}],
                10
            )
        ];
        const series = buildBalanceSeries(
            entriesNewestFirst,
            BigInt(1200), // now
            ME,
            BTS,
            {10: 1000, 20: 2000, 30: 3000},
            4000
        );
        expect(series.points.map(p => [p.time, Number(p.balance)])).toEqual([
            [999, 0], // before the oldest loaded operation
            [1000, 500],
            [2000, 1500],
            [3000, 1200],
            [4000, 1200]
        ]);
        expect(series.unresolved).toBe(0);
        expect(series.applied).toBe(3);
    });

    it("counts what it could not read and still ends at the current balance", () => {
        const series = buildBalanceSeries(
            [
                entry(
                    "1",
                    [99, {account: ME, amount: asset(5), fee: asset(0)}],
                    10
                )
            ],
            BigInt(42),
            ME,
            BTS,
            {10: 1000},
            2000
        );
        expect(series.unresolved).toBe(1);
        expect(Number(series.points[series.points.length - 1].balance)).toBe(
            42
        );
    });

    it("has a single point for an account with no history", () => {
        const series = buildBalanceSeries([], BigInt(7), ME, BTS, {}, 5000);
        expect(series.points).toEqual([{time: 5000, balance: BigInt(7)}]);
    });
});
