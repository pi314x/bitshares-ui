// What the strategies page reads from the chain besides prices: what an account holds, what the network fee of some orders is, and
// the assets an account holds (for the asset drop-downs).
import {Apis} from "bitsharesjs-ws";
import {AssetRef} from "../common/marketCandles";
import {StrategySpec} from "../common/strategies";
import {
    CORE_ID,
    OrderPlan,
    PlanError,
    orderOperations,
    planOrders
} from "../common/strategyOrders";

const db = (): any => (Apis as any).instance().db_api();

const LIMIT_ORDER_CREATE = 1;

/** The balances (units) the account holds of the assets given (all of them with none given), by asset id. */
export async function loadHoldings(
    accountId: string,
    assetIds: string[] = []
): Promise<Map<string, bigint>> {
    const rows = ((await db().exec("get_account_balances", [
        accountId,
        assetIds
    ])) || []) as any[];
    const out = new Map<string, bigint>();
    rows.forEach(row => {
        if (
            row &&
            typeof row.asset_id === "string" &&
            /^\d+$/.test(String(row.amount))
        ) {
            out.set(row.asset_id, BigInt(String(row.amount)));
        }
    });
    // (an asset asked for and not held is held none of)
    assetIds.forEach(id => {
        if (!out.has(id)) out.set(id, BigInt(0));
    });
    return out;
}

/** The network fee, in the core asset (units), of the `limit_order_create` operations; null when the node does not say. */
export async function loadOrderFees(
    operations: Array<[string, any]>
): Promise<bigint | null> {
    if (!operations.length) return BigInt(0);
    const rows = (await db().exec("get_required_fees", [
        operations.map(operation => [LIMIT_ORDER_CREATE, operation[1]]),
        CORE_ID
    ])) as any[];
    if (!Array.isArray(rows) || rows.length !== operations.length) return null;
    let total = BigInt(0);
    for (const row of rows) {
        if (
            !row ||
            row.asset_id !== CORE_ID ||
            !/^\d+$/.test(String(row.amount))
        ) {
            return null;
        }
        total += BigInt(String(row.amount));
    }
    return total;
}

/** The assets the account holds some of, with their symbols and precisions. */
export async function loadHeldAssets(accountId: string): Promise<AssetRef[]> {
    const held = await loadHoldings(accountId);
    const ids = Array.from(held.entries())
        .filter(entry => entry[1] > BigInt(0))
        .map(entry => entry[0]);
    if (!ids.length) return [];
    const rows = ((await db().exec("lookup_asset_symbols", [ids])) ||
        []) as any[];
    return rows
        .filter(
            row =>
                row &&
                typeof row.id === "string" &&
                typeof row.symbol === "string" &&
                Number.isInteger(row.precision)
        )
        .map(row => ({
            id: row.id,
            symbol: row.symbol,
            precision: row.precision
        }));
}

/** How long the orders of a grid or a market maker stay open, and a DCA's one buy (it is meant to fill at once). */
export const ORDER_DAYS = 30;
export const DCA_ORDER_DAYS = 1;

export interface OrderReview {
    plan: OrderPlan;
    operations: Array<[string, any]>;
    /** the network fee of all of them, in the core asset (units); null: the node did not say */
    fee: bigint | null;
    /** the account does not hold the core asset the fee takes */
    shortOfCore: boolean;
    /** the price the plan was made at */
    price: number;
    expiration: Date;
}

/**
 * Everything the last look needs, read now: what the account holds, the orders that can be funded (the network fee is kept back
 * where the core asset is one of the two assets), and what they cost to place. Nothing is sent.
 */
export async function reviewOrders(args: {
    spec: StrategySpec;
    trade: AssetRef;
    priced: AssetRef;
    price: number;
    accountId: string;
    now?: Date;
}): Promise<
    | {ok: true; review: OrderReview}
    | {ok: false; error: PlanError | "no_orders"}
> {
    const {spec, trade, priced, price, accountId} = args;
    const now = args.now || new Date();
    const held = await loadHoldings(accountId, [trade.id, priced.id, CORE_ID]);
    const holdings = {
        trade: held.get(trade.id) || BigInt(0),
        priced: held.get(priced.id) || BigInt(0)
    };
    const days = spec.kind === "dca" ? DCA_ORDER_DAYS : ORDER_DAYS;
    const expiration = new Date(now.getTime() + days * 24 * 3600 * 1000);
    const make = (funds: typeof holdings) => {
        const result = planOrders(spec, trade, priced, price, funds);
        if (!result.ok) return result;
        return {
            ok: true as const,
            plan: result.plan,
            operations: orderOperations(result.plan, accountId, expiration)
        };
    };
    let made = make(holdings);
    if (!made.ok) return made;
    let fee = await loadOrderFees(made.operations);
    // the fee is paid in the core asset: where that is one of the two, the orders may not spend it all
    if (fee !== null && (trade.id === CORE_ID || priced.id === CORE_ID)) {
        const take = (n: bigint) => (n > fee! ? n - fee! : BigInt(0));
        made = make({
            trade: trade.id === CORE_ID ? take(holdings.trade) : holdings.trade,
            priced:
                priced.id === CORE_ID ? take(holdings.priced) : holdings.priced
        });
        if (!made.ok) return made;
        fee = await loadOrderFees(made.operations);
    }
    if (!made.plan.orders.length) return {ok: false, error: "no_orders"};
    const core = held.get(CORE_ID) || BigInt(0);
    // (where the core asset is one of the two, the fee was kept back from it above)
    return {
        ok: true,
        review: {
            plan: made.plan,
            operations: made.operations,
            fee,
            shortOfCore: fee === null ? false : core < fee,
            price,
            expiration
        }
    };
}
