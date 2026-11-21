// Restrictions of a custom authority (BSIP 40): "this authority may sign a transfer, but
// only to these accounts, only in these assets". A restriction looks at one field of
// the operation (`member_index`: its position in the operation, the fee first), applies
// a function to it (eq, lt, in, ...) and carries the argument to compare with, typed:
// the argument's variant tag has to match the field's type exactly, which is what the
// chain checks when the authority is created.
//
// This builds the common restrictions from rows a person can fill in: a field, a
// function and a value. The field list comes from the operation's own serializer
// (bitsharesjs), so it follows the library. Restrictions the rows cannot express
// (`logical_or`, `variant_assert`, fields that are lists) are written as JSON instead
// (`parseRestrictionsJson`), which is checked by serializing.
import {ops} from "bitsharesjs";
import {Built, isAccountId, isAssetId} from "./advancedOps";

/**
 * The operations bitshares-core can restrict (`sliced_lists.hxx`); every other one is
 * "unsupported" there and the chain refuses an authority for it.
 */
export const CUSTOM_AUTHORITY_OPERATIONS: Array<[number, string]> = [
    [0, "transfer"],
    [1, "limit_order_create"],
    [2, "limit_order_cancel"],
    [3, "call_order_update"],
    [5, "account_create"],
    [6, "account_update"],
    [10, "asset_create"],
    [13, "asset_update_feed_producers"],
    [14, "asset_issue"],
    [15, "asset_reserve"],
    [19, "asset_publish_feed"],
    [21, "witness_update"],
    [32, "vesting_balance_create"],
    [33, "vesting_balance_withdraw"],
    [38, "override_transfer"],
    [49, "htlc_create"],
    [50, "htlc_redeem"],
    [52, "htlc_extend"]
];

export type RestrictionFunction =
    | "eq"
    | "ne"
    | "lt"
    | "le"
    | "gt"
    | "ge"
    | "in"
    | "not_in";

/** `restriction::function_type` */
export const FUNCTION_CODES: Record<string, number> = {
    eq: 0,
    ne: 1,
    lt: 2,
    le: 3,
    gt: 4,
    ge: 5,
    in: 6,
    not_in: 7,
    has_all: 8,
    has_none: 9,
    attr: 10,
    logical_or: 11,
    variant_assert: 12
};

export type FieldKind =
    | "bool"
    | "integer"
    | "string"
    | "time"
    | "public_key"
    | "id"
    | "asset_struct";

export interface RestrictableField {
    /** "to", "amount.asset_id" */
    path: string;
    kind: Exclude<FieldKind, "asset_struct">;
    /** position in the operation, or in the structure for a nested field */
    memberIndex: number;
    /** for a field of a structure (an amount): the position of the structure */
    parentIndex?: number;
    /** the object type of an id field (2: account, 3: asset, ...) */
    idType?: number;
}

/** object type (1.<n>.x) -> tag of the single-value argument; the list's tag is +19. */
const ID_ARGUMENT_TAGS: Record<number, number> = {
    2: 7,
    3: 8,
    4: 9,
    5: 10,
    6: 11,
    7: 12,
    8: 13,
    9: 14,
    10: 15,
    12: 16,
    13: 17,
    14: 18,
    15: 19
};
const SINGLE_TAGS = {bool: 1, integer: 2, string: 3, time: 4, public_key: 5};
const SET_OFFSET = 19;

/** What a value of the given kind can be compared with. */
export function functionsFor(
    field: Pick<RestrictableField, "kind">
): RestrictionFunction[] {
    switch (field.kind) {
        case "integer":
        case "string":
        case "time":
            return ["eq", "ne", "lt", "le", "gt", "ge", "in", "not_in"];
        case "bool":
            return ["eq", "ne"];
        default:
            return ["eq", "ne", "in", "not_in"];
    }
}

// ----- the fields of an operation, from its serializer

function kindOfDefault(value: unknown): FieldKind | null {
    if (typeof value === "boolean") return "bool";
    if (typeof value === "number") return "integer";
    if (typeof value !== "string") return null;
    if (/^1\.\d+\.0$/.test(value)) return "id";
    if (/^-?\d+$/.test(value)) return "integer";
    if (/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(value)) return "time";
    if (value === "") return "string";
    // the default public key (a chain prefix and base58)
    if (/^[A-Z0-9]{3,6}[1-9A-HJ-NP-Za-km-z]{40,}$/.test(value)) {
        return "public_key";
    }
    return null;
}

function describeType(
    type: any
): {
    kind: FieldKind;
    idType?: number;
} | null {
    if (!type) return null;
    if (type === (ops as any).asset) return {kind: "asset_struct"};
    let sample: unknown;
    try {
        sample = type.toObject(undefined, {use_default: true});
    } catch (e) {
        return null;
    }
    const kind = kindOfDefault(sample);
    if (!kind) return null;
    if (kind === "id") {
        const idType = Number(String(sample).split(".")[1]);
        return ID_ARGUMENT_TAGS[idType] ? {kind, idType} : null;
    }
    return {kind};
}

/**
 * The fields of an operation a restriction can look at: its own (not the lists and
 * structures, but the accounts, assets, numbers, texts, times and keys in it) and the
 * asset and amount inside each amount.
 */
export function restrictableFields(operationName: string): RestrictableField[] {
    const serializer = (ops as any)[operationName];
    if (!serializer || !serializer.keys) return [];
    const fields: RestrictableField[] = [];
    serializer.keys.forEach((name: string, index: number) => {
        if (name === "extensions") return;
        const described = describeType(serializer.types[name]);
        if (!described) return;
        if (described.kind === "asset_struct") {
            // asset { amount, asset_id }: the member order of the structure
            fields.push({
                path: `${name}.asset_id`,
                kind: "id",
                idType: 3,
                memberIndex: 1,
                parentIndex: index
            });
            fields.push({
                path: `${name}.amount`,
                kind: "integer",
                memberIndex: 0,
                parentIndex: index
            });
            return;
        }
        fields.push({
            path: name,
            kind: described.kind as RestrictableField["kind"],
            idType: described.idType,
            memberIndex: index
        });
    });
    return fields;
}

// ----- values

const INT64_MAX = BigInt("9223372036854775807");
const INT64_MIN = BigInt("-9223372036854775808");

const tokens = (text: string) =>
    text
        .split(/[\s,;]+/)
        .map(token => token.trim())
        .filter(Boolean);

function parseValue(field: RestrictableField, text: string): any | undefined {
    const value = text.trim();
    switch (field.kind) {
        case "bool":
            return value === "true"
                ? true
                : value === "false"
                ? false
                : undefined;
        case "integer": {
            if (!/^-?\d+$/.test(value)) return undefined;
            const n = BigInt(value);
            return n > INT64_MAX || n < INT64_MIN ? undefined : n.toString();
        }
        case "string":
            return value;
        case "time": {
            const match = value.match(
                /^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d)(:\d\d)?$/
            );
            if (!match) return undefined;
            const time = `${match[1]}T${match[2]}${match[3] || ":00"}`;
            // Date.parse lets the 31st of February roll over into March: the text
            // must come back as it was typed
            const parsed = new Date(time + "Z");
            return Number.isNaN(parsed.getTime()) ||
                parsed.toISOString().slice(0, 19) !== time
                ? undefined
                : time;
        }
        case "public_key":
            return value.length > 20 ? value : undefined;
        case "id": {
            const pattern = new RegExp(`^1\\.${field.idType}\\.\\d+$`);
            return pattern.test(value) ? value : undefined;
        }
        default:
            return undefined;
    }
}

function singleTag(field: RestrictableField): number {
    return field.kind === "id"
        ? ID_ARGUMENT_TAGS[field.idType as number]
        : (SINGLE_TAGS as any)[field.kind];
}

export interface RestrictionRow {
    path: string;
    fn: RestrictionFunction;
    /** one value, or a list (commas, spaces or new lines) for in / not_in */
    value: string;
}

/** One restriction of a field, in the chain's JSON. */
export function buildRestriction(
    field: RestrictableField,
    fn: RestrictionFunction,
    text: string
): Built<any> {
    if (!functionsFor(field).includes(fn)) {
        return {ok: false, error: "function_not_allowed"};
    }
    const list = fn === "in" || fn === "not_in";
    let argument: [number, any];
    if (list) {
        const parts = tokens(text);
        if (!parts.length) {
            return {ok: false, error: "values_missing"};
        }
        const values = parts.map(part => parseValue(field, part));
        if (values.some(v => v === undefined)) {
            return {ok: false, error: "value_invalid"};
        }
        // a flat_set holds each value once
        argument = [
            singleTag(field) + SET_OFFSET,
            Array.from(new Set(values.map(v => JSON.stringify(v)))).map(v =>
                JSON.parse(v)
            )
        ];
    } else {
        if (!text.trim() && field.kind !== "string") {
            return {ok: false, error: "value_missing"};
        }
        const value = parseValue(field, text);
        if (value === undefined) {
            return {ok: false, error: "value_invalid"};
        }
        argument = [singleTag(field), value];
    }
    return {
        ok: true,
        op: {
            member_index: field.memberIndex,
            restriction_type: FUNCTION_CODES[fn],
            argument,
            extensions: []
        }
    };
}

/**
 * The restrictions of the rows for one operation. Rows on the asset or the amount of an
 * amount field are gathered under one `attr` restriction for that field.
 */
export function buildRestrictions(
    operationName: string,
    rows: RestrictionRow[]
): Built<any[]> {
    const fields = restrictableFields(operationName);
    const direct: any[] = [];
    const nested = new Map<number, any[]>();
    for (const row of rows) {
        const field = fields.find(f => f.path === row.path);
        if (!field) {
            return {ok: false, error: "field_unknown"};
        }
        const built = buildRestriction(field, row.fn, row.value);
        if (!built.ok) return built;
        if (field.parentIndex === undefined) {
            direct.push(built.op);
        } else {
            const group = nested.get(field.parentIndex) || [];
            group.push(built.op);
            nested.set(field.parentIndex, group);
        }
    }
    nested.forEach((group, parent) => {
        direct.push({
            member_index: parent,
            restriction_type: FUNCTION_CODES.attr,
            argument: [39, group],
            extensions: []
        });
    });
    return {ok: true, op: direct};
}

/** Restrictions written as JSON (for what the rows cannot say). */
export function parseRestrictionsJson(text: string): Built<any[]> {
    let value: any;
    try {
        value = JSON.parse(text);
    } catch (e) {
        return {ok: false, error: "json_invalid"};
    }
    if (!Array.isArray(value)) return {ok: false, error: "json_invalid"};
    // the chain reads each as { member_index, restriction_type, argument: [tag, value] }
    const sound = value.every(
        r =>
            r &&
            Number.isInteger(Number(r.member_index)) &&
            Number.isInteger(Number(r.restriction_type)) &&
            Array.isArray(r.argument) &&
            Number.isInteger(r.argument[0])
    );
    if (!sound) return {ok: false, error: "json_invalid"};
    return {
        ok: true,
        op: value.map(r => ({extensions: [], ...r}))
    };
}

// ----- names to ids, before building

export interface Lookups {
    accounts: (names: string[]) => Promise<Record<string, string | null>>;
    assets: (symbols: string[]) => Promise<Record<string, string | null>>;
}

/**
 * Rows may name accounts and assets; the restriction needs their ids. Replaces every
 * name by its id (an id stays); rejects with the first name that does not exist.
 */
export async function resolveRowNames(
    operationName: string,
    rows: RestrictionRow[],
    lookups: Lookups
): Promise<RestrictionRow[]> {
    const fields = restrictableFields(operationName);
    const names = {account: new Set<string>(), asset: new Set<string>()};
    const parts = (row: RestrictionRow) => tokens(row.value);
    rows.forEach(row => {
        const field = fields.find(f => f.path === row.path);
        if (!field || field.kind !== "id") return;
        parts(row).forEach(token => {
            if (field.idType === 2 && !isAccountId(token)) {
                names.account.add(token);
            }
            if (field.idType === 3 && !isAssetId(token)) names.asset.add(token);
        });
    });
    const accounts = names.account.size
        ? await lookups.accounts(Array.from(names.account))
        : {};
    const assets = names.asset.size
        ? await lookups.assets(Array.from(names.asset))
        : {};
    return rows.map(row => {
        const field = fields.find(f => f.path === row.path);
        if (!field || field.kind !== "id") return row;
        if (field.idType !== 2 && field.idType !== 3) return row;
        const map: Record<string, string | null> =
            field.idType === 2 ? accounts : assets;
        const resolved = parts(row).map(token => {
            const known =
                field.idType === 2 ? isAccountId(token) : isAssetId(token);
            if (known) return token;
            const id = map[token];
            if (!id) throw new Error(token);
            return id;
        });
        return {...row, value: resolved.join(", ")};
    });
}

/**
 * The rows with each account and asset name replaced by a placeholder id: enough to
 * check their shape while the names are still being looked up.
 */
export function withPlaceholderIds(
    operationName: string,
    rows: RestrictionRow[]
): RestrictionRow[] {
    const fields = restrictableFields(operationName);
    return rows.map(row => {
        const field = fields.find(f => f.path === row.path);
        if (!field || field.kind !== "id") return row;
        if (field.idType !== 2 && field.idType !== 3) return row;
        const placeholder = field.idType === 2 ? "1.2.1" : "1.3.0";
        const known = field.idType === 2 ? isAccountId : isAssetId;
        return {
            ...row,
            value: tokens(row.value)
                .map(token => (known(token) ? token : placeholder))
                .join(", ")
        };
    });
}

// ----- reading an authority's restrictions back

const FUNCTION_NAMES = Object.keys(FUNCTION_CODES);

export interface RestrictionText {
    id: number | null;
    /** "to", "amount.asset_id", or "member 4" when the field is not known */
    field: string;
    fn: string;
    value: string;
}

/**
 * A readable line for each restriction of an authority (the node lists them as
 * `[id, restriction]`; a plain list is read too).
 */
export function describeRestrictions(
    operationName: string,
    restrictions: any[]
): RestrictionText[] {
    const fields = restrictableFields(operationName);
    const serializer = (ops as any)[operationName];
    const memberName = (index: number) =>
        (serializer && serializer.keys && serializer.keys[index]) ||
        `member ${index}`;
    const lines: RestrictionText[] = [];
    (restrictions || []).forEach(entry => {
        const id = Array.isArray(entry) ? Number(entry[0]) : null;
        const r = Array.isArray(entry) ? entry[1] : entry;
        if (!r || !Array.isArray(r.argument)) return;
        const type = Number(r.restriction_type);
        const fn = FUNCTION_NAMES[type] || `function ${type}`;
        const index = Number(r.member_index);
        const [tag, value] = r.argument;
        if (type === FUNCTION_CODES.attr && tag === 39) {
            const parent = memberName(index);
            describeNested(parent, value).forEach(line =>
                lines.push({id, ...line})
            );
            return;
        }
        const field = fields.find(
            f => f.parentIndex === undefined && f.memberIndex === index
        );
        lines.push({
            id,
            field: field ? field.path : memberName(index),
            fn,
            value:
                typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)
        });
    });
    return lines;
}

function describeNested(
    parent: string,
    list: any[]
): Omit<RestrictionText, "id">[] {
    const names: Record<number, string> = {0: "amount", 1: "asset_id"};
    return (list || []).map(r => ({
        field: `${parent}.${names[Number(r.member_index)] ??
            `member ${r.member_index}`}`,
        fn: FUNCTION_NAMES[Number(r.restriction_type)] || "?",
        value: Array.isArray(r.argument)
            ? typeof r.argument[1] === "object"
                ? JSON.stringify(r.argument[1])
                : String(r.argument[1])
            : ""
    }));
}
