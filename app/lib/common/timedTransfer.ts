// Timed transfer: send an asset that the recipient can claim only from a chosen
// date on.
//
// BitShares core has no "scheduled transfer" operation. What it has, and what
// this builds, is a vesting balance (`vesting_balance_create`, available on
// mainnet) with the linear policy set so that nothing is claimable before the
// release time and everything is claimable from it:
//
//   begin_timestamp          = now
//   vesting_cliff_seconds    = release - now
//   vesting_duration_seconds = release - now
//
// In core's `linear_vesting_policy::get_allowed_withdraw`, once
// `elapsed >= cliff` and `elapsed >= duration` the whole `begin_balance` is
// allowed. Before that, nothing. The recipient claims it from their *Vesting
// balances* page (`vesting_balance_withdraw`).
//
// What it is not: it cannot be cancelled or taken back by the sender - the funds
// are the recipient's from the moment of creation, only locked. For a
// conditional or refundable lock use an HTLC instead.

/** The shortest wait the wallet will create (core would accept 1 second). */
export const MIN_LEAD_SECONDS = 60;
/** `vesting_duration_seconds` is a uint32. */
export const MAX_LEAD_SECONDS = 4294967295;

export const CORE_ASSET_ID = "1.3.0";

function assertObjectId(value: string, space: string, name: string) {
    if (!new RegExp(`^${space.replace(/\./g, "\\.")}\\.\\d+$`).test(value)) {
        throw new Error(`${name} must be a ${space}.x object id, got ${value}`);
    }
}

/** Chain time format: UTC, second resolution, no zone suffix. */
export function toChainTime(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toISOString().replace(/\.\d{3}Z$/, "");
}

/** The value of an `<input type="datetime-local">` ("2026-12-31T12:00", in the
 * viewer's time zone) as unix seconds, or null when it is not a date. */
export function parseLocalDateTime(value: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value.trim())) {
        return null;
    }
    const ms = new Date(value.trim()).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export type ReleaseCheck =
    | {ok: true; seconds: number}
    | {ok: false; reason: "past" | "too_soon" | "too_far"};

/** Whether `releaseSec` is an acceptable release time at `nowSec`. */
export function checkRelease(nowSec: number, releaseSec: number): ReleaseCheck {
    const lead = releaseSec - nowSec;
    if (lead <= 0) return {ok: false, reason: "past"};
    if (lead < MIN_LEAD_SECONDS) return {ok: false, reason: "too_soon"};
    if (lead > MAX_LEAD_SECONDS) return {ok: false, reason: "too_far"};
    return {ok: true, seconds: lead};
}

export interface TimedTransferArgs {
    /** Who funds it and pays the fee (1.2.x). */
    creator: string;
    /** Who may claim it, from the release time on (1.2.x). */
    owner: string;
    assetId: string;
    /** Smallest-unit integer string, > 0. */
    amount: string;
    /** "Now" and the release time, unix seconds. */
    nowSec: number;
    releaseSec: number;
    feeAssetId?: string;
}

/**
 * The `vesting_balance_create` operation in the shape
 * `TransactionBuilder.add_type_operation` takes. `fee.amount: 0` lets the
 * builder fill in the real fee, as the other operations here do.
 */
export function buildTimedTransferOp(args: TimedTransferArgs) {
    assertObjectId(args.creator, "1.2", "creator");
    assertObjectId(args.owner, "1.2", "recipient");
    assertObjectId(args.assetId, "1.3", "asset");
    if (!/^[1-9]\d*$/.test(args.amount)) {
        throw new Error(
            `amount must be a positive integer, got ${args.amount}`
        );
    }
    if (!Number.isInteger(args.nowSec) || !Number.isInteger(args.releaseSec)) {
        throw new Error("times must be whole unix seconds");
    }
    const check = checkRelease(args.nowSec, args.releaseSec);
    if (!check.ok) {
        throw new Error(`release time is not acceptable: ${check.reason}`);
    }
    return {
        fee: {amount: 0, asset_id: args.feeAssetId || CORE_ASSET_ID},
        creator: args.creator,
        owner: args.owner,
        amount: {amount: args.amount, asset_id: args.assetId},
        // static_variant: [index, value]; 0 = linear_vesting_policy_initializer
        policy: [
            0,
            {
                begin_timestamp: toChainTime(args.nowSec),
                vesting_cliff_seconds: check.seconds,
                vesting_duration_seconds: check.seconds
            }
        ]
    };
}
