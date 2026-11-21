// Proposing a change of the chain's parameters (committee_member_update_global_parameters,
// operation 31). Only the committee can make it happen: the operation is proposed (from any
// account) and the committee members approve the proposal. The new parameters are the
// chain's present ones with the edited values; the fee schedule is carried over as it is.
//
// The rules are `chain_parameters::validate()` of bitshares-core.
import {Built, FEE_PLACEHOLDER, isAccountId} from "./advancedOps";

export type ParameterType = "uint8" | "uint16" | "uint32" | "int64" | "bool";

export type ParameterGroup =
    | "blocks"
    | "limits"
    | "fees"
    | "pay"
    | "voting"
    | "htlc"
    | "authorities";

export interface ParameterDef {
    /** the name in the chain's parameters */
    key: string;
    /** "extensions" for the members of the optional extension block */
    parent?:
        | "extensions"
        | "updatable_htlc_options"
        | "custom_authority_options";
    type: ParameterType;
    group: ParameterGroup;
    /** a member of the extension block that may be absent */
    optional?: boolean;
}

const p = (
    key: string,
    type: ParameterType,
    group: ParameterGroup,
    extra: Partial<ParameterDef> = {}
): ParameterDef => ({key, type, group, ...extra});

export const PARAMETERS: ParameterDef[] = [
    p("block_interval", "uint8", "blocks"),
    p("maintenance_interval", "uint32", "blocks"),
    p("maintenance_skip_slots", "uint8", "blocks"),
    p("maximum_time_until_expiration", "uint32", "blocks"),
    p("maximum_transaction_size", "uint32", "limits"),
    p("maximum_block_size", "uint32", "limits"),
    p("maximum_proposal_lifetime", "uint32", "limits"),
    p("committee_proposal_review_period", "uint32", "limits"),
    p("maximum_asset_whitelist_authorities", "uint8", "limits"),
    p("maximum_asset_feed_publishers", "uint8", "limits"),
    p("maximum_authority_membership", "uint16", "limits"),
    p("max_authority_depth", "uint8", "limits"),
    p("max_predicate_opcode", "uint16", "limits"),
    p("reserve_percent_of_fee", "uint16", "fees"),
    p("network_percent_of_fee", "uint16", "fees"),
    p("lifetime_referrer_percent_of_fee", "uint16", "fees"),
    p("cashback_vesting_period_seconds", "uint32", "fees"),
    p("cashback_vesting_threshold", "int64", "fees"),
    p("fee_liquidation_threshold", "int64", "fees"),
    p("accounts_per_fee_scale", "uint16", "fees"),
    p("account_fee_scale_bitshifts", "uint8", "fees"),
    p("market_fee_network_percent", "uint16", "fees", {
        parent: "extensions",
        optional: true
    }),
    p("maker_fee_discount_percent", "uint16", "fees", {
        parent: "extensions",
        optional: true
    }),
    p("witness_pay_per_block", "int64", "pay"),
    p("worker_budget_per_day", "int64", "pay"),
    p("maximum_witness_count", "uint16", "voting"),
    p("maximum_committee_count", "uint16", "voting"),
    p("count_non_member_votes", "bool", "voting"),
    p("allow_non_member_whitelists", "bool", "voting"),
    p("max_timeout_secs", "uint32", "htlc", {
        parent: "updatable_htlc_options",
        optional: true
    }),
    p("max_preimage_size", "uint32", "htlc", {
        parent: "updatable_htlc_options",
        optional: true
    }),
    p("max_custom_authority_lifetime_seconds", "uint32", "authorities", {
        parent: "custom_authority_options",
        optional: true
    }),
    p("max_custom_authorities_per_account", "uint32", "authorities", {
        parent: "custom_authority_options",
        optional: true
    }),
    p("max_custom_authorities_per_account_op", "uint32", "authorities", {
        parent: "custom_authority_options",
        optional: true
    }),
    p("max_custom_authority_restrictions", "uint32", "authorities", {
        parent: "custom_authority_options",
        optional: true
    })
];

const MIN_TRANSACTION_SIZE = 1024;
const MIN_BLOCK_SIZE = 5 * MIN_TRANSACTION_SIZE;
const MIN_BLOCK_INTERVAL = 1;
const MAX_BLOCK_INTERVAL = 30;
const HUNDRED_PERCENT = 10000;
const MARKET_FEE_NETWORK_MAX = 3000;

const BOUNDS: Record<Exclude<ParameterType, "bool" | "int64">, number> = {
    uint8: 255,
    uint16: 65535,
    uint32: 4294967295
};
const INT64_MAX = BigInt("9223372036854775807");

/** Where a parameter lives in the chain's object. */
function container(parameters: any, def: ParameterDef, create: boolean): any {
    if (!def.parent) return parameters;
    if (def.parent === "extensions") {
        if (create && !parameters.extensions) parameters.extensions = {};
        return parameters.extensions;
    }
    const extensions = create
        ? (parameters.extensions = parameters.extensions || {})
        : parameters.extensions;
    if (!extensions) return undefined;
    if (create && !extensions[def.parent]) extensions[def.parent] = {};
    return extensions[def.parent];
}

/** The value a parameter has now, as text; "" where an optional one is not set. */
export function parameterValue(parameters: any, def: ParameterDef): string {
    const holder = container(parameters, def, false);
    const value = holder ? holder[def.key] : undefined;
    return value === undefined || value === null ? "" : String(value);
}

export type ParameterEdits = Record<string, string>;

/** Edits are keyed by `parent.key` (or the key, for those at the top). */
export const editKey = (def: ParameterDef) =>
    def.parent && def.parent !== "extensions"
        ? `${def.parent}.${def.key}`
        : def.key;

function parseValue(def: ParameterDef, text: string): any | undefined {
    const value = text.trim();
    if (def.type === "bool") {
        return value === "true" ? true : value === "false" ? false : undefined;
    }
    if (!/^\d+$/.test(value)) return undefined;
    if (def.type === "int64") {
        const n = BigInt(value);
        return n > INT64_MAX ? undefined : n.toString();
    }
    const n = Number(value);
    return n > BOUNDS[def.type] ? undefined : n;
}

export interface ParameterChange {
    parameters: any;
    /** the parameters whose value changed */
    changed: string[];
}

/**
 * The chain's parameters with the edits applied. An empty edit of an optional member
 * removes it; an edit equal to the present value is no change. Checks what the chain
 * checks in `chain_parameters::validate()`.
 */
export function applyParameterEdits(
    current: any,
    edits: ParameterEdits
): Built<ParameterChange> {
    const next = JSON.parse(JSON.stringify(current));
    const changed: string[] = [];
    for (const def of PARAMETERS) {
        const key = editKey(def);
        if (!(key in edits)) continue;
        const text = edits[key];
        if (parameterValue(current, def) === text.trim()) continue;
        if (!text.trim()) {
            if (!def.optional)
                return {ok: false, error: "parameter_invalid", detail: key};
            const holder = container(next, def, false);
            if (holder) delete holder[def.key];
        } else {
            const value = parseValue(def, text);
            if (value === undefined) {
                return {ok: false, error: "parameter_invalid", detail: key};
            }
            container(next, def, true)[def.key] = value;
        }
        changed.push(key);
    }
    if (!changed.length) return {ok: false, error: "nothing_changed"};
    // an option block with nothing left in it is not sent
    const extensions = next.extensions;
    if (extensions) {
        ["updatable_htlc_options", "custom_authority_options"].forEach(name => {
            if (extensions[name] && !Object.keys(extensions[name]).length) {
                delete extensions[name];
            }
        });
    }
    // the options come whole or not at all
    if (
        extensions?.updatable_htlc_options &&
        (extensions.updatable_htlc_options.max_timeout_secs === undefined ||
            extensions.updatable_htlc_options.max_preimage_size === undefined)
    ) {
        return {
            ok: false,
            error: "parameter_invalid",
            detail: "updatable_htlc_options"
        };
    }
    if (extensions?.custom_authority_options) {
        const options = extensions.custom_authority_options;
        if (
            [
                "max_custom_authority_lifetime_seconds",
                "max_custom_authorities_per_account",
                "max_custom_authorities_per_account_op",
                "max_custom_authority_restrictions"
            ].some(name => options[name] === undefined)
        ) {
            return {
                ok: false,
                error: "parameter_invalid",
                detail: "custom_authority_options"
            };
        }
    }
    const problem = validateParameters(next);
    if (problem)
        return {ok: false, error: "parameter_invalid", detail: problem};
    return {ok: true, op: {parameters: next, changed}};
}

/** `chain_parameters::validate()`: the name of the first rule that fails. */
export function validateParameters(parameters: any): string | null {
    const n = (key: string) => Number(parameters[key]);
    if (n("reserve_percent_of_fee") > HUNDRED_PERCENT) {
        return "reserve_percent_of_fee";
    }
    if (n("network_percent_of_fee") > HUNDRED_PERCENT) {
        return "network_percent_of_fee";
    }
    if (n("lifetime_referrer_percent_of_fee") > HUNDRED_PERCENT) {
        return "lifetime_referrer_percent_of_fee";
    }
    if (
        n("network_percent_of_fee") + n("lifetime_referrer_percent_of_fee") >
        HUNDRED_PERCENT
    ) {
        return "network_percent_of_fee";
    }
    const interval = n("block_interval");
    if (interval < MIN_BLOCK_INTERVAL || interval > MAX_BLOCK_INTERVAL) {
        return "block_interval";
    }
    if (
        n("maintenance_interval") <= interval ||
        n("maintenance_interval") % interval !== 0
    ) {
        return "maintenance_interval";
    }
    if (n("maximum_transaction_size") < MIN_TRANSACTION_SIZE) {
        return "maximum_transaction_size";
    }
    if (n("maximum_block_size") < MIN_BLOCK_SIZE) return "maximum_block_size";
    if (n("maximum_time_until_expiration") <= interval) {
        return "maximum_time_until_expiration";
    }
    if (
        n("maximum_proposal_lifetime") -
            n("committee_proposal_review_period") <=
        interval
    ) {
        return "maximum_proposal_lifetime";
    }
    const market = parameters.extensions?.market_fee_network_percent;
    if (market !== undefined && Number(market) > MARKET_FEE_NETWORK_MAX) {
        return "market_fee_network_percent";
    }
    const maker = parameters.extensions?.maker_fee_discount_percent;
    if (maker !== undefined && Number(maker) > HUNDRED_PERCENT) {
        return "maker_fee_discount_percent";
    }
    return null;
}

/** The proposal that asks the committee for the new parameters. */
export function buildParameterProposal(args: {
    proposerId: string | null;
    current: any;
    edits: ParameterEdits;
}): Built<{op: any; changed: string[]}> {
    if (!isAccountId(args.proposerId)) {
        return {ok: false, error: "account_missing"};
    }
    const change = applyParameterEdits(args.current, args.edits);
    if (!change.ok) return change;
    return {
        ok: true,
        op: {
            changed: change.op.changed,
            op: {
                fee_paying_account: args.proposerId,
                proposed_ops: [
                    {
                        op: [
                            31,
                            {
                                fee: {...FEE_PLACEHOLDER},
                                new_parameters: change.op.parameters
                            }
                        ]
                    }
                ]
            }
        }
    };
}
