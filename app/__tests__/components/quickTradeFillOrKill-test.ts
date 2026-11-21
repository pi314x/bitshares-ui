// Quick Trade sells with a fill-or-kill order. A limit order is matched only with the orders at its own
// price or better, so an order that asks to receive the TOTAL of a walk over several orders (the average
// price of the walk) cannot reach the orders beyond the average and is killed by the chain. The least it
// asks to receive must be the sold amount at the price of the worst order the walk touches.
import {fillOrKillReceive} from "../../components/QuickTrade/fillOrKill";

// a book that BUYS the sold asset: each level takes `size` of it and pays `price` of the received asset per unit
// (the best price first), as the market data's combined bids do
const LADDER = [
    {size: 100, price: 3000},
    {size: 100, price: 2500},
    {size: 100, price: 2000},
    {size: 100, price: 1500}
];

/** What the walk returns for `sell`, level by level: the total Quick Trade shows. */
function walk(sell: number): {receive: number; touched: number} {
    let left = sell;
    let receive = 0;
    let touched = 0;
    for (const level of LADDER) {
        if (left <= 0) break;
        const take = Math.min(left, level.size);
        receive += take * level.price;
        left -= take;
        touched++;
    }
    return {receive, touched};
}

/** The orders of the walk, as the screen keeps them. */
const touched = (count: number) =>
    LADDER.slice(0, count).map(level => ({
        order: {getPrice: () => level.price}
    }));

/**
 * How much of `sell` the chain lets an order that asks for `minReceive` sell: it is matched with the
 * levels that pay at least `minReceive / sell` per unit, best first.
 */
function soldOnTheChain(sell: number, minReceive: number): number {
    let left = sell;
    for (const level of LADDER) {
        if (left <= 0) break;
        if (level.price * sell < minReceive) break;
        left -= Math.min(left, level.size);
    }
    return sell - left;
}

describe("the least a Quick Trade order asks to receive", () => {
    it("is the walk's total, as it was, when one order is touched", () => {
        const sell = 60;
        const {receive} = walk(sell);
        expect(fillOrKillReceive(sell, receive, touched(1), 2)).toBe(
            receive * 100
        );
        expect(fillOrKillReceive(sell, receive, [], 2)).toBe(receive * 100);
    });

    it("would be killed at the average of a walk over several orders: it cannot sell all it offers", () => {
        const sell = 350;
        const {receive, touched: count} = walk(sell);
        expect(count).toBe(4);
        // asking for the total (what Quick Trade did) reaches the better orders only
        expect(soldOnTheChain(sell, receive)).toBeLessThan(sell);
    });

    it("sells all of it when it asks for the worst order's price: nothing is out of reach", () => {
        for (const sell of [150, 250, 350, 400]) {
            const {receive, touched: count} = walk(sell);
            const asked = fillOrKillReceive(sell, receive, touched(count), 0);
            expect(soldOnTheChain(sell, asked)).toBe(sell);
            // the walk is what it was: the account receives the total, only the least it accepts is lower
            expect(asked).toBeLessThanOrEqual(receive);
        }
    });

    it("asks for the sold amount at the price of the worst order the walk touches", () => {
        const sell = 250;
        const {receive, touched: count} = walk(sell);
        expect(count).toBe(3);
        // 250 at the third level's 2000 = 500,000 (units of the received asset), in cents: 50,000,000
        expect(fillOrKillReceive(sell, receive, touched(count), 2)).toBe(
            Math.floor(250 * 2000 * 100 * (1 - 1e-9))
        );
        expect(
            fillOrKillReceive(sell, receive, touched(count), 2)
        ).toBeLessThan(receive * 100);
    });

    it("never asks for more than the walk returns, and keeps the walk when the worst order is the best average", () => {
        // a walk of 150 over the first two levels: the worst level (2500) is above the average 2833? no: below it
        const sell = 150;
        const {receive} = walk(sell);
        expect(
            fillOrKillReceive(sell, receive, touched(2), 0)
        ).toBeLessThanOrEqual(receive);
        // levels that all pay the same: the walk's total is already the sold amount at that price
        const flat = [1, 2, 3].map(() => ({order: {getPrice: () => 10}}));
        expect(fillOrKillReceive(30, 300, flat, 0)).toBe(299);
    });

    it("leaves the total alone when there is nothing to base a price on", () => {
        const odd = [
            {order: {getPrice: () => 5}},
            {order: {getPrice: () => 0}}
        ];
        expect(fillOrKillReceive(10, 50, odd, 0)).toBe(50);
        expect(fillOrKillReceive(0, 50, touched(3), 0)).toBe(50);
    });
});
