"use strict";
// The lending tools: the credit offers an account has made and the loans it is in, and the open offers
// anyone can borrow from. A credit offer lends an asset against collateral at a fixed price for a
// fixed time. They only READ the chain (what the Credit offers page shows): nothing here builds,
// signs or sends a transaction.
const {UserError, fromUnits, cleanText} = require("./format");

const PAGE = 100;
const MAX_PAGES = 20;
/** the share of a loan an offer or a fund charges is a whole number over this */
const FEE_RATE_DENOM = 1000000;

const big = v => BigInt(String(v));
const price8 = x => (Number.isFinite(x) ? Number(x.toPrecision(8)) : null);

function createLendingHandlers({db, getAssets, getAccount}) {
    const nextId = id => {
        const parts = String(id).split(".");
        return `${parts[0]}.${parts[1]}.${Number(parts[2]) + 1}`;
    };

    const units = (assets, assetId, amount) => {
        const info = assets[assetId];
        return info ? fromUnits(big(amount), info.precision) : String(amount);
    };
    const symbol = (assets, id) => (assets[id] ? assets[id].symbol : id);

    /** Whether an offer can be borrowed from now: on, with something left, and not past its stop time. */
    const isOpen = (offer, nowMs) => {
        if (!offer.enabled || big(offer.current_balance) <= BigInt(0))
            return false;
        const stop = offer.auto_disable_time
            ? Date.parse(offer.auto_disable_time + "Z")
            : NaN;
        return !(Number.isFinite(stop) && stop < nowMs);
    };

    /** The ids of the assets an offer lends and accepts. */
    const assetIds = offers => {
        const ids = [];
        offers.forEach(o => {
            ids.push(o.asset_type);
            (o.acceptable_collateral || []).forEach(([id]) => ids.push(id));
        });
        return ids;
    };

    /** An offer as the tool tells it: the loan, the fee, the time, and what is accepted as collateral. */
    function offerText(offer, assets, names) {
        const lend = assets[offer.asset_type];
        return {
            id: offer.id,
            owner: names
                ? names[offer.owner_account] || offer.owner_account
                : offer.owner_account,
            asset: symbol(assets, offer.asset_type),
            available: units(assets, offer.asset_type, offer.current_balance),
            offered_in_total: units(
                assets,
                offer.asset_type,
                offer.total_balance
            ),
            fee_percent: Number(
                (offer.fee_rate / (FEE_RATE_DENOM / 100)).toFixed(4)
            ),
            max_days: Number(
                (Number(offer.max_duration_seconds) / 86400).toFixed(2)
            ),
            min_deal: units(
                assets,
                offer.asset_type,
                offer.min_deal_amount || 0
            ),
            on: !!offer.enabled,
            stops: offer.auto_disable_time
                ? offer.auto_disable_time + " UTC"
                : null,
            only_for_listed_borrowers:
                (offer.acceptable_borrowers || []).length > 0,
            collateral: (offer.acceptable_collateral || []).map(
                ([id, price]) => {
                    const coll = assets[id];
                    let per = null;
                    // the price is debt (base) to collateral (quote), or the other way round
                    if (lend && coll && price) {
                        const debtUnits = base =>
                            Number(base.amount) / Math.pow(10, lend.precision);
                        const collUnits = quote =>
                            Number(quote.amount) / Math.pow(10, coll.precision);
                        if (
                            price.base.asset_id === offer.asset_type &&
                            price.quote.asset_id === id
                        ) {
                            per =
                                collUnits(price.quote) / debtUnits(price.base);
                        } else if (
                            price.base.asset_id === id &&
                            price.quote.asset_id === offer.asset_type
                        ) {
                            per =
                                collUnits(price.base) / debtUnits(price.quote);
                        }
                    }
                    return {
                        asset: symbol(assets, id),
                        collateral_per_borrowed_unit: price8(per)
                    };
                }
            )
        };
    }

    function dealText(deal, assets, names, nowMs) {
        const repayMs = Date.parse(String(deal.latest_repay_time) + "Z");
        return {
            id: deal.id,
            offer: deal.offer_id,
            lender: names[deal.offer_owner] || deal.offer_owner,
            borrower: names[deal.borrower] || deal.borrower,
            debt:
                units(assets, deal.debt_asset, deal.debt_amount) +
                " " +
                symbol(assets, deal.debt_asset),
            collateral:
                units(assets, deal.collateral_asset, deal.collateral_amount) +
                " " +
                symbol(assets, deal.collateral_asset),
            fee_percent: Number(
                (deal.fee_rate / (FEE_RATE_DENOM / 100)).toFixed(4)
            ),
            repay_by: String(deal.latest_repay_time) + " UTC",
            overdue: Number.isFinite(repayMs) ? repayMs < nowMs : null,
            repays_by_itself: !!deal.auto_repay
        };
    }

    async function names(ctx, ids) {
        const unique = Array.from(new Set(ids.filter(Boolean)));
        const out = {};
        for (let i = 0; i < unique.length; i += PAGE) {
            const rows =
                (await db(ctx, "get_accounts", [unique.slice(i, i + PAGE)])) ||
                [];
            rows.forEach(row => {
                if (row) out[row.id] = cleanText(row.name, 64);
            });
        }
        return out;
    }

    return {
        async bitshares_get_account_credit(ctx, args) {
            const account = await getAccount(ctx, args.account);
            const limit = args.limit || 20;
            const [offers, borrowing, lending] = await Promise.all([
                db(ctx, "get_credit_offers_by_owner", [
                    account.id,
                    limit,
                    "1.21.0"
                ]),
                db(ctx, "get_credit_deals_by_borrower", [
                    account.id,
                    limit,
                    "1.22.0"
                ]),
                db(ctx, "get_credit_deals_by_offer_owner", [
                    account.id,
                    limit,
                    "1.22.0"
                ])
            ]);
            const offerRows = offers || [];
            const borrowRows = borrowing || [];
            const lendRows = lending || [];
            const deals = borrowRows.concat(lendRows);
            const ids = assetIds(offerRows);
            deals.forEach(d => ids.push(d.debt_asset, d.collateral_asset));
            const assets = await getAssets(ctx, ids);
            const nameOf = await names(
                ctx,
                deals.map(d => d.offer_owner).concat(deals.map(d => d.borrower))
            );
            const nowMs = ctx.now();
            return {
                account: {id: account.id, name: account.name},
                offers_made: offerRows.map(o =>
                    offerText(o, assets, {[account.id]: account.name})
                ),
                loans_taken: borrowRows.map(d =>
                    dealText(d, assets, nameOf, nowMs)
                ),
                loans_given: lendRows.map(d =>
                    dealText(d, assets, nameOf, nowMs)
                ),
                note: `Each list shows up to ${limit} entries. A loan that is not repaid by its time can be taken by the lender: the collateral is kept.`
            };
        },

        async bitshares_list_credit_offers(ctx, args) {
            const all = [];
            let start = "1.21.0";
            for (let page = 0; page < MAX_PAGES; page++) {
                const rows =
                    (await db(ctx, "list_credit_offers", [PAGE, start])) || [];
                rows.forEach(row => all.push(row));
                if (rows.length < PAGE) break;
                start = nextId(rows[rows.length - 1].id);
            }
            const nowMs = ctx.now();
            let open = all.filter(o => isOpen(o, nowMs));
            const need = [];
            if (args.asset) need.push(args.asset);
            if (args.collateral) need.push(args.collateral);
            const wanted = {};
            for (const ref of need) {
                wanted[ref] = await resolveAsset(ctx, ref);
            }
            if (args.asset)
                open = open.filter(o => o.asset_type === wanted[args.asset].id);
            if (args.collateral) {
                open = open.filter(o =>
                    (o.acceptable_collateral || []).some(
                        ([id]) => id === wanted[args.collateral].id
                    )
                );
            }
            open.sort((a, b) => {
                if (a.fee_rate !== b.fee_rate) return a.fee_rate - b.fee_rate;
                return big(b.current_balance) > big(a.current_balance) ? 1 : -1;
            });
            const shown = open.slice(0, args.limit || 20);
            const assets = await getAssets(ctx, assetIds(shown));
            const owners = await names(
                ctx,
                shown.map(o => o.owner_account)
            );
            return {
                open_offers: open.length,
                of_all_offers: all.length,
                count: shown.length,
                offers: shown.map(o => offerText(o, assets, owners)),
                note:
                    "Open means on, with something left to lend and not past its stop time. Cheapest fee first. A credit offer needs collateral held beforehand; it is not a flash loan."
            };
        }
    };

    /** An asset by symbol or id, for a filter. */
    async function resolveAsset(ctx, reference) {
        const isId = /^1\.3\.\d+$/.test(reference);
        const rows = isId
            ? await db(ctx, "get_assets", [[reference]])
            : await db(ctx, "lookup_asset_symbols", [[reference]]);
        const asset = rows && rows[0];
        if (!asset) {
            throw new UserError(
                `There is no asset ${cleanText(reference, 32)} on this chain.`,
                "not_found"
            );
        }
        return asset;
    }
}

module.exports = {createLendingHandlers};
