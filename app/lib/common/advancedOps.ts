// Builders for the operations the "Advanced operations" screens send: account_transfer,
// committee_member_update, custom, assert, override_transfer, the three blind transfers
// and the flash loan pair (samet_fund_borrow + samet_fund_repay). Each takes what the
// user entered (ids already resolved, amounts as text) and returns the operation or the
// reason it cannot be sent; the reasons are the chain's own rules (bitshares-core
// `validate()` and `do_evaluate()`), checked here first so the dialog can say what is
// wrong before a wallet prompt. Nothing here touches the chain, the wallet or a store.
//
// Money is text / BigInt throughout (an int64 does not fit a float).
import {parseAmount} from "./sametFunds";

/** The fee is filled in with the real one when the transaction is made. */
export const FEE_PLACEHOLDER = {amount: 0, asset_id: "1.3.0"};

export type AdvancedError =
    | "account_missing"
    | "same_account"
    | "member_invalid"
    | "url_too_long"
    | "unchanged"
    | "id_invalid"
    | "data_invalid"
    | "data_too_large"
    | "no_predicates"
    | "predicate_not_allowed"
    | "name_invalid"
    | "symbol_invalid"
    | "block_id_invalid"
    | "amount_invalid"
    | "issuer_is_from"
    | "from_is_to"
    | "hex_invalid"
    | "json_invalid"
    | "outputs_missing"
    | "inputs_missing"
    | "unsorted"
    | "authority_invalid"
    | "fund_invalid"
    | "asset_mismatch"
    | "too_much"
    | "field_unknown"
    | "function_not_allowed"
    | "value_missing"
    | "value_invalid"
    | "values_missing"
    | "valid_range"
    | "authority_missing"
    | "operation_invalid"
    | "restrictions_invalid"
    | "nothing_changed"
    | "parameter_invalid";

export type Built<T> =
    | {ok: true; op: T}
    | {ok: false; error: AdvancedError; detail?: string};

const fail = (error: AdvancedError, detail?: string): Built<never> => ({
    ok: false,
    error,
    detail
});

const idOf = (type: number) => new RegExp(`^1\\.${type}\\.\\d+$`);
export const isAccountId = (id: unknown): id is string =>
    typeof id === "string" && idOf(2).test(id);
export const isAssetId = (id: unknown): id is string =>
    typeof id === "string" && idOf(3).test(id);

// ----- text helpers

/** UTF-8 bytes of a text, as hex. */
export function textToHex(text: string): string {
    const bytes = unescape(encodeURIComponent(text));
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes
            .charCodeAt(i)
            .toString(16)
            .padStart(2, "0");
    }
    return hex;
}

/** True for an even number of hex digits (lowercase or not), possibly none. */
export const isHex = (text: string, bytes?: number) =>
    /^([0-9a-fA-F]{2})*$/.test(text) &&
    (bytes === undefined || text.length === bytes * 2);

const clean = (hex: string) =>
    hex
        .trim()
        .replace(/^0x/i, "")
        .toLowerCase();

// ----- account_transfer (9)

export interface AccountTransferOp {
    fee: typeof FEE_PLACEHOLDER;
    account_id: string;
    new_owner: string;
    extensions: [];
}

export function buildAccountTransfer(args: {
    accountId: string | null;
    newOwnerId: string | null;
}): Built<AccountTransferOp> {
    if (!isAccountId(args.accountId) || !isAccountId(args.newOwnerId)) {
        return fail("account_missing");
    }
    if (args.accountId === args.newOwnerId) return fail("same_account");
    return {
        ok: true,
        op: {
            fee: {...FEE_PLACEHOLDER},
            account_id: args.accountId,
            new_owner: args.newOwnerId,
            extensions: []
        }
    };
}

// ----- committee_member_update (30)

/** GRAPHENE_MAX_URL_LENGTH is 127 and the url must be shorter. */
export const MAX_URL_LENGTH = 126;

export interface CommitteeMemberUpdateOp {
    fee: typeof FEE_PLACEHOLDER;
    committee_member: string;
    committee_member_account: string;
    new_url: string;
}

export function buildCommitteeMemberUpdate(args: {
    memberId: string | null;
    accountId: string | null;
    currentUrl: string;
    newUrl: string;
}): Built<CommitteeMemberUpdateOp> {
    if (!isAccountId(args.accountId)) return fail("account_missing");
    if (!args.memberId || !idOf(5).test(args.memberId)) {
        return fail("member_invalid");
    }
    const url = args.newUrl.trim();
    if (url.length > MAX_URL_LENGTH) return fail("url_too_long");
    if (url === args.currentUrl) return fail("unchanged");
    return {
        ok: true,
        op: {
            fee: {...FEE_PLACEHOLDER},
            committee_member: args.memberId,
            committee_member_account: args.accountId,
            new_url: url
        }
    };
}

// ----- custom (35)

export interface CustomOp {
    fee: typeof FEE_PLACEHOLDER;
    payer: string;
    required_auths: string[];
    id: number;
    data: string;
}

/** What a custom operation may carry: the transaction has to stay under the size limit. */
export const DEFAULT_MAX_DATA_BYTES = 60000;

export function buildCustom(args: {
    payerId: string | null;
    requiredAuthIds: string[];
    id: string;
    dataMode: "text" | "hex";
    data: string;
    maxBytes?: number;
}): Built<CustomOp> {
    if (!isAccountId(args.payerId)) return fail("account_missing");
    if (args.requiredAuthIds.some(id => !isAccountId(id))) {
        return fail("account_missing");
    }
    if (!/^\d{1,5}$/.test(args.id.trim()) || Number(args.id) > 65535) {
        return fail("id_invalid");
    }
    let data: string;
    if (args.dataMode === "hex") {
        data = clean(args.data);
        if (!isHex(data)) return fail("data_invalid");
    } else {
        data = textToHex(args.data);
    }
    if (data.length / 2 > (args.maxBytes ?? DEFAULT_MAX_DATA_BYTES)) {
        return fail("data_too_large", String(data.length / 2));
    }
    return {
        ok: true,
        op: {
            fee: {...FEE_PLACEHOLDER},
            payer: args.payerId,
            required_auths: Array.from(new Set(args.requiredAuthIds)),
            id: Number(args.id),
            data
        }
    };
}

// ----- assert (36)

export type Predicate =
    | {type: "account_name"; accountId: string; name: string}
    | {type: "asset_symbol"; assetId: string; symbol: string}
    | {type: "block_id"; id: string};

/** The tag of each predicate; the chain accepts those below `max_predicate_opcode`. */
export const PREDICATE_TAGS: Record<Predicate["type"], number> = {
    account_name: 0,
    asset_symbol: 1,
    block_id: 2
};

/**
 * core's `is_valid_name`: 1-63 characters, labels between dots; a label starts with a
 * lower case letter, ends with a letter or digit and holds letters, digits and dashes.
 */
export function isValidAccountName(name: string): boolean {
    if (name.length < 1 || name.length > 63) return false;
    return name
        .split(".")
        .every(label => /^[a-z]([a-z0-9-]*[a-z0-9])?$/.test(label));
}

/** core's `is_valid_symbol`: 3-16 upper case letters and digits, dots between parts. */
export function isValidAssetSymbol(symbol: string): boolean {
    return (
        symbol.length >= 3 &&
        symbol.length <= 16 &&
        /^[A-Z][A-Z0-9]*(\.[A-Z0-9]+)*$/.test(symbol)
    );
}

export interface AssertOp {
    fee: typeof FEE_PLACEHOLDER;
    fee_paying_account: string;
    predicates: Array<[number, any]>;
    required_auths: string[];
    extensions: [];
}

export function buildAssert(args: {
    payerId: string | null;
    predicates: Predicate[];
    requiredAuthIds: string[];
    /** `max_predicate_opcode` of the chain: a tag must be below it */
    maxOpcode: number;
}): Built<AssertOp> {
    if (!isAccountId(args.payerId)) return fail("account_missing");
    if (args.requiredAuthIds.some(id => !isAccountId(id))) {
        return fail("account_missing");
    }
    if (!args.predicates.length) return fail("no_predicates");
    const predicates: Array<[number, any]> = [];
    for (const predicate of args.predicates) {
        const tag = PREDICATE_TAGS[predicate.type];
        if (tag >= args.maxOpcode) {
            return fail("predicate_not_allowed", predicate.type);
        }
        if (predicate.type === "account_name") {
            if (!isAccountId(predicate.accountId)) {
                return fail("account_missing");
            }
            const name = predicate.name.trim();
            if (!isValidAccountName(name)) return fail("name_invalid", name);
            predicates.push([tag, {account_id: predicate.accountId, name}]);
        } else if (predicate.type === "asset_symbol") {
            if (!isAssetId(predicate.assetId)) return fail("id_invalid");
            const symbol = predicate.symbol.trim();
            if (!isValidAssetSymbol(symbol)) {
                return fail("symbol_invalid", symbol);
            }
            predicates.push([tag, {asset_id: predicate.assetId, symbol}]);
        } else {
            const id = clean(predicate.id);
            // a block id is the 20 bytes of its hash
            if (!isHex(id, 20)) return fail("block_id_invalid");
            predicates.push([tag, {id}]);
        }
    }
    return {
        ok: true,
        op: {
            fee: {...FEE_PLACEHOLDER},
            fee_paying_account: args.payerId,
            predicates,
            required_auths: Array.from(new Set(args.requiredAuthIds)),
            extensions: []
        }
    };
}

// ----- override_transfer (38)

export const OVERRIDE_AUTHORITY_FLAG = 0x04;
export const DISABLE_CONFIDENTIAL_FLAG = 0x40;

/**
 * Whether the asset lets its issuer move balances (`can_override()` and the issuer
 * check of `override_transfer_evaluator`); the reason when it does not.
 */
export function overrideProblem(
    asset: {issuer?: string; options?: {flags?: number}} | null,
    issuerId: string | null
): "asset_missing" | "not_issuer" | "not_permitted" | null {
    if (!asset) return "asset_missing";
    if (!issuerId || asset.issuer !== issuerId) return "not_issuer";
    const flags = Number(asset.options?.flags ?? 0);
    return (flags & OVERRIDE_AUTHORITY_FLAG) === 0 ? "not_permitted" : null;
}

export interface OverrideTransferOp {
    fee: typeof FEE_PLACEHOLDER;
    issuer: string;
    from: string;
    to: string;
    amount: {amount: string; asset_id: string};
    extensions: [];
}

export function buildOverrideTransfer(args: {
    issuerId: string | null;
    fromId: string | null;
    toId: string | null;
    assetId: string | null;
    precision: number;
    amount: string;
}): Built<OverrideTransferOp> {
    if (
        !isAccountId(args.issuerId) ||
        !isAccountId(args.fromId) ||
        !isAccountId(args.toId)
    ) {
        return fail("account_missing");
    }
    if (!isAssetId(args.assetId)) return fail("id_invalid");
    // validate(): from != to, issuer != from, amount > 0
    if (args.fromId === args.toId) return fail("from_is_to");
    if (args.issuerId === args.fromId) return fail("issuer_is_from");
    const units = parseAmount(args.amount, args.precision);
    if (units === null || BigInt(units) <= BigInt(0)) {
        return fail("amount_invalid");
    }
    return {
        ok: true,
        op: {
            fee: {...FEE_PLACEHOLDER},
            issuer: args.issuerId,
            from: args.fromId,
            to: args.toId,
            amount: {amount: units, asset_id: args.assetId},
            extensions: []
        }
    };
}

// ----- blind transfers (39, 40, 41)
//
// The commitments, range proofs and stealth memos are cryptography this application
// does not contain (a range proof needs secp256k1-zkp): they come from the
// command-line wallet or another tool, as the JSON of the outputs and inputs. What is
// checked here is what can be checked without it: shapes, lengths and the order the
// chain demands.

export interface BlindAuthority {
    weight_threshold: number;
    account_auths: Array<[string, number]>;
    key_auths: Array<[string, number]>;
    address_auths: Array<[string, number]>;
}

function normalizeAuthority(raw: any): BlindAuthority | null {
    if (!raw || typeof raw !== "object") return null;
    const pairs = (list: any, test: (key: string) => boolean) => {
        if (list === undefined) return [] as Array<[string, number]>;
        if (!Array.isArray(list)) return null;
        const out: Array<[string, number]> = [];
        for (const entry of list) {
            if (
                !Array.isArray(entry) ||
                typeof entry[0] !== "string" ||
                !test(entry[0]) ||
                !Number.isInteger(Number(entry[1])) ||
                Number(entry[1]) < 1
            ) {
                return null;
            }
            out.push([entry[0], Number(entry[1])]);
        }
        return out;
    };
    const accounts = pairs(raw.account_auths, isAccountId);
    const keys = pairs(raw.key_auths, key => key.length > 20);
    if (!accounts || !keys) return null;
    const threshold = Number(raw.weight_threshold);
    if (!Number.isInteger(threshold) || threshold < 0) return null;
    const total = [...accounts, ...keys].reduce((sum, [, w]) => sum + w, 0);
    // an authority nobody can satisfy ("impossible") is refused by the chain
    if (total < threshold) return null;
    return {
        weight_threshold: threshold,
        account_auths: accounts,
        key_auths: keys,
        address_auths: []
    };
}

export interface BlindOutput {
    commitment: string;
    range_proof: string;
    owner: BlindAuthority;
    stealth_memo?: {
        one_time_key: string;
        to?: string;
        encrypted_memo: string;
    };
}

export interface BlindInput {
    commitment: string;
    owner: BlindAuthority;
}

/** A commitment is 33 bytes: a compressed curve point. */
const isCommitment = (text: string) => isHex(text, 33) && /^0[23]/.test(text);

function parseList(text: string): any[] | null {
    try {
        const value = JSON.parse(text);
        return Array.isArray(value) ? value : null;
    } catch (e) {
        return null;
    }
}

function ascending(commitments: string[]): boolean {
    // fixed-length lower case hex sorts like the bytes do
    return commitments.every((c, i) => i === 0 || commitments[i - 1] < c);
}

export function parseBlindOutputs(text: string): Built<BlindOutput[]> {
    const list = parseList(text);
    if (!list) return fail("json_invalid");
    if (!list.length) return fail("outputs_missing");
    const outputs: BlindOutput[] = [];
    for (const raw of list) {
        const commitment = clean(String(raw?.commitment ?? ""));
        const proof = clean(String(raw?.range_proof ?? ""));
        const owner = normalizeAuthority(raw?.owner);
        if (!isCommitment(commitment)) return fail("hex_invalid", "commitment");
        if (!proof || !isHex(proof)) return fail("hex_invalid", "range_proof");
        if (!owner) return fail("authority_invalid");
        const output: BlindOutput = {
            commitment,
            range_proof: proof,
            owner
        };
        if (raw.stealth_memo) {
            const memo = raw.stealth_memo;
            const encrypted = clean(String(memo.encrypted_memo ?? ""));
            if (
                typeof memo.one_time_key !== "string" ||
                !isHex(encrypted) ||
                (memo.to !== undefined && typeof memo.to !== "string")
            ) {
                return fail("json_invalid", "stealth_memo");
            }
            output.stealth_memo = {
                one_time_key: memo.one_time_key,
                ...(memo.to ? {to: memo.to} : {}),
                encrypted_memo: encrypted
            };
        }
        outputs.push(output);
    }
    if (!ascending(outputs.map(o => o.commitment))) return fail("unsorted");
    return {ok: true, op: outputs};
}

export function parseBlindInputs(text: string): Built<BlindInput[]> {
    const list = parseList(text);
    if (!list) return fail("json_invalid");
    if (!list.length) return fail("inputs_missing");
    const inputs: BlindInput[] = [];
    for (const raw of list) {
        const commitment = clean(String(raw?.commitment ?? ""));
        const owner = normalizeAuthority(raw?.owner);
        if (!isCommitment(commitment)) return fail("hex_invalid", "commitment");
        if (!owner) return fail("authority_invalid");
        inputs.push({commitment, owner});
    }
    if (!ascending(inputs.map(i => i.commitment))) return fail("unsorted");
    return {ok: true, op: inputs};
}

const blindingFactor = (text: string): string | null => {
    const hex = clean(text);
    return isHex(hex, 32) ? hex : null;
};

export function buildTransferToBlind(args: {
    fromId: string | null;
    assetId: string | null;
    precision: number;
    amount: string;
    blindingFactor: string;
    outputs: string;
}): Built<any> {
    if (!isAccountId(args.fromId)) return fail("account_missing");
    if (!isAssetId(args.assetId)) return fail("id_invalid");
    const units = parseAmount(args.amount, args.precision);
    if (units === null || BigInt(units) <= BigInt(0)) {
        return fail("amount_invalid");
    }
    const factor = blindingFactor(args.blindingFactor);
    if (!factor) return fail("hex_invalid", "blinding_factor");
    const outputs = parseBlindOutputs(args.outputs);
    if (!outputs.ok) return outputs;
    return {
        ok: true,
        op: {
            fee: {...FEE_PLACEHOLDER},
            amount: {amount: units, asset_id: args.assetId},
            from: args.fromId,
            blinding_factor: factor,
            outputs: outputs.op
        }
    };
}

export function buildBlindTransfer(args: {
    /** the asset the commitments are in: the fee is taken from them, in it */
    assetId: string | null;
    inputs: string;
    outputs: string;
}): Built<any> {
    if (!isAssetId(args.assetId)) return fail("id_invalid");
    const inputs = parseBlindInputs(args.inputs);
    if (!inputs.ok) return inputs;
    const outputs = parseBlindOutputs(args.outputs);
    if (!outputs.ok) return outputs;
    return {
        ok: true,
        op: {
            fee: {amount: 0, asset_id: args.assetId},
            inputs: inputs.op,
            outputs: outputs.op
        }
    };
}

export function buildTransferFromBlind(args: {
    toId: string | null;
    assetId: string | null;
    precision: number;
    amount: string;
    blindingFactor: string;
    inputs: string;
}): Built<any> {
    if (!isAccountId(args.toId)) return fail("account_missing");
    if (!isAssetId(args.assetId)) return fail("id_invalid");
    const units = parseAmount(args.amount, args.precision);
    if (units === null || BigInt(units) <= BigInt(0)) {
        return fail("amount_invalid");
    }
    const factor = blindingFactor(args.blindingFactor);
    if (!factor) return fail("hex_invalid", "blinding_factor");
    const inputs = parseBlindInputs(args.inputs);
    if (!inputs.ok) return inputs;
    return {
        ok: true,
        op: {
            // the fee of this operation is paid in the asset sent (the chain asserts it)
            fee: {amount: 0, asset_id: args.assetId},
            amount: {amount: units, asset_id: args.assetId},
            to: args.toId,
            blinding_factor: factor,
            inputs: inputs.op
        }
    };
}

// ----- flash loan: samet_fund_borrow (67) + samet_fund_repay (68)

/** GRAPHENE_FEE_RATE_DENOM */
const FEE_RATE_DENOM = BigInt(1000000);

/** The fee the fund asks for repaying `repay` (rounded up, as the chain computes it). */
export function flashFee(repayUnits: string, feeRate: number): string {
    const repay = BigInt(repayUnits);
    return (
        (repay * BigInt(feeRate) + FEE_RATE_DENOM - BigInt(1)) /
        FEE_RATE_DENOM
    ).toString();
}

export interface FlashFund {
    id: string;
    asset_type: string;
    balance: string;
    unpaid_amount: string;
    fee_rate: number;
}

/** What is left to borrow from a fund. */
export function lendable(fund: FlashFund): bigint {
    return BigInt(fund.balance) - BigInt(fund.unpaid_amount);
}

export interface FlashLoanOps {
    borrow: any;
    repay: any;
    /** what repaying costs on top of the borrowed amount */
    fee: string;
}

export function buildFlashLoan(args: {
    borrowerId: string | null;
    fund: FlashFund | null;
    precision: number;
    amount: string;
}): Built<FlashLoanOps> {
    if (!isAccountId(args.borrowerId)) return fail("account_missing");
    if (!args.fund || !/^1\.20\.\d+$/.test(args.fund.id)) {
        return fail("fund_invalid");
    }
    const units = parseAmount(args.amount, args.precision);
    if (units === null || BigInt(units) <= BigInt(0)) {
        return fail("amount_invalid");
    }
    // do_evaluate: the fund must hold the amount beyond what is already out
    if (BigInt(units) > lendable(args.fund)) return fail("too_much");
    const fee = flashFee(units, args.fund.fee_rate);
    const asset = args.fund.asset_type;
    return {
        ok: true,
        op: {
            borrow: {
                fee: {...FEE_PLACEHOLDER},
                borrower: args.borrowerId,
                fund_id: args.fund.id,
                borrow_amount: {amount: units, asset_id: asset},
                extensions: []
            },
            repay: {
                fee: {...FEE_PLACEHOLDER},
                account: args.borrowerId,
                fund_id: args.fund.id,
                repay_amount: {amount: units, asset_id: asset},
                fund_fee: {amount: fee, asset_id: asset},
                extensions: []
            },
            fee
        }
    };
}
