// What the left rail links to and how the topbar names the current route.
// Kept apart from `NextShellContainer.tsx` (which pulls in every store and
// modal) so it can be unit-tested on its own.
import {RailNavGroup} from "../design-system/Rail";
import {getDefaultMarket} from "branding";

export const NAV_GROUPS: RailNavGroup[] = [
    {
        label: "Account",
        items: [
            {label: "Dashboard", to: "/", exact: true},
            {label: "Accounts", to: "/accounts"},
            // `/voting` redirects to the current account's voting tab
            {
                label: "Voting",
                to: "/voting",
                match: /^\/(voting|account\/[^/]+\/voting)(\/|$)/
            },
            {label: "Settings", to: "/settings"}
        ]
    },
    {
        // Moving money. Send, Deposit and Withdraw open their dialogs (they are
        // actions, not pages) and used to be buttons in the top bar.
        label: "Payments",
        items: [
            {label: "Send", action: "send"},
            {label: "Deposit", action: "deposit"},
            {label: "Withdraw", action: "withdraw"},
            {label: "Timed transfer", to: "/timed-transfer"}
        ]
    },
    {
        label: "Markets",
        items: [
            {label: "Trade", to: `/market/${getDefaultMarket()}`},
            // right behind the order book: the other way to trade a pair
            {label: "Liquidity pools", to: "/pools"},
            {label: "Instant trade", to: "/instant-trade"},
            {label: "Prediction markets", to: "/prediction"},
            {label: "Explorer", to: "/explorer"}
        ]
    },
    {
        label: "Lending",
        items: [
            {label: "Credit offers", to: "/credit-offer"},
            {label: "SameT funds", to: "/samet-funds"}
        ]
    },
    {
        // The old header's "Spotlight": a grid of the rarer features (barter,
        // HTLC, direct debit, paper wallet, ...). Nothing else links to them.
        label: "More",
        items: [{label: "Spotlight", to: "/spotlight"}]
    }
];

// Capitalized first path segment as a stand-in breadcrumb (e.g. "/market/
// BTS_CNY" -> "Market"). Real per-route breadcrumbs/titles are a Phase 2
// concern (each migrated screen can pass its own); this just keeps the
// topbar from lying with a hardcoded "Phase 1 shell preview" label now
// that the shell wraps every route, not just /next. Segments whose
// capitalized form would read badly ("Credit-offer") get an explicit title.
const CRUMB_TITLES: Record<string, string> = {
    "credit-offer": "Credit offers",
    "samet-funds": "SameT funds",
    "timed-transfer": "Timed transfer",
    "instant-trade": "Instant trade",
    prediction: "Prediction markets",
    "create-worker": "Create worker",
    "deposit-withdraw": "Deposit & withdraw",
    "direct-debit": "Direct debit",
    htlc: "HTLC",
    "create-account": "Create account",
    "create-wallet-brainkey": "Create wallet",
    "existing-account": "Existing account",
    registration: "Create account",
    login: "Log in",
    wallet: "Wallet",
    invoice: "Invoice",
    asset: "Asset",
    block: "Block"
};

export function crumbFromPath(pathname: string): string {
    const segment = pathname.split("/").filter(Boolean)[0];
    if (!segment) return "Dashboard";
    return (
        CRUMB_TITLES[segment] ||
        segment.charAt(0).toUpperCase() + segment.slice(1)
    );
}
