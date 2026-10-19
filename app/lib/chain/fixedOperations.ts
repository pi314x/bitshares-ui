// Definitions bitsharesjs 6.0.3 has wrong or incomplete, replaced here. Each was found by
// serializing a sample with the library and with a node (`get_transaction_hex`, the
// chain's own code) and comparing the bytes; `__tests__/lib/fixedOperations-test.ts`
// keeps the node's bytes as the reference.
//
// - restriction (custom authorities, operations 54 and 55): the nested variants
//   (`array(restriction)`, `array(array(restriction))`) were built before `restriction`
//   existed, so they held `undefined`; the pair variant (`variant_assert`) was missing;
//   `custom_id_type` was named "object".
// - custom_authority_update / _delete: the authority's id is 1.17.x, which the library
//   knows as `custom_active_authorities`, not "object".
// - chain_parameters (operation 31): `extensions` is an object of optional members, not
//   a list; the fee schedule could not hold the virtual operation `fill_order` (a
//   serializer made without fields) and had no fee parameters for 75-77.
//
// Imported by `extraOperations.ts`, which `app/index.js` loads first.
import {Serializer, types, ops, ChainTypes} from "bitsharesjs";

const {
    uint8,
    uint16,
    uint32,
    uint64,
    int64,
    varuint64,
    bool,
    string,
    bytes,
    public_key,
    time_point_sec,
    protocol_id_type,
    set,
    array,
    static_variant
} = types as any;
const future_extensions = (types as any).void;
const registry = ops as any;

/** An array whose order is its meaning (restrictions are applied in order). */
const ordered = (element: any) => ({...array(element), nosort: true});

// ----- restrictions

// `restriction` contains itself: the element type of its nested lists points at the
// finished serializer once it exists.
let restrictionSerializer: any;
const restrictionRef: any = {
    nosort: true,
    fromByteBuffer: (b: any) => restrictionSerializer.fromByteBuffer(b),
    appendByteBuffer: (b: any, o: any) =>
        restrictionSerializer.appendByteBuffer(b, o),
    fromObject: (o: any) => restrictionSerializer.fromObject(o),
    toObject: (o: any, d?: any) => restrictionSerializer.toObject(o, d)
};

// pair<int64_t, vector<restriction>> (the `variant_assert` argument): [tag, restrictions]
const variantAssertArgument = {
    fromByteBuffer(b: any) {
        return [
            int64.fromByteBuffer(b),
            ordered(restrictionRef).fromByteBuffer(b)
        ];
    },
    appendByteBuffer(b: any, o: any) {
        int64.appendByteBuffer(b, o[0]);
        ordered(restrictionRef).appendByteBuffer(b, o[1]);
    },
    fromObject(o: any) {
        return [
            int64.fromObject(o[0]),
            ordered(restrictionRef).fromObject(o[1])
        ];
    },
    toObject(o: any, d?: any) {
        return [
            int64.toObject(o[0], d),
            ordered(restrictionRef).toObject(o[1], d)
        ];
    }
};

const voidArgument = new Serializer("void_t", {});
const ids = (name: string) => protocol_id_type(name);
// Index = the tag of the argument's type in core (`restriction::argument_type`).
const argumentTypes = () => {
    const single = [
        bool,
        int64,
        string,
        time_point_sec,
        public_key,
        bytes(32),
        ids("account"),
        ids("asset"),
        ids("force_settlement"),
        ids("committee_member"),
        ids("witness"),
        ids("limit_order"),
        ids("call_order"),
        ids("custom"),
        ids("proposal"),
        ids("withdraw_permission"),
        ids("vesting_balance"),
        ids("worker"),
        ids("balance")
    ];
    return [
        voidArgument, //  0
        ...single, //  1-19
        ...single.map(type => set(type)), // 20-38
        ordered(restrictionRef), // 39
        ordered(ordered(restrictionRef)), // 40
        variantAssertArgument // 41
    ];
};

function buildRestriction() {
    restrictionSerializer = new Serializer("restriction", {
        member_index: varuint64,
        restriction_type: varuint64,
        argument: static_variant(argumentTypes()),
        extensions: set(future_extensions)
    });
    (restrictionSerializer as any).nosort = true;
    return restrictionSerializer;
}

function buildCustomAuthorities(restriction: any) {
    const asset = registry.asset;
    const authority = registry.authority;
    const authorityId = protocol_id_type("custom_active_authorities");
    const {optional} = types as any;
    return {
        custom_authority_create: new Serializer("custom_authority_create", {
            fee: asset,
            account: protocol_id_type("account"),
            enabled: bool,
            valid_from: time_point_sec,
            valid_to: time_point_sec,
            operation_type: varuint64,
            auth: authority,
            restrictions: ordered(restriction),
            extensions: set(future_extensions)
        }),
        custom_authority_update: new Serializer("custom_authority_update", {
            fee: asset,
            account: protocol_id_type("account"),
            authority_to_update: authorityId,
            new_enabled: optional(bool),
            new_valid_from: optional(time_point_sec),
            new_valid_to: optional(time_point_sec),
            new_auth: optional(authority),
            restrictions_to_remove: set(uint16),
            restrictions_to_add: ordered(restriction),
            extensions: set(future_extensions)
        }),
        custom_authority_delete: new Serializer("custom_authority_delete", {
            fee: asset,
            account: protocol_id_type("account"),
            authority_to_delete: authorityId,
            extensions: set(future_extensions)
        })
    };
}

// ----- chain parameters

const htlc_options = new Serializer("htlc_options", {
    max_timeout_secs: uint32,
    max_preimage_size: uint32
});
const custom_authority_options = new Serializer("custom_authority_options", {
    max_custom_authority_lifetime_seconds: uint32,
    max_custom_authorities_per_account: uint32,
    max_custom_authorities_per_account_op: uint32,
    max_custom_authority_restrictions: uint32
});

// chain_parameters::extension<ext>: the members that are present, each after its index
// (in this order); an object in JSON. Older data had a bare list: read as none.
const PARAMETER_EXTENSIONS: Array<[string, any]> = [
    ["updatable_htlc_options", htlc_options],
    ["custom_authority_options", custom_authority_options],
    ["market_fee_network_percent", uint16],
    ["maker_fee_discount_percent", uint16]
];
const present = (o: any) =>
    PARAMETER_EXTENSIONS.map(([key, type], index) => ({
        key,
        type,
        index
    })).filter(({key}) => o && o[key] !== undefined && o[key] !== null);

const parameterExtensions = {
    fromByteBuffer(b: any) {
        const out: any = {};
        const count = b.readVarint32();
        for (let i = 0; i < count; i++) {
            const index = b.readVarint32();
            const member = PARAMETER_EXTENSIONS[index];
            if (!member)
                throw new Error(`unknown parameter extension ${index}`);
            out[member[0]] = member[1].fromByteBuffer(b);
        }
        return out;
    },
    appendByteBuffer(b: any, o: any) {
        const members = present(o);
        b.writeVarint32(members.length);
        members.forEach(({key, type, index}) => {
            b.writeVarint32(index);
            type.appendByteBuffer(b, o[key]);
        });
    },
    fromObject(o: any) {
        const out: any = {};
        present(o).forEach(({key, type}) => {
            out[key] = type.fromObject(o[key]);
        });
        return out;
    },
    toObject(o: any, d?: any) {
        const out: any = {};
        present(o).forEach(({key, type}) => {
            out[key] = type.toObject(o[key], d);
        });
        return out;
    }
};

/** The fee parameters of every operation, in id order, as one variant. */
function buildFeeParameters() {
    const names = Object.keys((ChainTypes as any).operations);
    const list = names.map(name => {
        const known = registry[`${name}_operation_fee_parameters`];
        // an operation without fee fields (the virtual ones) is an empty struct
        if (known && known.keys) return known;
        if (name === "fill_order" || known) {
            return new Serializer(`${name}_operation_fee_parameters`, {});
        }
        // 75-77 (and any later one a library does not know) carry one fee
        return new Serializer(`${name}_operation_fee_parameters`, {
            fee: uint64
        });
    });
    return static_variant(list);
}

function buildChainParameters(feeSchedule: any) {
    return new Serializer("chain_parameters", {
        current_fees: feeSchedule,
        block_interval: uint8,
        maintenance_interval: uint32,
        maintenance_skip_slots: uint8,
        committee_proposal_review_period: uint32,
        maximum_transaction_size: uint32,
        maximum_block_size: uint32,
        maximum_time_until_expiration: uint32,
        maximum_proposal_lifetime: uint32,
        maximum_asset_whitelist_authorities: uint8,
        maximum_asset_feed_publishers: uint8,
        maximum_witness_count: uint16,
        maximum_committee_count: uint16,
        maximum_authority_membership: uint16,
        reserve_percent_of_fee: uint16,
        network_percent_of_fee: uint16,
        lifetime_referrer_percent_of_fee: uint16,
        cashback_vesting_period_seconds: uint32,
        cashback_vesting_threshold: int64,
        count_non_member_votes: bool,
        allow_non_member_whitelists: bool,
        witness_pay_per_block: int64,
        worker_budget_per_day: int64,
        max_predicate_opcode: uint16,
        fee_liquidation_threshold: int64,
        accounts_per_fee_scale: uint16,
        account_fee_scale_bitshifts: uint8,
        max_authority_depth: uint8,
        extensions: parameterExtensions
    });
}

let applied = false;

/**
 * Makes `replacement` what `ops[name]` is. An existing serializer is changed where it
 * stands (its fields, its types): the library's other serializers hold on to the object,
 * and in the production bundle `ops` is a module namespace whose existing members cannot
 * be assigned. A name the library does not have is added.
 */
function adopt(name: string, replacement: any) {
    const existing = registry[name];
    if (existing && existing.types !== undefined) {
        existing.types = replacement.types;
        existing.keys = replacement.keys;
        return;
    }
    registry[name] = replacement;
    const operations = (ChainTypes as any).operations;
    if (operations[name] !== undefined) {
        registry.operation.st_operations[operations[name]] = replacement;
    }
}

/** Idempotent. Returns the names it replaced (the first call) or nothing. */
export function applyFixedOperations(): string[] {
    if (applied) return [];
    applied = true;

    const restriction = buildRestriction();
    // `restrictionSerializer` is what the nested lists use; the library's own object gets
    // the same fields, so both read and write alike
    adopt("restriction", restriction);
    const authorities: any = buildCustomAuthorities(restriction);
    Object.keys(authorities).forEach(name => adopt(name, authorities[name]));

    const feeSchedule = new Serializer("fee_schedule", {
        parameters: set(buildFeeParameters()),
        scale: uint32
    });
    adopt("fee_schedule", feeSchedule);
    const chainParameters = buildChainParameters(registry.fee_schedule);
    adopt("chain_parameters", chainParameters);
    adopt(
        "committee_member_update_global_parameters",
        new Serializer("committee_member_update_global_parameters", {
            fee: registry.asset,
            new_parameters: registry.chain_parameters
        })
    );
    return [
        "restriction",
        ...Object.keys(authorities),
        "fee_schedule",
        "chain_parameters",
        "committee_member_update_global_parameters"
    ];
}
