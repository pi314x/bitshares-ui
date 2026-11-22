"use strict";
// The SameT tool: the funds that lend an asset for the length of one transaction (a flash loan:
// borrowed first, repaid with the fee by the last operation, or nothing happens; no collateral).
// It only READS the chain (what the SameT funds page shows): nothing here builds, signs or sends a
// transaction.
const {UserError, toUnits, fromUnits} = require("./format");

const PAGE = 100;
const MAX_PAGES = 20;
/** a fund's fee rate is a whole number over this: 300 is 0.03% */
const FEE_RATE_DENOM = 1000000;
const ZERO = BigInt(0);
const ONE = BigInt(1);

const big = v => BigInt(String(v));

/** What is left to borrow from a fund: its balance beyond what is already out. */
function lendable(fund) {
    const left = big(fund.balance) - big(fund.unpaid_amount || 0);
    return left > ZERO ? left : ZERO;
}

/** The fee of a loan: the amount times the rate, rounded up (the chain rounds up). */
function flashFee(amount, feeRate) {
    if (amount <= ZERO || feeRate <= 0) return ZERO;
    const denom = BigInt(FEE_RATE_DENOM);
    return (amount * BigInt(feeRate) + denom - ONE) / denom;
}

const nextId = id => {
    const parts = String(id).split(".");
    return `${parts[0]}.${parts[1]}.${Number(parts[2]) + 1}`;
};

function createSametHandlers({db, getAsset, getAssets}) {
    async function loadFunds(ctx) {
        const funds = new Map();
        let start = null;
        for (let page = 0; page < MAX_PAGES; page++) {
            const rows =
                (await db(ctx, "list_samet_funds", [PAGE, start])) || [];
            let added = 0;
            rows.forEach(row => {
                if (!row || !row.id || funds.has(String(row.id))) return;
                funds.set(String(row.id), {
                    id: String(row.id),
                    asset_type: String(row.asset_type),
                    balance: String(row.balance),
                    fee_rate: Number(row.fee_rate),
                    unpaid_amount: String(
                        row.unpaid_amount === undefined
                            ? "0"
                            : row.unpaid_amount
                    )
                });
                added++;
            });
            if (rows.length < PAGE || added === 0) break;
            start = nextId(rows[rows.length - 1].id);
        }
        return Array.from(funds.values());
    }

    return {
        async bitshares_samet_funds(ctx, args) {
            let asset = null;
            if (args.asset) asset = await getAsset(ctx, args.asset);
            let amount = null;
            if (args.amount !== undefined) {
                if (!asset) {
                    throw new UserError(
                        "Give the asset too, to price a loan of an amount."
                    );
                }
                amount = toUnits(args.amount, asset.precision);
            }
            const funds = (await loadFunds(ctx)).filter(
                f => !asset || f.asset_type === asset.id
            );
            const wanted = amount === null ? ZERO : amount;
            const ranked = asset
                ? funds
                      .filter(f => lendable(f) > ZERO)
                      .map(fund => ({
                          fund,
                          fee: flashFee(wanted, fund.fee_rate),
                          left: lendable(fund),
                          canLend: wanted <= lendable(fund)
                      }))
                      .sort((a, b) => {
                          // the funds that can lend the whole amount first, then the cheapest, then the deepest
                          if (a.canLend !== b.canLend)
                              return a.canLend ? -1 : 1;
                          if (a.fee !== b.fee) return a.fee < b.fee ? -1 : 1;
                          if (a.fund.fee_rate !== b.fund.fee_rate) {
                              return a.fund.fee_rate - b.fund.fee_rate;
                          }
                          if (a.left !== b.left)
                              return a.left > b.left ? -1 : 1;
                          return a.fund.id.localeCompare(b.fund.id, undefined, {
                              numeric: true
                          });
                      })
                      .map(r => r.fund)
                : funds
                      .slice()
                      .sort((a, b) =>
                          a.asset_type === b.asset_type
                              ? a.fee_rate - b.fee_rate
                              : a.asset_type.localeCompare(
                                    b.asset_type,
                                    undefined,
                                    {numeric: true}
                                )
                      );
            const shown = ranked.slice(0, args.limit || 20);
            const assets = await getAssets(
                ctx,
                shown.map(f => f.asset_type)
            );
            const money = (id, units) =>
                assets[id]
                    ? fromUnits(units, assets[id].precision)
                    : String(units);
            return {
                count: shown.length,
                funds: shown.map(fund => {
                    const left = lendable(fund);
                    return {
                        id: fund.id,
                        asset: assets[fund.asset_type]
                            ? assets[fund.asset_type].symbol
                            : fund.asset_type,
                        lends: money(fund.asset_type, left),
                        fee_percent: Number(
                            (fund.fee_rate / (FEE_RATE_DENOM / 100)).toFixed(4)
                        ),
                        fee_rate: fund.fee_rate,
                        fee_for_amount:
                            amount === null
                                ? null
                                : money(
                                      fund.asset_type,
                                      flashFee(amount, fund.fee_rate)
                                  ),
                        can_lend_amount: amount === null ? null : amount <= left
                    };
                }),
                notes: [
                    "A SameT fund lends an asset for the length of one transaction: the loan is taken first and repaid, with the fee, by the last operation, or the whole transaction fails and nothing happens.",
                    "A credit offer is not a flash loan: it needs collateral held beforehand."
                ]
            };
        }
    };
}

module.exports = {createSametHandlers};
