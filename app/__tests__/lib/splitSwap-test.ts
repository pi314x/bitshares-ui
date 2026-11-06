import {
    SPLIT_MIN_GAIN,
    SplitSwapInput,
    splitSwap,
    splitSwapOperations
} from "../../lib/common/splitSwap";
import {simPairKey, simulateOperations} from "../../lib/common/chainSim";
import {
    NO_MARKET_FEE,
    SwapPool,
    minReceive,
    quoteExactIn
} from "../../lib/common/poolSwap";
import {fillFromOrderBook} from "../../lib/common/priceCompare";

const CORE = "1.3.0";
const FUND = "1.3.1";
const big = (n: number | string) => BigInt(n);

// the market of a check against a real core node: a ladder of four orders for FUND at 4, 3, 2 and 1 FUND units per core
// unit (100,000 core units each), and a pool of core and FUND at 1 : 1
const ladder = () =>
    [400000, 300000, 200000, 100000].map(f => ({
        for_sale: String(f),
        sell_price: {
            base: {amount: String(f), asset_id: FUND},
            quote: {amount: "100000", asset_id: CORE}
        }
    }));
const pool = (
    balanceIn: number,
    balanceOut: number,
    takerFeePercent = 30
): SwapPool => ({
    balanceIn: big(balanceIn),
    balanceOut: big(balanceOut),
    takerFeePercent,
    feeIn: NO_MARKET_FEE,
    feeOut: NO_MARKET_FEE
});
const input = (over: Partial<SplitSwapInput> = {}): SplitSwapInput => {
    const swap = pool(2000000, 2000000);
    const pay = big(600000);
    const single = quoteExactIn(swap, pay)!.receive;
    return {
        pools: [{id: "1.19.0", swap}],
        book: ladder(),
        payAsset: CORE,
        receiveAsset: FUND,
        pay,
        feeOut: NO_MARKET_FEE,
        best: single,
        ...over
    };
};

describe("splitSwap", () => {
    it("splits a sale between the pool and the book where that pays more than the pool alone", () => {
        const request = input();
        const out = splitSwap(request)!;
        expect(out).not.toBeNull();
        expect(out.pools).toHaveLength(1);
        expect(out.pools[0].id).toBe("1.19.0");
        // the book takes the orders at a better price than the pool's, the pool the rest
        expect(out.book.pay > big(0)).toBe(true);
        expect(out.pools[0].pay > big(0)).toBe(true);
        expect(out.pay).toBe(request.pay);
        expect(out.book.pay + out.pools[0].pay).toBe(request.pay);
        expect(out.receive > (request.best as bigint)).toBe(true);
        // the parts are quoted the way each venue is alone
        expect(out.receive).toBe(
            out.pools[0].quote.receive + out.book.fill.receive
        );
        expect(out.pools[0].quote.receive).toBe(
            quoteExactIn(request.pools[0].swap, out.pools[0].pay)!.receive
        );
        expect(out.book.fill.receive).toBe(
            fillFromOrderBook(request.book, CORE, FUND, out.book.pay).receive
        );
    });

    it("is as good as the best split there is (a grid of a four hundredth of the sale)", () => {
        const request = input();
        const out = splitSwap(request)!;
        let brute = big(0);
        for (let f = 0; f <= 400; f++) {
            const toBook = (request.pay * big(f)) / big(400);
            const fill = fillFromOrderBook(request.book, CORE, FUND, toBook);
            if (toBook > big(0) && !fill.complete) continue;
            const rest = request.pay - fill.spent;
            const quote =
                rest > big(0)
                    ? quoteExactIn(request.pools[0].swap, rest)
                    : null;
            const total = fill.receive + (quote ? quote.receive : big(0));
            if (total > brute) brute = total;
        }
        expect(out.receive >= brute - brute / big(100000)).toBe(true);
    });

    it("makes no split where the pool alone is about as good", () => {
        // the pool pays 4 per core unit like the first order: the book would add nothing worth an operation
        const rich = pool(2000000, 8000000);
        const out = splitSwap(
            input({
                pools: [{id: "1.19.0", swap: rich}],
                pay: big(20000),
                best: quoteExactIn(rich, big(20000))!.receive
            })
        );
        expect(out).toBeNull();
    });

    it("makes no split where the book's price is worse than the pool's", () => {
        const dear = pool(2000000, 40000000); // 20 FUND units per core unit at the start
        const out = splitSwap(
            input({
                pools: [{id: "1.19.0", swap: dear}],
                pay: big(300000),
                best: quoteExactIn(dear, big(300000))!.receive
            })
        );
        expect(out).toBeNull();
    });

    it("asks for a gain: the same split is not made when it does not pay 1/2000 more than the best venue", () => {
        const request = input();
        const out = splitSwap(request)!;
        const noMore = splitSwap({...request, best: out.receive});
        expect(noMore).toBeNull();
        const barely = splitSwap({
            ...request,
            best: out.receive - out.receive / SPLIT_MIN_GAIN
        });
        expect(barely).toBeNull();
        const clearly = splitSwap({
            ...request,
            best: out.receive - out.receive / big(200)
        });
        expect(clearly).not.toBeNull();
    });

    it("is made without a best venue to beat (none can fill the sale)", () => {
        expect(splitSwap(input({best: null}))).not.toBeNull();
    });

    it("splits over two pools and the book, the pool that takes most first", () => {
        const request = input({
            pools: [
                {id: "1.19.0", swap: pool(500000, 500000)},
                {id: "1.19.9", swap: pool(4000000, 4000000)}
            ],
            best: null
        });
        const out = splitSwap(request)!;
        expect(out.pools.map(p => p.id)).toEqual(["1.19.9", "1.19.0"]);
        expect(out.pools[0].pay > out.pools[1].pay).toBe(true);
        expect(
            out.pools.reduce((s, p) => s + p.pay, big(0)) + out.book.pay
        ).toBe(request.pay);
        const alone = request.pools.map(
            p => quoteExactIn(p.swap, request.pay)!.receive
        );
        const bestAlone = alone[0] > alone[1] ? alone[0] : alone[1];
        expect(out.receive > bestAlone).toBe(true);
    });

    it("needs a book with orders on the side, a pool, and something to sell", () => {
        expect(splitSwap(input({book: []}))).toBeNull();
        expect(splitSwap(input({pools: []}))).toBeNull();
        expect(splitSwap(input({pay: big(0)}))).toBeNull();
        // orders that sell the other way round are no use
        expect(
            splitSwap(input({payAsset: FUND, receiveAsset: CORE}))
        ).toBeNull();
        // a stable pool has another curve: not split
        const stable = {...pool(2000000, 2000000), stable: true};
        expect(
            splitSwap(input({pools: [{id: "1.19.0", swap: stable}]}))
        ).toBeNull();
    });

    it("leaves a part too small for an operation of its own to the other venue: no split", () => {
        // the first order takes 100,000; a sale of 100,100 would leave the pool 100 (1/1000)
        const out = splitSwap(
            input({
                pay: big(100100),
                best: null,
                pools: [{id: "1.19.0", swap: pool(2000000, 2000000)}]
            })
        );
        if (out) {
            expect(out.pools[0].pay >= big(100100) / big(200)).toBe(true);
            expect(out.book.pay >= big(100100) / big(200)).toBe(true);
        }
    });

    it("takes the market fee of the received asset off the book's part as the book alone would", () => {
        const fee = {
            charges: true,
            makerPercent: 100,
            takerPercent: null,
            max: big("100000000")
        };
        const out = splitSwap(input({feeOut: fee, best: null}))!;
        const walk = fillFromOrderBook(ladder(), CORE, FUND, out.book.pay, fee);
        expect(out.book.fill.receive).toBe(walk.receive);
        expect(out.book.fill.gross > out.book.fill.receive).toBe(true);
    });
});

describe("splitSwapOperations", () => {
    const made = (slippage = 0.005, over: Partial<SplitSwapInput> = {}) => {
        const request = input(over);
        const split = splitSwap(request)!;
        const out = splitSwapOperations({
            accountId: "1.2.9",
            poolId: "1.19.0",
            payAsset: CORE,
            receiveAsset: FUND,
            split,
            slippage,
            feeOut: request.feeOut,
            expiration: new Date("2030-01-01T10:20:30.456Z")
        })!;
        return {request, split, out};
    };

    it("is a pool exchange for the pool's part and a fill-or-kill order for the book's, in this order", () => {
        const {split, out} = made();
        expect(out.operations.map(op => op[0])).toEqual([
            "liquidity_pool_exchange",
            "limit_order_create"
        ]);
        const [, exchange] = out.operations[0];
        const [, order] = out.operations[1];
        expect(exchange).toMatchObject({
            account: "1.2.9",
            pool: "1.19.0",
            amount_to_sell: {
                amount: String(split.pools[0].pay),
                asset_id: CORE
            },
            min_to_receive: {asset_id: FUND}
        });
        expect(order).toMatchObject({
            seller: "1.2.9",
            amount_to_sell: {amount: String(split.book.pay), asset_id: CORE},
            fill_or_kill: true,
            expiration: "2030-01-01T10:20:30"
        });
        expect(
            big(exchange.amount_to_sell.amount) +
                big(order.amount_to_sell.amount)
        ).toBe(split.pay);
    });

    it("asks of the pool its quote less the slippage, and of the order the price of the worst order it needs", () => {
        const {split, out} = made(0.01);
        expect(out.poolMin).toBe(
            minReceive(split.pools[0].quote.receive, 0.01)
        );
        const worst = split.book.fill.worst!;
        expect(out.bookLimit).toBe((split.book.pay * worst.base) / worst.quote);
        // the whole of the book's part is matched at that limit, not just its better orders
        const [, order] = out.operations[1];
        expect(order.min_to_receive.amount).toBe(String(out.bookLimit));
        expect(out.least).toBe(out.poolMin + out.bookLimit);
        // never more than the two parts give
        expect(out.least < split.receive).toBe(true);
    });

    it("is accepted by the simulation of the chain, and ends with what the split said", () => {
        const {request, split, out} = made();
        const state = {
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
                        balanceA: request.pools[0].swap.balanceIn,
                        balanceB: request.pools[0].swap.balanceOut,
                        takerFeePercent: 30
                    }
                ]
            ]),
            books: new Map([[simPairKey(CORE, FUND), request.book]]),
            balances: new Map([[CORE, request.pay]])
        };
        const done = simulateOperations(state, "1.2.9", out.operations);
        expect(done.ok).toBe(true);
        if (done.ok) {
            expect(done.balances.get(FUND)).toBe(split.receive);
            expect(done.balances.get(CORE)).toBe(big(0));
        }
    });

    it("has no price for an order that walked nothing", () => {
        const request = input();
        const split = splitSwap(request)!;
        const none = {
            ...split,
            book: {...split.book, fill: {...split.book.fill, worst: null}}
        };
        expect(
            splitSwapOperations({
                accountId: "1.2.9",
                poolId: "1.19.0",
                payAsset: CORE,
                receiveAsset: FUND,
                split: none,
                slippage: 0.005,
                feeOut: NO_MARKET_FEE,
                expiration: new Date()
            })
        ).toBeNull();
    });
});
