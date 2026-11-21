// What the fill-or-kill order of Quick Trade asks to receive at least.
//
// The order sells `sellAmount` and the screen shows what the walk of the book returns for it
// (`receiveAmount`, over as many orders as it takes). A limit order is matched only with the orders
// whose price is at ITS limit or better, and its limit is `sellAmount / min_to_receive`. Asking for the
// total of a walk over several orders makes the limit the AVERAGE price of the walk: the orders beyond
// the average are out of its reach, it cannot sell everything it offers, and a fill-or-kill order that
// cannot is killed by the chain ("Killing limit order ... due to unable to fill"). The limit has to
// allow the price of the WORST order the walk touches. The order still fills order by order, each at
// the price its maker asked, so the account receives what the screen shows; only the least it accepts is
// lower, by what the worst order is worse than the average.

/** An order of the walk, the best price first (`getPrice()`: units received per unit sold). */
export interface WalkedOrder {
    order: {getPrice: () => number};
}

/**
 * The `min_to_receive` of the order, in the smallest units of the received asset: what the walk returns
 * (as it was), or less where the walk touches several orders - the sold amount at the price of the
 * worst of them, never more than the walk returns.
 */
export function fillOrKillReceive(
    sellAmount: number,
    receiveAmount: number,
    orders: WalkedOrder[],
    receivePrecision: number
): number {
    const walk = receiveAmount * 10 ** receivePrecision;
    // one order (or none): the average is that order's price, nothing lies beyond it
    if (orders.length < 2) return walk;
    const worst = orders[orders.length - 1].order.getPrice();
    if (!(worst > 0) || !(sellAmount > 0)) return walk;
    // (a hair under, so that the rounding of a float cannot put the limit above the worst order's price)
    const atWorst = Math.floor(
        sellAmount * worst * 10 ** receivePrecision * (1 - 1e-9)
    );
    return atWorst < walk ? atWorst : walk;
}
