// Pure helpers for SameT funds (the chain's "flash loan" funds: a single-asset
// pool anyone can borrow from inside one transaction and must repay, plus a
// fee, in the same transaction).
//
// Nothing here touches the chain, the wallet or any store, so every function
// can be unit-tested and the operation builders can be checked against the
// real serializers (`app/__tests__/lib/sametFunds-test.ts`). Money is handled
// as integer strings / BigInt end to end: a SameT balance is an int64 and the
// biggest real ones already exceed what floating point can hold exactly
// (e.g. 100000823118 satoshis is fine, but a few more digits are not).

/** Fee rates are expressed in 1/1,000,000: 300 means 0.03%. */
export const FEE_RATE_DENOM = 1000000;

/** Decimal places a percentage can carry: 1 unit of rate is 0.0001%. */
export const FEE_RATE_PERCENT_DECIMALS = 4;

export const CORE_ASSET_ID = "1.3.0";

export interface SametFund {
    id: string;
    owner_account: string;
    asset_type: string;
    /** Integer amount in the asset's smallest unit (int64 as a string). */
    balance: string;
    /** In 1/FEE_RATE_DENOM. */
    fee_rate: number;
    /** Fees borrowers have not yet paid back (int64 as a string). */
    unpaid_amount: string;
}

/** The node returns int64 values as numbers when small and as strings when
 * large; normalise to strings so nothing downstream does float math. */
export function normalizeFund(raw: any): SametFund {
    return {
        id: String(raw.id),
        owner_account: String(raw.owner_account),
        asset_type: String(raw.asset_type),
        balance: String(raw.balance),
        fee_rate: Number(raw.fee_rate),
        unpaid_amount: String(raw.unpaid_amount ?? "0")
    };
}

/** "1.20.14" -> "1.20.15": the id to start the next page from. */
export function nextStartId(lastId: string): string {
    const parts = lastId.split(".");
    if (parts.length !== 3 || !/^\d+$/.test(parts[2])) {
        throw new Error(`Not an object id: ${lastId}`);
    }
    return `${parts[0]}.${parts[1]}.${Number(parts[2]) + 1}`;
}

function groupThousands(digits: string): string {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Integer smallest-unit amount -> display string, e.g. ("123456", 2) ->
 * "1,234.56". Trailing zeros of the fraction are kept: this is a balance,
 * not a price, and "1.50" must not turn into "1.5" in a money column. */
export function formatAmount(
    raw: string | number | bigint,
    precision: number
): string {
    const value = BigInt(raw);
    const negative = value < BigInt(0);
    const digits = (negative ? -value : value).toString();
    const padded = digits.padStart(precision + 1, "0");
    const whole = padded.slice(0, padded.length - precision);
    const fraction =
        precision > 0 ? padded.slice(padded.length - precision) : "";
    const text = groupThousands(whole) + (fraction ? "." + fraction : "");
    return negative ? "-" + text : text;
}

/** User input ("12.5") -> integer smallest-unit string ("1250" for precision
 * 2), or null when the text is not a plain non-negative decimal with at most
 * `precision` decimals. No rounding: a value that does not fit is refused,
 * never silently altered. */
export function parseAmount(input: string, precision: number): string | null {
    const text = input.trim().replace(/,/g, "");
    const match = text.match(/^(\d+)(?:\.(\d*))?$/);
    if (!match) return null;
    const fraction = match[2] || "";
    if (fraction.length > precision) return null;
    const integer = (match[1] + fraction.padEnd(precision, "0")).replace(
        /^0+(?=\d)/,
        ""
    );
    return integer;
}

/** 300 -> "0.03%" (rate / 1,000,000 as a percentage, trailing zeros dropped). */
export function formatFeeRate(rate: number): string {
    return (
        formatAmount(rate, FEE_RATE_PERCENT_DECIMALS)
            .replace(/(\.\d*?)0+$/, "$1")
            .replace(/\.$/, "") + "%"
    );
}

/** "0.03" (percent) -> 300. Null for anything that is not a percentage
 * between 0 and 100 with at most four decimals (the chain's resolution). */
export function parseFeeRate(input: string): number | null {
    const text = input
        .trim()
        .replace(/%$/, "")
        .trim();
    const units = parseAmount(text, FEE_RATE_PERCENT_DECIMALS);
    if (units === null) return null;
    const rate = Number(units);
    return rate <= FEE_RATE_DENOM ? rate : null;
}

// ---- Operation builders -----------------------------------------------------
//
// They return plain objects in the shape `TransactionBuilder
// .add_type_operation(name, op)` takes (and the bitsharesjs serializers
// accept); `fee.amount: 0` lets the transaction builder fill in the real fee,
// exactly like the credit-offer operations do.

function assertObjectId(value: string, space: string, name: string) {
    if (!new RegExp(`^${space.replace(/\./g, "\\.")}\\.\\d+$`).test(value)) {
        throw new Error(`${name} must be a ${space}.x object id, got ${value}`);
    }
}

function assertPositiveInt(value: string, name: string) {
    if (!/^[1-9]\d*$/.test(value)) {
        throw new Error(`${name} must be a positive integer, got ${value}`);
    }
}

function assertFeeRate(rate: number) {
    if (!Number.isInteger(rate) || rate < 0 || rate > FEE_RATE_DENOM) {
        throw new Error(`fee rate must be an integer in 0..${FEE_RATE_DENOM}`);
    }
}

export interface CreateFundArgs {
    owner: string;
    assetId: string;
    /** Smallest-unit integer string, > 0. */
    balance: string;
    feeRate: number;
    feeAssetId?: string;
}

export function buildCreateOp(args: CreateFundArgs) {
    assertObjectId(args.owner, "1.2", "owner");
    assertObjectId(args.assetId, "1.3", "asset");
    assertPositiveInt(args.balance, "balance");
    assertFeeRate(args.feeRate);
    return {
        fee: {amount: 0, asset_id: args.feeAssetId || CORE_ASSET_ID},
        owner_account: args.owner,
        asset_type: args.assetId,
        balance: args.balance,
        fee_rate: args.feeRate
    };
}

export interface UpdateFundArgs {
    owner: string;
    fundId: string;
    /** Change of the fund's balance in the smallest unit, as a signed integer
     * string: positive deposits into the fund, negative withdraws from it. */
    deltaAmount?: {assetId: string; amount: string};
    newFeeRate?: number;
    feeAssetId?: string;
}

export function buildUpdateOp(args: UpdateFundArgs) {
    assertObjectId(args.owner, "1.2", "owner");
    assertObjectId(args.fundId, "1.20", "fund");
    const op: any = {
        fee: {amount: 0, asset_id: args.feeAssetId || CORE_ASSET_ID},
        owner_account: args.owner,
        fund_id: args.fundId
    };
    if (args.deltaAmount) {
        assertObjectId(args.deltaAmount.assetId, "1.3", "asset");
        if (!/^-?[1-9]\d*$/.test(args.deltaAmount.amount)) {
            throw new Error("delta amount must be a non-zero integer");
        }
        op.delta_amount = {
            amount: args.deltaAmount.amount,
            asset_id: args.deltaAmount.assetId
        };
    }
    if (args.newFeeRate !== undefined) {
        assertFeeRate(args.newFeeRate);
        op.new_fee_rate = args.newFeeRate;
    }
    if (op.delta_amount === undefined && op.new_fee_rate === undefined) {
        throw new Error(
            "nothing to update: set a delta amount or a new fee rate"
        );
    }
    return op;
}

export interface DeleteFundArgs {
    owner: string;
    fundId: string;
    feeAssetId?: string;
}

export function buildDeleteOp(args: DeleteFundArgs) {
    assertObjectId(args.owner, "1.2", "owner");
    assertObjectId(args.fundId, "1.20", "fund");
    return {
        fee: {amount: 0, asset_id: args.feeAssetId || CORE_ASSET_ID},
        owner_account: args.owner,
        fund_id: args.fundId
    };
}
