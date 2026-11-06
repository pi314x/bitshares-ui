// What an account has paid in network fees, read from its operation history: who pays the fee of an
// operation, what a fee in another asset is worth in the core asset, and how much of it was trading.
// A Lifetime member would have got most of it back (`lib/common/membership.ts`). Nothing here reads a
// node; the history comes from `lib/chain/feesPaid.ts`.

/**
 * The field of an operation that names the account that pays its fee (libraries/protocol, each
 * operation's `fee_payer()`), by operation id. The name is there for a test that compares it with the
 * chain's own list. `null` is no one: a blind transfer pays from its inputs, and a VIRTUAL operation
 * (fill_order, ...) is made by the chain, not paid for - its `fee` is not a network fee (a fill's is the
 * market fee, paid to the asset's issuer), and a Lifetime member gets no cashback on it.
 */
export const FEE_PAYERS: Array<[number, string, string | null]> = [
    [0, "transfer", "from"],
    [1, "limit_order_create", "seller"],
    [2, "limit_order_cancel", "fee_paying_account"],
    [3, "call_order_update", "funding_account"],
    [4, "fill_order", null],
    [5, "account_create", "registrar"],
    [6, "account_update", "account"],
    [7, "account_whitelist", "authorizing_account"],
    [8, "account_upgrade", "account_to_upgrade"],
    [9, "account_transfer", "account_id"],
    [10, "asset_create", "issuer"],
    [11, "asset_update", "issuer"],
    [12, "asset_update_bitasset", "issuer"],
    [13, "asset_update_feed_producers", "issuer"],
    [14, "asset_issue", "issuer"],
    [15, "asset_reserve", "payer"],
    [16, "asset_fund_fee_pool", "from_account"],
    [17, "asset_settle", "account"],
    [18, "asset_global_settle", "issuer"],
    [19, "asset_publish_feed", "publisher"],
    [20, "witness_create", "witness_account"],
    [21, "witness_update", "witness_account"],
    [22, "proposal_create", "fee_paying_account"],
    [23, "proposal_update", "fee_paying_account"],
    [24, "proposal_delete", "fee_paying_account"],
    [25, "withdraw_permission_create", "withdraw_from_account"],
    [26, "withdraw_permission_update", "withdraw_from_account"],
    [27, "withdraw_permission_claim", "withdraw_to_account"],
    [28, "withdraw_permission_delete", "withdraw_from_account"],
    [29, "committee_member_create", "committee_member_account"],
    [30, "committee_member_update", "committee_member_account"],
    [31, "committee_member_update_global_parameters", null],
    [32, "vesting_balance_create", "creator"],
    [33, "vesting_balance_withdraw", "owner"],
    [34, "worker_create", "owner"],
    [35, "custom", "payer"],
    [36, "assert", "fee_paying_account"],
    [37, "balance_claim", "deposit_to_account"],
    [38, "override_transfer", "issuer"],
    [39, "transfer_to_blind", "from"],
    [40, "blind_transfer", null],
    [41, "transfer_from_blind", null],
    [42, "asset_settle_cancel", null],
    [43, "asset_claim_fees", "issuer"],
    [44, "fba_distribute", null],
    [45, "bid_collateral", "bidder"],
    [46, "execute_bid", null],
    [47, "asset_claim_pool", "issuer"],
    [48, "asset_update_issuer", "issuer"],
    [49, "htlc_create", "from"],
    [50, "htlc_redeem", "redeemer"],
    [51, "htlc_redeemed", null],
    [52, "htlc_extend", "update_issuer"],
    [53, "htlc_refund", null],
    [54, "custom_authority_create", "account"],
    [55, "custom_authority_update", "account"],
    [56, "custom_authority_delete", "account"],
    [57, "ticket_create", "account"],
    [58, "ticket_update", "account"],
    [59, "liquidity_pool_create", "account"],
    [60, "liquidity_pool_delete", "account"],
    [61, "liquidity_pool_deposit", "account"],
    [62, "liquidity_pool_withdraw", "account"],
    [63, "liquidity_pool_exchange", "account"],
    [64, "samet_fund_create", "owner_account"],
    [65, "samet_fund_delete", "owner_account"],
    [66, "samet_fund_update", "owner_account"],
    [67, "samet_fund_borrow", "borrower"],
    [68, "samet_fund_repay", "account"],
    [69, "credit_offer_create", "owner_account"],
    [70, "credit_offer_delete", "owner_account"],
    [71, "credit_offer_update", "owner_account"],
    [72, "credit_offer_accept", "borrower"],
    [73, "credit_deal_repay", "account"],
    [74, "credit_deal_expired", null],
    [75, "liquidity_pool_update", "account"],
    [76, "credit_deal_update", "account"],
    [77, "limit_order_update", "seller"]
];

const PAYER_FIELD = new Map<number, string | null>(
    FEE_PAYERS.map(([id, , field]) => [id, field])
);

/** The account that pays the fee of an operation (as the history gives it: [type, data]); null for no one. */
export function feePayer(opType: number, op: any): string | null {
    const field = PAYER_FIELD.get(opType);
    if (!field || !op) return null;
    const who = op[field];
    return typeof who === "string" ? who : null;
}

/** The operations that are trading: orders made, cancelled and changed, margin calls, settling, a pool swap. */
const TRADING = new Set([1, 2, 3, 17, 63, 77]);

/** A fee asset's price in the core asset: `core_exchange_rate`, as the node answers it. */
export interface FeeRate {
    baseAssetId: string;
    baseAmount: bigint;
    quoteAssetId: string;
    quoteAmount: bigint;
}

export const CORE = "1.3.0";

/**
 * What a fee is worth in the core asset, in its smallest units, the way the chain converts it (the fee
 * asset's amount times its core exchange rate, rounded down). Null for a fee in an asset whose rate is
 * not known.
 */
export function coreValueOfFee(
    fee: {amount: string | number; asset_id: string},
    rates: Map<string, FeeRate>
): bigint | null {
    const amount = BigInt(String(fee.amount));
    if (amount === BigInt(0)) return BigInt(0);
    if (fee.asset_id === CORE) return amount;
    const rate = rates.get(fee.asset_id);
    if (!rate) return null;
    if (rate.baseAssetId === fee.asset_id && rate.quoteAssetId === CORE) {
        return rate.baseAmount > BigInt(0)
            ? (amount * rate.quoteAmount) / rate.baseAmount
            : null;
    }
    if (rate.quoteAssetId === fee.asset_id && rate.baseAssetId === CORE) {
        return rate.quoteAmount > BigInt(0)
            ? (amount * rate.baseAmount) / rate.quoteAmount
            : null;
    }
    return null;
}

export interface HistoryEntry {
    id?: string;
    block_num: number;
    op: [number, any];
}

export interface OwnFees {
    /** the core value of the fees the account paid in these operations, smallest units */
    coreUnits: bigint;
    /** of which trading (orders, pool swaps, settling) */
    trading: bigint;
    /** the operations the account paid a fee for */
    ops: number;
    /** operations whose fee asset has no known rate: left out */
    unpriced: number;
    /** the oldest and newest block among the entries (null for none) */
    firstBlock: number | null;
    lastBlock: number | null;
}

/**
 * The fees `accountId` paid in the operations of its history. An entry the account did not pay for (a
 * transfer it received, a fill) is not counted, nor is one with a fee of zero.
 */
export function ownFees(
    accountId: string,
    entries: HistoryEntry[],
    rates: Map<string, FeeRate>
): OwnFees {
    const out: OwnFees = {
        coreUnits: BigInt(0),
        trading: BigInt(0),
        ops: 0,
        unpriced: 0,
        firstBlock: null,
        lastBlock: null
    };
    entries.forEach(entry => {
        const [type, op] = entry.op;
        if (out.firstBlock === null || entry.block_num < out.firstBlock) {
            out.firstBlock = entry.block_num;
        }
        if (out.lastBlock === null || entry.block_num > out.lastBlock) {
            out.lastBlock = entry.block_num;
        }
        if (!op || !op.fee || feePayer(type, op) !== accountId) return;
        const core = coreValueOfFee(op.fee, rates);
        if (core === null) {
            out.unpriced++;
            return;
        }
        if (core === BigInt(0)) return;
        out.coreUnits += core;
        if (TRADING.has(type)) out.trading += core;
        out.ops++;
    });
    return out;
}
