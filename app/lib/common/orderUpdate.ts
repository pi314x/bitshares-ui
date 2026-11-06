// Updating an open limit order (limit_order_update, operation 77): what to send for
// what the user changed. Pure arithmetic and the operation object; nothing here
// touches the chain. The rules are bitshares-core's (market_evaluator.cpp):
//  - something has to change, a change of amount cannot be zero;
//  - a new price keeps the order's two assets, and its base amount may not be more
//    than the amount the order will hold (so the base is that amount: the price
//    keeps all its digits);
//  - the order cannot be emptied (cancel it instead) or become worth nothing;
//  - a new expiration is in the future.

export interface OrderFacts {
    sellAssetId: string;
    receiveAssetId: string;
    sellPrecision: number;
    receivePrecision: number;
    /** what is left to sell, in the smallest steps of the sell asset */
    forSale: number;
    /** the order's price as the chain holds it: base (sell) and quote (receive) amounts */
    priceBase: number;
    priceQuote: number;
}

export type PlanError =
    | "nothing_changed"
    | "amount_invalid"
    | "price_invalid"
    | "too_small"
    | "too_big";

export interface OrderUpdateOp {
    fee: {amount: number; asset_id: string};
    seller: string;
    order: string;
    new_price?: {
        base: {amount: number; asset_id: string};
        quote: {amount: number; asset_id: string};
    };
    delta_amount_to_sell?: {amount: number; asset_id: string};
    new_expiration?: string;
    extensions: any[];
}

export type Plan =
    | {ok: true; op: OrderUpdateOp; receiveUnits: number; newForSale: number}
    | {ok: false; error: PlanError};

const SAFE = Number.MAX_SAFE_INTEGER;

/** The order's price in human figures: how much of the received asset per one sold. */
export function currentPrice(facts: OrderFacts): number {
    const sell = facts.priceBase / Math.pow(10, facts.sellPrecision);
    const receive = facts.priceQuote / Math.pow(10, facts.receivePrecision);
    return receive / sell;
}

/** A human figure as whole steps of an asset; null when it is not a usable amount. */
export function toUnits(human: number, precision: number): number | null {
    if (!Number.isFinite(human) || human < 0) return null;
    const units = Math.round(human * Math.pow(10, precision));
    return Number.isSafeInteger(units) ? units : null;
}

/** "2030-01-01T00:00:00" for a moment: what the chain's time fields are written as. */
export function chainTime(ms: number): string {
    return new Date(ms).toISOString().slice(0, 19);
}

export interface PlanInput {
    seller: string;
    orderId: string;
    facts: OrderFacts;
    /** the amount to sell the order should hold, human; null: unchanged */
    amount: number | null;
    /** the price, human (received per sold); null: unchanged */
    price: number | null;
    /** seconds from now the order should last; null: keep its expiration */
    expiresIn: number | null;
    now: number;
}

export function planOrderUpdate(input: PlanInput): Plan {
    const {facts, amount, price, expiresIn, now} = input;
    const op: OrderUpdateOp = {
        fee: {amount: 0, asset_id: "1.3.0"},
        seller: input.seller,
        order: input.orderId,
        extensions: []
    };

    let newForSale = facts.forSale;
    if (amount !== null) {
        const units = toUnits(amount, facts.sellPrecision);
        if (units === null || units <= 0)
            return {ok: false, error: "amount_invalid"};
        if (units !== facts.forSale) {
            op.delta_amount_to_sell = {
                amount: units - facts.forSale,
                asset_id: facts.sellAssetId
            };
            newForSale = units;
        }
    }

    let quoteForNew = facts.priceQuote;
    let baseForNew = facts.priceBase;
    if (price !== null) {
        if (!Number.isFinite(price) || price <= 0) {
            return {ok: false, error: "price_invalid"};
        }
        const same =
            Math.abs(price - currentPrice(facts)) <= currentPrice(facts) * 1e-9;
        if (!same) {
            // the base is what the order will hold; the quote is that at the price
            const perStep =
                (price * Math.pow(10, facts.receivePrecision)) /
                Math.pow(10, facts.sellPrecision);
            baseForNew = newForSale;
            quoteForNew = Math.round(newForSale * perStep);
            if (!Number.isSafeInteger(quoteForNew) || quoteForNew > SAFE) {
                return {ok: false, error: "too_big"};
            }
            if (quoteForNew < 1) return {ok: false, error: "too_small"};
            op.new_price = {
                base: {amount: baseForNew, asset_id: facts.sellAssetId},
                quote: {amount: quoteForNew, asset_id: facts.receiveAssetId}
            };
        }
    }

    if (expiresIn !== null) {
        op.new_expiration = chainTime(now + expiresIn * 1000);
    }

    if (
        op.new_price === undefined &&
        op.delta_amount_to_sell === undefined &&
        op.new_expiration === undefined
    ) {
        return {ok: false, error: "nothing_changed"};
    }

    // what the order is worth when it fills: nothing is not allowed
    const receiveUnits = Math.floor((newForSale * quoteForNew) / baseForNew);
    if (!(receiveUnits > 0)) return {ok: false, error: "too_small"};

    return {ok: true, op, receiveUnits, newForSale};
}
