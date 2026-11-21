import {
    fillFromOrderBook,
    matchingOrders,
    walkOrderBook
} from "../../lib/common/priceCompare";
import {NO_MARKET_FEE} from "../../lib/common/poolSwap";

const CORE = "1.3.0";
const FUND = "1.3.1";
const big = (n: number | string) => BigInt(n);

// four makers sell FUND for 100,000 core units each, at 4, 3, 2 and 1 FUND units per core unit; one order sells
// core for FUND (the other side of the book), and the list is not in order of price
const book = [
    order(FUND, 200000, CORE, 100000), // 2 FUND per core
    order(CORE, 5000, FUND, 5000), // the other side
    order(FUND, 400000, CORE, 100000), // 4
    order(FUND, 100000, CORE, 100000), // 1
    order(FUND, 300000, CORE, 100000) // 3
];

function order(
    sellAsset: string,
    sellAmount: number,
    forAsset: string,
    forAmount: number
) {
    return {
        for_sale: String(sellAmount),
        sell_price: {
            base: {amount: String(sellAmount), asset_id: sellAsset},
            quote: {amount: String(forAmount), asset_id: forAsset}
        }
    };
}

describe("matchingOrders", () => {
    it("lists the orders that sell the received asset for the paid one, the cheapest first, with their place in the list", () => {
        const matching = matchingOrders(book, CORE, FUND);
        expect(matching.map(m => m.index)).toEqual([2, 4, 0, 3]);
        expect(matching.map(m => Number(m.forSale))).toEqual([
            400000,
            300000,
            200000,
            100000
        ]);
        // the other direction finds the one order that sells core
        expect(matchingOrders(book, FUND, CORE).map(m => m.index)).toEqual([1]);
    });

    it("leaves out an order with nothing for sale and one that sells nothing at its price", () => {
        const odd = [
            {...order(FUND, 100, CORE, 100), for_sale: "0"},
            {
                ...order(FUND, 100, CORE, 100),
                sell_price: {
                    base: {amount: "0", asset_id: FUND},
                    quote: {amount: "100", asset_id: CORE}
                }
            },
            order(FUND, 100, CORE, 100)
        ];
        expect(
            matchingOrders(odd as any, CORE, FUND).map(m => m.index)
        ).toEqual([2]);
    });
});

describe("walkOrderBook", () => {
    it("is the fill of fillFromOrderBook, and says which orders were used and how much", () => {
        const walk = walkOrderBook(
            book,
            CORE,
            FUND,
            big(250000),
            NO_MARKET_FEE
        );
        expect(walk.fill).toEqual(
            fillFromOrderBook(book, CORE, FUND, big(250000), NO_MARKET_FEE)
        );
        // 100,000 at 4, 100,000 at 3, then 50,000 of the 3rd... : the first two whole, a part of the next
        expect(walk.taken.map(t => t.index)).toEqual([2, 4, 0]);
        expect(walk.taken[0]).toEqual({
            index: 2,
            take: big(400000),
            cost: big(100000)
        });
        expect(walk.taken[2].take < big(200000)).toBe(true);
        expect(walk.taken.reduce((sum, t) => sum + t.cost, big(0))).toBe(
            walk.fill.spent
        );
        expect(walk.taken.reduce((sum, t) => sum + t.take, big(0))).toBe(
            walk.fill.gross
        );
    });

    it("stops at the first order whose price is above the limit of the order that sells", () => {
        // sells 400,000 core and asks for 1,000,000 FUND: 2.5 FUND per core at the least, so the orders at 4 and 3
        const walk = walkOrderBook(
            book,
            CORE,
            FUND,
            big(400000),
            NO_MARKET_FEE,
            {
                pay: big(400000),
                receive: big(1000000)
            }
        );
        expect(walk.taken.map(t => t.index)).toEqual([2, 4]);
        expect(walk.fill.spent).toBe(big(200000));
        expect(walk.fill.complete).toBe(false);
        // asking for 400,000 (1 per core) reaches every order
        const all = walkOrderBook(
            book,
            CORE,
            FUND,
            big(400000),
            NO_MARKET_FEE,
            {
                pay: big(400000),
                receive: big(400000)
            }
        );
        expect(all.taken).toHaveLength(4);
        expect(all.fill.complete).toBe(true);
        // a unit more is out of the worst order's reach
        const above = walkOrderBook(
            book,
            CORE,
            FUND,
            big(400000),
            NO_MARKET_FEE,
            {
                pay: big(400000),
                receive: big(400001)
            }
        );
        expect(above.taken).toHaveLength(3);
    });

    it("walks nothing when no order is within the limit, or there is nothing to sell", () => {
        const none = walkOrderBook(book, CORE, FUND, big(1000), NO_MARKET_FEE, {
            pay: big(1000),
            receive: big(100000)
        });
        expect(none.taken).toEqual([]);
        expect(none.fill.spent).toBe(big(0));
        expect(walkOrderBook(book, CORE, FUND, big(0)).taken).toEqual([]);
    });

    it("names the worst order it touched, as the maker priced it", () => {
        const walk = walkOrderBook(book, CORE, FUND, big(300000));
        // the third order touched: 200,000 FUND for 100,000 core
        expect(walk.fill.worst).toEqual({
            base: big(200000),
            quote: big(100000)
        });
    });
});
