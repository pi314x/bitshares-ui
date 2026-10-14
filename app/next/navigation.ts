// What the left rail links to and how the topbar names the current route.
// Kept apart from `NextShellContainer.tsx` (which pulls in every store and
// modal) so it can be unit-tested on its own.
import {RailNavGroup} from "../design-system/Rail";
import {getDefaultMarket} from "branding";

export const NAV_GROUPS: RailNavGroup[] = [
    {
        label: "Account",
        items: [
            {label: "Dashboard", icon: "dashboard", to: "/", exact: true},
            {label: "Accounts", icon: "accounts", to: "/accounts"},
            // `/voting` redirects to the current account's voting tab
            {
                label: "Voting",
                icon: "voting",
                to: "/voting",
                match: /^\/(voting|account\/[^/]+\/voting)(\/|$)/
            },
            {label: "Settings", icon: "settings", to: "/settings"}
        ]
    },
    {
        // Moving money. Send, Deposit and Withdraw are pages of their own (the
        // dialogs shown in the page, not over it); they used to be popups.
        label: "Payments",
        items: [
            {label: "Send", icon: "send", to: "/send"},
            {label: "Deposit", icon: "deposit", to: "/deposit"},
            {label: "Withdraw", icon: "withdraw", to: "/withdraw"},
            {label: "Timed transfer", icon: "timed", to: "/timed-transfer"}
        ]
    },
    {
        label: "Markets",
        items: [
            {
                label: "Trade",
                icon: "trade",
                to: `/market/${getDefaultMarket()}`
            },
            // right behind the order book: the other way to trade a pair
            {label: "Liquidity pools", icon: "pools", to: "/pools"},
            {label: "Instant trade", icon: "instant", to: "/instant-trade"},
            {label: "Prediction markets", icon: "prediction", to: "/prediction"}
        ]
    },
    {
        label: "Lending",
        items: [
            {label: "Credit offers", icon: "credit", to: "/credit-offer"},
            {label: "SameT funds", icon: "funds", to: "/samet-funds"}
        ]
    },
    {
        // Looking at the chain itself rather than trading on it: blocks, assets,
        // pools, accounts, witnesses, committee, markets, fees.
        label: "Network",
        items: [{label: "Explorer", icon: "explorer", to: "/explorer"}]
    },
    {
        // The old header's "Spotlight": a grid of the rarer features (barter,
        // HTLC, direct debit, paper wallet, ...). Nothing else links to them.
        label: "More",
        items: [
            {label: "Spotlight", icon: "spotlight", to: "/spotlight"},
            {label: "Help", icon: "help", to: "/help"}
        ]
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
    send: "Send",
    deposit: "Deposit",
    withdraw: "Withdraw",
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

// An account's own pages: `/account/<name>/<page>` is titled by the page.
const ACCOUNT_PAGE_TITLES: Record<string, string> = {
    orders: "Open orders",
    assets: "Assets",
    pools: "Liquidity pools",
    vesting: "Vesting",
    permissions: "Permissions",
    whitelist: "Whitelist",
    signedmessages: "Signed messages",
    "member-stats": "Membership",
    voting: "Voting",
    "create-asset": "Create asset"
};

export function crumbFromPath(pathname: string): string {
    const parts = pathname.split("/").filter(Boolean);
    const segment = parts[0];
    if (!segment) return "Dashboard";
    if (segment === "account" && parts[2] && ACCOUNT_PAGE_TITLES[parts[2]]) {
        return ACCOUNT_PAGE_TITLES[parts[2]];
    }
    return (
        CRUMB_TITLES[segment] ||
        segment.charAt(0).toUpperCase() + segment.slice(1)
    );
}
