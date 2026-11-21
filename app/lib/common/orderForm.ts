// The arithmetic of the order forms (Exchange): the price, the amount a buy gets or a
// sell gives, the total. Pure functions on the form's state, apart from the shared
// `Asset` / `Price` objects they read.
export function setReceiveHelper(state: any) {
    if (state.price.isValid() && state.for_sale.hasAmount()) {
        state.to_receive = state.for_sale.times(state.price);
        state.toReceiveText = state.to_receive
            .getAmount({real: true})
            .toString();
        return true;
    }
    return false;
}

export function setForSaleHelper(state: any) {
    if (state.price.isValid() && state.to_receive.hasAmount()) {
        state.for_sale = state.to_receive.times(state.price, true);
        state.forSaleText = state.for_sale.getAmount({real: true}).toString();
        return true;
    }
    return false;
}

/**
 * An order form's state with `price` (the sell price of an order of the book: what a
 * buy pays at the lowest ask, what a sell gets at the highest bid) in its price field,
 * and the amounts that follow from it when one is already filled in.
 */
export function applyMarketPrice(state: any, isBid: boolean, price: any) {
    const current = {...state};
    current.price = price[isBid ? "invert" : "clone"]();
    current.priceText = current.price.toReal();
    if (isBid) {
        setForSaleHelper(current) || setReceiveHelper(current);
    } else {
        setReceiveHelper(current) || setForSaleHelper(current);
    }
    return current;
}

/**
 * The form as it opens: with the market's price in it. The same state when the user
 * has already put something in (a price, an amount or a total), and when there is no
 * price to put in.
 */
export function withMarketPrice(state: any, isBid: boolean, price: any) {
    if (
        !price ||
        state.priceText !== "" ||
        state.for_sale.hasAmount() ||
        state.to_receive.hasAmount()
    ) {
        return state;
    }
    return applyMarketPrice(state, isBid, price);
}
