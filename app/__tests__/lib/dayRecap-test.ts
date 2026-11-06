import {
    DAY_SECONDS,
    RecapEntry,
    isQuiet,
    largest,
    recapAssets,
    recapOf
} from "../../lib/common/dayRecap";

const ME = "1.2.10";
const NAMES: {[code: number]: string} = {
    0: "transfer",
    1: "limit_order_create",
    2: "limit_order_cancel",
    4: "fill_order",
    6: "account_update",
    61: "liquidity_pool_deposit",
    62: "liquidity_pool_withdraw",
    63: "liquidity_pool_exchange",
    90: "samet_fund_borrow"
};
const NOW = 2_000_000_000;
const amount = (n: number, asset = "1.3.0") => ({
    amount: String(n),
    asset_id: asset
});
const fee = (n = 100) => amount(n);
const entry = (
    n: number,
    block: number,
    code: number,
    data: any
): RecapEntry => ({
    id: `1.11.${n}`,
    op: [code, data],
    block_num: block
});
// block b happened (NOW - hours) seconds ago: block 100 an hour ago, block 90 a day and an hour ago
const times: {[block: number]: number} = {
    100: NOW - 3600,
    99: NOW - 7200,
    98: NOW - 10800,
    90: NOW - DAY_SECONDS - 3600
};
const run = (entries: RecapEntry[], over: any = {}) =>
    recapOf({
        entries,
        times,
        complete: false,
        accountId: ME,
        nowSec: NOW,
        opName: code => NAMES[code],
        ...over
    });

describe("what happened in the last 24 hours", () => {
    it("counts transfers in and out by asset", () => {
        const recap = run([
            entry(5, 100, 0, {
                from: "1.2.99",
                to: ME,
                amount: amount(500),
                fee: fee()
            }),
            entry(4, 99, 0, {
                from: "1.2.98",
                to: ME,
                amount: amount(300, "1.3.5"),
                fee: fee()
            }),
            entry(3, 98, 0, {
                from: ME,
                to: "1.2.99",
                amount: amount(200),
                fee: fee()
            })
        ]);
        expect(recap.operations).toBe(3);
        expect(recap.transfersIn.count).toBe(2);
        expect(recap.transfersIn.total.get("1.3.0")).toBe(BigInt(500));
        expect(recap.transfersIn.total.get("1.3.5")).toBe(BigInt(300));
        expect(recap.transfersOut.count).toBe(1);
        expect(recap.transfersOut.total.get("1.3.0")).toBe(BigInt(200));
        // the fee of the transfer the account sent; the ones it received cost it nothing
        expect(recap.fees.get("1.3.0")).toBe(BigInt(100));
    });

    it("counts order fills with what was sold and what came back, the account's own only", () => {
        const recap = run([
            entry(6, 100, 4, {
                account_id: ME,
                order_id: "1.7.1",
                pays: amount(10, "1.3.5"),
                receives: amount(300)
            }),
            entry(5, 100, 4, {
                account_id: ME,
                order_id: "1.7.1",
                pays: amount(5, "1.3.5"),
                receives: amount(150)
            }),
            // somebody else's fill that the history lists
            entry(4, 99, 4, {
                account_id: "1.2.99",
                order_id: "1.7.9",
                pays: amount(1),
                receives: amount(1)
            })
        ]);
        expect(recap.fills.count).toBe(2);
        expect(recap.fills.sold.get("1.3.5")).toBe(BigInt(15));
        expect(recap.fills.got.get("1.3.0")).toBe(BigInt(450));
        // a fill is the chain's: it costs no fee
        expect(recap.fees.size).toBe(0);
    });

    it("counts orders placed and cancelled, pool swaps and liquidity, and flash loans", () => {
        const recap = run([
            entry(9, 100, 1, {seller: ME, fee: fee(5)}),
            entry(8, 100, 1, {seller: ME, fee: fee(5)}),
            entry(7, 100, 2, {
                fee_paying_account: ME,
                order: "1.7.1",
                fee: fee(0)
            }),
            entry(6, 99, 63, {account: ME, pool: "1.19.1", fee: fee(7)}),
            entry(5, 99, 61, {account: ME, pool: "1.19.1", fee: fee(7)}),
            entry(4, 99, 62, {account: ME, pool: "1.19.1", fee: fee(7)}),
            entry(3, 98, 90, {borrower: ME, fund_id: "1.20.1", fee: fee(3)}),
            entry(2, 98, 6, {account: ME, fee: fee(1)})
        ]);
        expect(recap.orders).toEqual({placed: 2, cancelled: 1});
        expect(recap.pools).toEqual({swaps: 1, liquidity: 2});
        expect(recap.loans).toBe(1);
        expect(recap.operations).toBe(8);
        expect(recap.fees.get("1.3.0")).toBe(
            BigInt(5 + 5 + 0 + 7 + 7 + 7 + 3 + 1)
        );
    });

    it("stops at the first operation older than a day, and says the window is all there", () => {
        const recap = run([
            entry(3, 100, 1, {seller: ME, fee: fee()}),
            entry(2, 90, 1, {seller: ME, fee: fee()}),
            entry(1, 90, 1, {seller: ME, fee: fee()})
        ]);
        expect(recap.operations).toBe(1);
        expect(recap.covered).toBe(true);
    });

    it("says the window is not all there when the loaded history does not reach back a day", () => {
        const recap = run([entry(3, 100, 1, {seller: ME, fee: fee()})]);
        expect(recap.covered).toBe(false);
        // unless it is all the account has
        expect(
            run([entry(3, 100, 1, {seller: ME, fee: fee()})], {complete: true})
                .covered
        ).toBe(true);
    });

    it("leaves out an operation whose block time is not known yet", () => {
        const recap = run([
            entry(3, 555, 1, {seller: ME, fee: fee()}),
            entry(2, 100, 1, {seller: ME, fee: fee()})
        ]);
        expect(recap.operations).toBe(1);
    });

    it("is quiet when nothing happened and the whole day is loaded", () => {
        expect(isQuiet(run([entry(1, 90, 1, {seller: ME})]))).toBe(true);
        expect(isQuiet(run([]))).toBe(false);
        expect(isQuiet(run([], {complete: true}))).toBe(true);
        expect(isQuiet(run([entry(3, 100, 1, {seller: ME})]))).toBe(false);
    });

    it("lists the assets it names, and the largest totals first", () => {
        const recap = run([
            entry(2, 100, 0, {
                from: ME,
                to: "1.2.99",
                amount: amount(5, "1.3.7"),
                fee: fee()
            }),
            entry(1, 99, 4, {
                account_id: ME,
                order_id: "1.7.1",
                pays: amount(1, "1.3.5"),
                receives: amount(9)
            })
        ]);
        expect(recapAssets(recap).sort()).toEqual(["1.3.0", "1.3.5", "1.3.7"]);
        const totals = new Map<string, bigint>([
            ["a", BigInt(5)],
            ["b", BigInt(50)],
            ["c", BigInt(500)],
            ["d", BigInt(0)]
        ]);
        expect(largest(totals, 2)).toEqual({
            shown: [
                ["c", BigInt(500)],
                ["b", BigInt(50)]
            ],
            more: 1
        });
        expect(largest(new Map(), 3)).toEqual({shown: [], more: 0});
    });

    it("adds up what was gained and lost of each token: transfers, fills, fees, and an order placed before the window and cancelled in it", () => {
        const placed = {
            id: "1.11.1",
            block_num: 90,
            // placed a day and an hour ago: 100 AAA locked in order 1.7.1
            op: [
                1,
                {
                    seller: ME,
                    amount_to_sell: amount(100, "1.3.5"),
                    min_to_receive: amount(1),
                    fee: fee(10)
                }
            ] as [number, any],
            result: [1, "1.7.1"] as [number, any]
        };
        const entries = [
            entry(6, 100, 0, {
                from: "1.2.99",
                to: ME,
                amount: amount(500, "1.3.5"),
                fee: fee()
            }),
            entry(5, 100, 2, {
                fee_paying_account: ME,
                order: "1.7.1",
                fee: fee(0)
            }),
            entry(4, 99, 4, {
                account_id: ME,
                order_id: "1.7.2",
                pays: amount(40, "1.3.5"),
                receives: amount(300)
            }),
            entry(3, 99, 0, {
                from: ME,
                to: "1.2.98",
                amount: amount(50),
                fee: fee(7)
            }),
            placed
        ];
        const recap = run(entries);
        // 1.3.5: +500 received, -40 sold in the fill; the cancelled order gave its 100 back, which is not a gain
        // (they were the account's already, locked in the order before the window)
        expect(recap.net.get("1.3.5") === BigInt(500 - 40)).toBe(true);
        // 1.3.0: +300 from the fill, -50 sent, -7 fee of the transfer; the order placed before the window cost nothing in it
        expect(recap.net.get("1.3.0") === BigInt(300 - 50 - 7)).toBe(true);
    });

    it("leaves out a token that did not change, and has none when nothing was done", () => {
        const back = run([
            entry(2, 100, 0, {
                from: ME,
                to: "1.2.99",
                amount: amount(5),
                fee: fee(0)
            }),
            entry(1, 99, 0, {
                from: "1.2.99",
                to: ME,
                amount: amount(5),
                fee: fee(0)
            })
        ]);
        expect(back.net.has("1.3.0")).toBe(false);
        expect(run([]).net.size).toBe(0);
    });
});
