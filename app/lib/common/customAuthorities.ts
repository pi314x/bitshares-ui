// Custom authorities (BSIP 40; operations custom_authority_create / _update / _delete):
// an account lets other keys or accounts sign one kind of operation for it, under
// restrictions. The rules are bitshares-core's (`protocol/custom_authority.cpp` and
// `chain/custom_authority_evaluator.cpp`), checked here so a dialog can say what is wrong
// before the wallet asks for anything.
//
// BSIP 40 is not enabled on the BitShares main network: the chain refuses these
// operations there ("Custom active authorities are not yet enabled"), and
// `custom_authority_options` is missing from its parameters. A test network or another
// chain can have it, which `customAuthoritiesEnabled` reads from the chain's parameters.
import {PublicKey} from "bitsharesjs";
import {Built, FEE_PLACEHOLDER, isAccountId} from "./advancedOps";
import {CUSTOM_AUTHORITY_OPERATIONS} from "./restrictions";

export const AUTHORITY_ID = /^1\.17\.\d+$/;
/** committee, witness, relaxed committee and temp accounts (the chain refuses them). */
const SPECIAL_ACCOUNTS = ["1.2.0", "1.2.1", "1.2.2", "1.2.4"];

export interface CustomAuthorityOptions {
    max_custom_authority_lifetime_seconds: number;
    max_custom_authorities_per_account: number;
    max_custom_authorities_per_account_op: number;
    max_custom_authority_restrictions: number;
}

/** The chain's limits, when it has set them (it has not on the main network). */
export function customAuthorityLimits(
    parameters: any
): CustomAuthorityOptions | null {
    const options = parameters?.extensions?.custom_authority_options;
    if (!options) return null;
    return {
        max_custom_authority_lifetime_seconds: Number(
            options.max_custom_authority_lifetime_seconds
        ),
        max_custom_authorities_per_account: Number(
            options.max_custom_authorities_per_account
        ),
        max_custom_authorities_per_account_op: Number(
            options.max_custom_authorities_per_account_op
        ),
        max_custom_authority_restrictions: Number(
            options.max_custom_authority_restrictions
        )
    };
}

// ----- the authority that may sign

export interface AuthorityInput {
    threshold: string;
    accounts: Array<{id: string; weight: string}>;
    keys: Array<{key: string; weight: string}>;
}

export interface BuiltAuthority {
    weight_threshold: number;
    account_auths: Array<[string, number]>;
    key_auths: Array<[string, number]>;
    address_auths: [];
}

const weightOf = (text: string): number | null =>
    /^\d{1,5}$/.test(text.trim()) && Number(text) >= 1 && Number(text) <= 65535
        ? Number(text)
        : null;

/**
 * An authority from rows of accounts and keys. A threshold of 0, or an authority nobody
 * is named in, would let anyone sign: refused here (the chain allows it, which makes it
 * easy to open an account up by mistake).
 */
export function buildAuthority(input: AuthorityInput): Built<BuiltAuthority> {
    const accounts: Array<[string, number]> = [];
    for (const row of input.accounts) {
        const weight = weightOf(row.weight);
        if (!isAccountId(row.id) || weight === null) {
            return {ok: false, error: "authority_invalid"};
        }
        accounts.push([row.id, weight]);
    }
    const keys: Array<[string, number]> = [];
    for (const row of input.keys) {
        const weight = weightOf(row.weight);
        const key = row.key.trim();
        if (!key || weight === null || !PublicKey.fromPublicKeyString(key)) {
            return {ok: false, error: "authority_invalid", detail: key};
        }
        keys.push([key, weight]);
    }
    const unique = (list: Array<[string, number]>) =>
        new Set(list.map(([id]) => id)).size === list.length;
    if (!unique(accounts) || !unique(keys)) {
        return {ok: false, error: "authority_invalid"};
    }
    if (!accounts.length && !keys.length) {
        return {ok: false, error: "authority_missing"};
    }
    const threshold = weightOf(input.threshold);
    const total = [...accounts, ...keys].reduce((sum, [, w]) => sum + w, 0);
    if (threshold === null || threshold > total) {
        return {ok: false, error: "authority_invalid"};
    }
    return {
        ok: true,
        op: {
            weight_threshold: threshold,
            account_auths: accounts,
            key_auths: keys,
            address_auths: []
        }
    };
}

/**
 * "alice 2" per line -> [{token: "alice", weight: "2"}]; a line with only a name has the
 * weight 1. Null when a line has more than a name and a weight.
 */
export function parseWeightedLines(
    text: string
): Array<{token: string; weight: string}> | null {
    const rows: Array<{token: string; weight: string}> = [];
    for (const line of text.split("\n")) {
        const parts = line.split(/[\s,:=]+/).filter(Boolean);
        if (!parts.length) continue;
        if (parts.length > 2) return null;
        rows.push({token: parts[0], weight: parts[1] || "1"});
    }
    return rows;
}

// ----- time

/**
 * "2030-01-01T12:30" as typed in a date field (the viewer's local time) -> "2030-01-01T11:30:00"
 * (the chain's UTC); null when it is not a time.
 */
export function chainTimeFromLocal(text: string): string | null {
    const match = text
        .trim()
        .match(/^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)(?::(\d\d))?$/);
    if (!match) return null;
    const [, y, mo, d, h, mi, s] = match;
    const date = new Date(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(h),
        Number(mi),
        Number(s || 0)
    );
    // a date that rolls over (month 13, the 31st of April) is not the date that was typed
    if (
        date.getFullYear() !== Number(y) ||
        date.getMonth() !== Number(mo) - 1 ||
        date.getDate() !== Number(d) ||
        date.getHours() !== Number(h) ||
        date.getMinutes() !== Number(mi) ||
        date.getSeconds() !== Number(s || 0)
    ) {
        return null;
    }
    return date.toISOString().slice(0, 19);
}

/** The reverse, for a date field: the chain's UTC time as local "YYYY-MM-DDTHH:MM". */
export function localFromChainTime(chain: string): string {
    const date = new Date(chain.slice(0, 19) + "Z");
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
            date.getDate()
        )}` + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

const seconds = (chain: string) => Date.parse(chain.slice(0, 19) + "Z") / 1000;

// ----- restrictions, counted as the chain counts them

/** `restriction::restriction_count`: each restriction, and those nested in it. */
export function restrictionCount(restrictions: any[]): number {
    let count = 0;
    for (const r of restrictions || []) {
        count++;
        const argument = r?.argument;
        if (!Array.isArray(argument)) continue;
        const tag = argument[0];
        const value = argument[1];
        if (tag === 39) count += restrictionCount(value);
        if (tag === 40) {
            (value as any[][]).forEach(branch => {
                count += restrictionCount(branch);
            });
        }
        if (tag === 41) count += restrictionCount((value as any[])[1]);
    }
    return count;
}

// ----- the three operations

const supported = (operationId: number) =>
    CUSTOM_AUTHORITY_OPERATIONS.some(([id]) => id === operationId);

export interface Limits {
    limits: CustomAuthorityOptions | null;
    /** head block time, seconds since 1970 */
    now: number;
}

export function buildCustomAuthorityCreate(
    args: {
        accountId: string | null;
        operationId: number;
        enabled: boolean;
        /** chain times ("2030-01-01T00:00:00") */
        validFrom: string | null;
        validTo: string | null;
        authority: BuiltAuthority;
        restrictions: any[];
    } & Limits
): Built<any> {
    if (!isAccountId(args.accountId))
        return {ok: false, error: "account_missing"};
    if (SPECIAL_ACCOUNTS.includes(args.accountId)) {
        return {ok: false, error: "account_missing", detail: "special"};
    }
    if (!supported(args.operationId)) {
        return {ok: false, error: "operation_invalid"};
    }
    if (!args.validFrom || !args.validTo) {
        return {ok: false, error: "valid_range"};
    }
    // validate(): valid_from < valid_to; do_evaluate(): valid_to in the future, within the lifetime
    if (seconds(args.validFrom) >= seconds(args.validTo)) {
        return {ok: false, error: "valid_range"};
    }
    if (seconds(args.validTo) <= args.now) {
        return {ok: false, error: "valid_range", detail: "past"};
    }
    const limits = args.limits;
    if (
        limits &&
        seconds(args.validTo) - args.now >
            limits.max_custom_authority_lifetime_seconds
    ) {
        return {ok: false, error: "valid_range", detail: "lifetime"};
    }
    if (
        limits &&
        restrictionCount(args.restrictions) >
            limits.max_custom_authority_restrictions
    ) {
        return {ok: false, error: "restrictions_invalid", detail: "count"};
    }
    return {
        ok: true,
        op: {
            fee: {...FEE_PLACEHOLDER},
            account: args.accountId,
            enabled: args.enabled,
            valid_from: args.validFrom,
            valid_to: args.validTo,
            operation_type: args.operationId,
            auth: args.authority,
            restrictions: args.restrictions,
            extensions: []
        }
    };
}

export function buildCustomAuthorityUpdate(args: {
    accountId: string | null;
    authorityId: string;
    /** null: leave as it is */
    enabled: boolean | null;
    validFrom: string | null;
    validTo: string | null;
    authority: BuiltAuthority | null;
    /** the ids of the restrictions to remove */
    remove: number[];
    add: any[];
}): Built<any> {
    if (!isAccountId(args.accountId))
        return {ok: false, error: "account_missing"};
    if (SPECIAL_ACCOUNTS.includes(args.accountId)) {
        return {ok: false, error: "account_missing", detail: "special"};
    }
    if (!AUTHORITY_ID.test(args.authorityId)) {
        return {ok: false, error: "id_invalid"};
    }
    // validate(): from before to when both change; something has to change
    if (
        args.validFrom &&
        args.validTo &&
        seconds(args.validFrom) >= seconds(args.validTo)
    ) {
        return {ok: false, error: "valid_range"};
    }
    if (
        args.enabled === null &&
        !args.validFrom &&
        !args.validTo &&
        !args.authority &&
        !args.remove.length &&
        !args.add.length
    ) {
        return {ok: false, error: "nothing_changed"};
    }
    const op: any = {
        fee: {...FEE_PLACEHOLDER},
        account: args.accountId,
        authority_to_update: args.authorityId,
        restrictions_to_remove: Array.from(new Set(args.remove)),
        restrictions_to_add: args.add,
        extensions: []
    };
    if (args.enabled !== null) op.new_enabled = args.enabled;
    if (args.validFrom) op.new_valid_from = args.validFrom;
    if (args.validTo) op.new_valid_to = args.validTo;
    if (args.authority) op.new_auth = args.authority;
    return {ok: true, op};
}

export function buildCustomAuthorityDelete(args: {
    accountId: string | null;
    authorityId: string;
}): Built<any> {
    if (!isAccountId(args.accountId))
        return {ok: false, error: "account_missing"};
    if (SPECIAL_ACCOUNTS.includes(args.accountId)) {
        return {ok: false, error: "account_missing", detail: "special"};
    }
    if (!AUTHORITY_ID.test(args.authorityId)) {
        return {ok: false, error: "id_invalid"};
    }
    return {
        ok: true,
        op: {
            fee: {...FEE_PLACEHOLDER},
            account: args.accountId,
            authority_to_delete: args.authorityId,
            extensions: []
        }
    };
}

// ----- what the chain holds

export interface CustomAuthority {
    id: string;
    account: string;
    enabled: boolean;
    validFrom: string;
    validTo: string;
    operationType: number;
    auth: any;
    /** [id, restriction] as the node lists them */
    restrictions: any[];
}

export function normalizeCustomAuthority(raw: any): CustomAuthority | null {
    if (!raw || !AUTHORITY_ID.test(String(raw.id))) return null;
    return {
        id: String(raw.id),
        account: String(raw.account),
        enabled: !!raw.enabled,
        validFrom: String(raw.valid_from),
        validTo: String(raw.valid_to),
        operationType: Number(raw.operation_type),
        auth: raw.auth,
        restrictions: Array.isArray(raw.restrictions) ? raw.restrictions : []
    };
}

/** Whether the authority can be used right now (`custom_authority_object::is_valid`). */
export function isInForce(authority: CustomAuthority, now: number): boolean {
    return (
        authority.enabled &&
        now >= seconds(authority.validFrom) &&
        now < seconds(authority.validTo)
    );
}

/**
 * The node has no query for an account's custom authorities. Its history names them: a
 * create's result is the new object's id, an update and a delete name theirs.
 */
export function authorityIdsFromHistory(history: any[]): string[] {
    const ids: string[] = [];
    (history || []).forEach(entry => {
        const op = entry?.op;
        if (!Array.isArray(op)) return;
        if (op[0] === 54) {
            const result = entry.result;
            if (Array.isArray(result) && AUTHORITY_ID.test(String(result[1]))) {
                ids.push(String(result[1]));
            }
        } else if (op[0] === 55 || op[0] === 56) {
            const id = op[1]?.authority_to_update || op[1]?.authority_to_delete;
            if (AUTHORITY_ID.test(String(id))) ids.push(String(id));
        }
    });
    return Array.from(new Set(ids));
}

/** Used when the id of a restriction to remove is typed: "1, 2 3" -> [1, 2, 3]. */
export function parseRestrictionIds(text: string): number[] | null {
    const parts = text.split(/[\s,;]+/).filter(Boolean);
    if (parts.some(p => !/^\d{1,5}$/.test(p) || Number(p) > 65535)) return null;
    return parts.map(Number);
}
