// The operations bitsharesjs 6.0.3 (the version this app depends on, the latest on
// npm) does not know: liquidity_pool_update (75), credit_deal_update (76) and
// limit_order_update (77). Without them the app cannot name, decode or build these
// operations, and `ops[op[0]]` (the key order of ChainTypes.operations) is undefined
// for them. They are registered here with the definitions of bitsharesjs's develop
// branch (checked against bitshares-core's operation structs) and drop out of the way
// once the dependency has them: a name that is already known is left alone.
//
// Import this module before anything reads `ChainTypes.operations` (several modules
// turn it into a list when they are loaded): `app/index.js` imports it first.
import {Serializer, types, ops, ChainTypes} from "bitsharesjs";
import {applyFixedOperations} from "./fixedOperations";

const {
    uint8,
    uint16,
    uint32,
    bool,
    optional,
    protocol_id_type,
    time_point_sec,
    set,
    array,
    static_variant
} = types as any;
const future_extensions = (types as any).void;
const registry = ops as any;
const asset = registry.asset;
const price = registry.price;

/** operation name -> id, in id order (the order ChainTypes.operations must keep). */
export const EXTRA_OPERATIONS: Array<[string, number]> = [
    ["liquidity_pool_update", 75],
    ["credit_deal_update", 76],
    ["limit_order_update", 77]
];

// What a filled order sets off (limit_order_update.on_fill): create_take_profit_order_action
const create_take_profit_order_action = new Serializer(
    "create_take_profit_order_action",
    {
        fee_asset_id: protocol_id_type("asset"),
        spread_percent: uint16,
        size_percent: uint16,
        expiration_seconds: uint32,
        repeat: bool,
        extensions: set(future_extensions)
    }
);
const limit_order_auto_action = static_variant([
    create_take_profit_order_action
]);

function definitions(): {[name: string]: any} {
    return {
        liquidity_pool_update: new Serializer("liquidity_pool_update", {
            fee: asset,
            account: protocol_id_type("account"),
            pool: protocol_id_type("liquidity_pool"),
            taker_fee_percent: optional(uint16),
            withdrawal_fee_percent: optional(uint16),
            extensions: set(future_extensions)
        }),
        credit_deal_update: new Serializer("credit_deal_update", {
            fee: asset,
            account: protocol_id_type("account"),
            deal_id: protocol_id_type("credit_deal"),
            auto_repay: uint8,
            extensions: set(future_extensions)
        }),
        limit_order_update: new Serializer("limit_order_update", {
            fee: asset,
            seller: protocol_id_type("account"),
            order: protocol_id_type("limit_order"),
            new_price: optional(price),
            delta_amount_to_sell: optional(asset),
            new_expiration: optional(time_point_sec),
            on_fill: optional(array(limit_order_auto_action)),
            extensions: set(future_extensions)
        })
    };
}

/** Idempotent. Returns the names this call registered. */
export function registerExtraOperations(): string[] {
    const operations = (ChainTypes as any).operations;
    const stOperations = registry.operation.st_operations as any[];
    const made = definitions();
    const registered: string[] = [];
    EXTRA_OPERATIONS.forEach(([name, id]) => {
        // known already (a newer bitsharesjs): leave it alone
        if (operations[name] !== undefined) return;
        operations[name] = id;
        registry[name] = made[name];
        stOperations[id] = made[name];
        registered.push(name);
    });
    return registered;
}

registerExtraOperations();
// after the extra operations: the fee schedule needs to know all of them
applyFixedOperations();
