// Updating a credit deal (credit_deal_update, operation 76): whether, and how, the
// chain repays the deal by itself when it falls due. bitshares-core's
// `credit_deal_auto_repayment_type`: 0 = no automatic repayment, 1 = only a full
// repayment, 2 = a partial one too, as far as the balance goes.

export const AUTO_REPAY_MODES = [0, 1, 2] as const;
export type AutoRepayMode = typeof AUTO_REPAY_MODES[number];

/** The mode a deal object carries (a missing or odd value is "no automatic repayment"). */
export function autoRepayOf(deal: any): AutoRepayMode {
    const value = Number(deal && deal.auto_repay);
    return value === 1 || value === 2 ? value : 0;
}

export interface CreditDealUpdateOp {
    fee: {amount: number; asset_id: string};
    account: string;
    deal_id: string;
    auto_repay: number;
    extensions: any[];
}

/** The operation, or null when the mode is not one the chain knows. */
export function buildCreditDealUpdateOp(args: {
    account: string;
    dealId: string;
    autoRepay: number;
}): CreditDealUpdateOp | null {
    if (!AUTO_REPAY_MODES.includes(args.autoRepay as AutoRepayMode)) {
        return null;
    }
    return {
        fee: {amount: 0, asset_id: "1.3.0"},
        account: args.account,
        deal_id: args.dealId,
        auto_repay: args.autoRepay,
        extensions: []
    };
}
