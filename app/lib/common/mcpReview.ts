// What the review page decides about a transaction an AI assistant prepared (MCP,
// docs/MCP.md), apart from how it looks. Everything is judged here with the application's
// own data - the document's own claims are not believed:
//  - the document is read strictly (only the two operations trading needs, no unknown field);
//  - the reference is computed again from the operations, and the one shown is the computed
//    one (a link whose operations were changed shows a different reference, and is refused);
//  - it must be fresh, for the chain this app is connected to, and for the account that is
//    signed in;
//  - an order is compared with the market as the application sees it.
// A problem blocks signing; a price worse than the limit blocks it until it is acknowledged.
import {
    decodeProposal,
    fingerprint,
    isCurrent,
    OPERATIONS
} from "../../../mcp/src/proposal";
import {marketPrice} from "../../../mcp/src/policy";

/** The same limit the server's default has: paying more than this over the market blocks. */
export const MAX_DEVIATION_PERCENT = 3;

export interface Proposal {
    v: number;
    chain: string;
    account: {id: string; name: string};
    ops: Array<[number, any]>;
    created: string;
    expires: string;
    nonce: string;
    ref: string;
}

export type DecodeResult =
    | {ok: true; proposal: Proposal}
    | {ok: false; error: string; detail?: string};

/** The proposal in a link: after `p=` in the fragment (`/mcp/review#p=...`) or in the query
 * (`#/mcp/review?p=...` for a hash-routed build). */
export function readPayload(href: string): string | null {
    const m = /[#?&]p=([A-Za-z0-9_-]+)/.exec(href || "");
    return m ? m[1] : null;
}

export function decode(text: string | null): DecodeResult {
    return decodeProposal(text || "") as DecodeResult;
}

export type Problem =
    | "reference"
    | "expired"
    | "chain"
    | "account"
    | "asset_unknown"
    | "order_missing"
    | "order_not_yours";

export interface Context {
    now: number;
    chainId: string | null;
    accountId: string | null;
    sha256Hex: (text: string) => string;
}

/** The reference of what is shown, computed here. */
export function computedReference(
    proposal: Proposal,
    sha256Hex: Context["sha256Hex"]
): string {
    return fingerprint(proposal as any, sha256Hex);
}

/** What stops this proposal from being signed, from the document and the application's
 * state alone (the lookups come on top: see `lookupProblems`). */
export function problems(proposal: Proposal, ctx: Context): Problem[] {
    const out: Problem[] = [];
    if (computedReference(proposal, ctx.sha256Hex) !== proposal.ref) {
        out.push("reference");
    }
    if (!isCurrent(proposal as any, ctx.now)) out.push("expired");
    if (!ctx.chainId || ctx.chainId !== proposal.chain) out.push("chain");
    if (!ctx.accountId || ctx.accountId !== proposal.account.id) {
        out.push("account");
    }
    return out;
}

/** The problems that need what the chain says: an unknown asset, an order that is not there
 * or belongs to somebody else. */
export function lookupProblems(
    proposal: Proposal,
    assets: Record<string, {symbol: string; precision: number}>,
    order: any | null | undefined
): Problem[] {
    const [id, fields] = proposal.ops[0];
    const out: Problem[] = [];
    if (id === OPERATIONS.limit_order_create) {
        if (
            !assets[fields.amount_to_sell.asset_id] ||
            !assets[fields.min_to_receive.asset_id]
        ) {
            out.push("asset_unknown");
        }
    } else if (order === null) {
        out.push("order_missing");
    } else if (order && order.seller !== fields.fee_paying_account) {
        out.push("order_not_yours");
    }
    return out;
}

export type PriceAssessment =
    | {kind: "none"}
    | {kind: "unpriced"}
    | {kind: "ok"; percent: number; market: number}
    | {kind: "worse"; percent: number; market: number};

/**
 * An order's price against the market's: the price is the units of the sold asset per one
 * of the bought, as the ticker of (sold, bought) gives it. Paying more than the limit above
 * the market is "worse"; a market with no price is "unpriced".
 */
export function assessPrice(
    proposal: Proposal,
    assets: Record<string, {symbol: string; precision: number}>,
    ticker: any
): PriceAssessment {
    const [id, fields] = proposal.ops[0];
    if (id !== OPERATIONS.limit_order_create) return {kind: "none"};
    const sell = assets[fields.amount_to_sell.asset_id];
    const receive = assets[fields.min_to_receive.asset_id];
    if (!sell || !receive) return {kind: "none"};
    const sold =
        Number(fields.amount_to_sell.amount) / Math.pow(10, sell.precision);
    const bought =
        Number(fields.min_to_receive.amount) / Math.pow(10, receive.precision);
    const market = marketPrice(ticker);
    if (!market || !(bought > 0)) return {kind: "unpriced"};
    const percent = ((sold / bought - market) / market) * 100;
    return percent > MAX_DEVIATION_PERCENT
        ? {kind: "worse", percent, market}
        : {kind: "ok", percent, market};
}

/** Minutes left (rounded down, never below 0) until the proposal stops being good. */
export function minutesLeft(proposal: Proposal, now: number): number {
    return Math.max(
        0,
        Math.floor((Date.parse(proposal.expires) - now) / 60000)
    );
}
