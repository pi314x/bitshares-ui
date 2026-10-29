// Is a Lifetime membership worth it for a trading account? The fee of every transaction is split by the
// chain: the network keeps `network_percent_of_fee` (20%), and the rest goes back to the account's
// lifetime referrer, referrer and registrar. A Lifetime member is its own all three, so it gets the
// whole rest (80%) back as cashback; a Basic member gets none of it. The membership is a fee paid once
// (`membership_lifetime_fee`), so it pays for itself after the cashback of enough trades.
//
// Cashback of a fee up to `cashback_vesting_threshold` (100 BTS) is paid into the account's cashback
// vesting balance already vested (claimable at once); that of a larger fee vests over
// `cashback_vesting_period_seconds` (90 days) - read from libraries/chain/account_object.cpp
// (`pay_fee`) and db_balance.cpp (`deposit_cashback`). Nothing here is read from a node.

export type MembershipStatus = "lifetime" | "basic" | "annual" | "unknown";

/** `membership_expiration_date` of an account, as the status it means. */
export function membershipStatus(
    expiration: string | null | undefined,
    now = Date.now()
): MembershipStatus {
    if (!expiration) return "unknown";
    // a Lifetime member's date is the largest the chain has: 2106-02-07 (or 1969-12-31 as it wraps)
    if (/^1969-12-31/.test(expiration) || /^2[1-9]\d\d-/.test(expiration)) {
        return "lifetime";
    }
    const at = Date.parse(expiration + (expiration.endsWith("Z") ? "" : "Z"));
    if (Number.isNaN(at)) return "unknown";
    return at > now ? "annual" : "basic";
}

export interface BreakEvenInput {
    /** `membership_lifetime_fee`, in smallest units of the core asset */
    lifetimeFee: bigint;
    /** what one trade pays in network fees, in smallest units of the core asset */
    feePerTrade: bigint;
    /** the network's share of a fee, in 1/10,000 (2000 = 20%) */
    networkBp: number;
    tradesPerDay: number;
}

export interface BreakEven {
    /** what a Lifetime member gets back of one trade's fee */
    cashback: bigint;
    /** trades until the cashback adds up to the membership fee (null: never, there is no cashback) */
    trades: number | null;
    /** days at `tradesPerDay` (null: no rate given, or never) */
    days: number | null;
}

/** What a Lifetime member gets back of a fee: everything but the network's share. */
export function cashbackOf(fee: bigint, networkBp: number): bigint {
    const bp = Math.min(10000, Math.max(0, Math.round(networkBp)));
    return (fee * BigInt(10000 - bp)) / BigInt(10000);
}

export function breakEven(input: BreakEvenInput): BreakEven {
    const cashback = cashbackOf(input.feePerTrade, input.networkBp);
    if (cashback <= BigInt(0) || input.lifetimeFee <= BigInt(0)) {
        return {cashback, trades: null, days: null};
    }
    const trades = Number(
        (input.lifetimeFee + cashback - BigInt(1)) / cashback
    );
    const days =
        input.tradesPerDay > 0 && Number.isFinite(input.tradesPerDay)
            ? trades / input.tradesPerDay
            : null;
    return {cashback, trades, days};
}

// ---------------------------------------------------------------- what an account would have kept

export interface Savings {
    /** what a Lifetime member would have got back of the fees */
    cashback: bigint;
    /** that, less the membership's fee: positive, the membership would have paid for itself */
    net: bigint;
    paysOff: boolean;
}

/** What a Lifetime membership would have given back of `feesPaid`, and what is left after its fee. */
export function savingsOf(
    feesPaid: bigint,
    lifetimeFee: bigint,
    networkBp: number
): Savings {
    const cashback = cashbackOf(feesPaid, networkBp);
    const net = cashback - lifetimeFee;
    return {cashback, net, paysOff: net >= BigInt(0)};
}

export interface Pace {
    /** the fees of a month (30 days) at this pace, and what a Lifetime member gets back of them */
    perMonth: bigint;
    cashbackPerMonth: bigint;
    /** months until the cashback adds up to the membership's fee (null: no cashback) */
    months: number | null;
}

/** The pace of fees over `days` days, as a month, and when a Lifetime membership pays for itself at it. */
export function paceOf(input: {
    fees: bigint;
    days: number;
    lifetimeFee: bigint;
    networkBp: number;
}): Pace | null {
    if (!(input.days > 0) || input.fees <= BigInt(0)) return null;
    const perMonth =
        (input.fees * BigInt(30000)) / BigInt(Math.round(input.days * 1000));
    const cashbackPerMonth = cashbackOf(perMonth, input.networkBp);
    const months =
        cashbackPerMonth > BigInt(0) && input.lifetimeFee > BigInt(0)
            ? Number(input.lifetimeFee) / Number(cashbackPerMonth)
            : null;
    return {perMonth, cashbackPerMonth, months};
}

// ---------------------------------------------------------------- amounts as text

/** 10^n as a BigInt. Not `**`: the build turns that into Math.pow, which cannot take a BigInt. */
function pow10(n: number): bigint {
    return BigInt("1" + "0".repeat(n));
}

/**
 * An amount as typed -> smallest units. A comma is a decimal point ("2,5": the decimal keypad of a
 * phone set to German, French, ...); a comma beside a point ("1,000.5") is not guessed at. Null for
 * text that is not an amount, or that has more decimals than the asset has.
 */
export function parseAmount(typed: string, precision: number): bigint | null {
    const text = /^\d*,\d*$/.test(typed) ? typed.replace(",", ".") : typed;
    if (!/^\d*\.?\d*$/.test(text) || text === "" || text === ".") return null;
    const [whole, fraction = ""] = text.split(".");
    if (fraction.length > precision) return null;
    return (
        BigInt(whole || "0") * pow10(precision) +
        BigInt((fraction + "0".repeat(precision)).slice(0, precision) || "0")
    );
}

/** Smallest units -> "12.5", with thousands separated: "5,791.31307". */
export function amountText(units: bigint, precision: number): string {
    const base = pow10(precision);
    const whole = (units / base)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const fraction = (units % base)
        .toString()
        .padStart(precision, "0")
        .replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole;
}
