// Changing the fees of a liquidity pool (liquidity_pool_update, operation 75): the
// owner - the issuer of the pool's share asset - sets the taker fee (what a swap
// pays) and the withdrawal fee. The chain keeps them in hundredths of a percent
// (uint16, 0..10000); people write percent. Only what changed is sent.

export const MAX_FEE_UNITS = 10000; // 100%

/** "0.25" (percent) -> 25 (hundredths of a percent); null for anything else. */
export function feeUnits(text: string): number | null {
    const cleaned = text
        .trim()
        .replace(/%$/, "")
        .trim();
    if (!/^\d+([.,]\d{0,2})?$/.test(cleaned)) return null;
    const units = Math.round(parseFloat(cleaned.replace(",", ".")) * 100);
    return Number.isInteger(units) && units >= 0 && units <= MAX_FEE_UNITS
        ? units
        : null;
}

/** 25 -> "0.25": a fee for a field. */
export function feeText(units: number): string {
    return (units / 100).toFixed(2).replace(/\.?0+$/, "") || "0";
}

export interface PoolUpdateOp {
    fee: {amount: number; asset_id: string};
    account: string;
    pool: string;
    taker_fee_percent?: number;
    withdrawal_fee_percent?: number;
    extensions: any[];
}

/** The operation for the fees that differ from the current ones; null when none do. */
export function buildPoolUpdateOp(args: {
    account: string;
    poolId: string;
    current: {taker: number; withdrawal: number};
    next: {taker: number; withdrawal: number};
}): PoolUpdateOp | null {
    const op: PoolUpdateOp = {
        fee: {amount: 0, asset_id: "1.3.0"},
        account: args.account,
        pool: args.poolId,
        extensions: []
    };
    if (args.next.taker !== args.current.taker) {
        op.taker_fee_percent = args.next.taker;
    }
    if (args.next.withdrawal !== args.current.withdrawal) {
        op.withdrawal_fee_percent = args.next.withdrawal;
    }
    return op.taker_fee_percent === undefined &&
        op.withdrawal_fee_percent === undefined
        ? null
        : op;
}
