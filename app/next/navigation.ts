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
            // the account's portfolio: balances, open orders, margin
            // positions, credit, activity (`/portfolio` redirects to the
            // current account's page)
            {
                label: "Portfolio",
                icon: "portfolio",
                to: "/portfolio",
                // /portfolio and every page of an account but its voting
                match: /^\/(portfolio|account\/[^/]+(\/(?!voting(\/|$)).*)?$)/
            },
            {
                label: "Accounts",
                icon: "accounts",
                to: "/accounts",
                // adding, creating and importing accounts and wallets
                match: /^\/(accounts|create-account|registration|login|existing-account|create-wallet-brainkey)(\/|$)/
            },
            // `/voting` redirects to the current account's voting tab
            {
                label: "Voting",
                icon: "voting",
                to: "/voting",
                match: /^\/(voting|create-worker|account\/[^/]+\/voting)(\/|$)/
            }
        ]
    },
    {
        // Moving money. Send, Deposit and Withdraw are pages of their own (the
        // dialogs shown in the page, not over it); they used to be popups.
        label: "Payments",
        items: [
            {
                label: "Send",
                icon: "send",
                to: "/send",
                match: /^\/(send|invoice)(\/|$)/
            },
            {
                label: "Deposit",
                icon: "deposit",
                to: "/deposit",
                // the old combined page redirects here
                match: /^\/(deposit|deposit-withdraw)(\/|$)/
            },
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
                to: `/market/${getDefaultMarket()}`,
                // every market, not only the default one
                match: /^\/market(\/|$)/
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
        items: [
            {
                label: "Explorer",
                icon: "explorer",
                to: "/explorer",
                // an asset's and a block's page are the explorer's
                match: /^\/(explorer|asset|block)(\/|$)/
            }
        ]
    },
    {
        // The old header's "Spotlight": a grid of the rarer features (barter,
        // HTLC, direct debit, paper wallet, ...). Nothing else links to them.
        label: "More",
        items: [
            {
                label: "Spotlight",
                icon: "spotlight",
                to: "/spotlight",
                // the features the hub links to
                match: /^\/(spotlight|borrow|barter|direct-debit|htlc)(\/|$)/
            },
            {
                label: "Advanced",
                icon: "advanced",
                to: "/advanced"
            },
            // what a Lifetime membership costs and after how many trades it pays for itself
            {
                label: "Lifetime membership",
                icon: "membership",
                to: "/membership"
            },
            {
                label: "Settings",
                icon: "settings",
                to: "/settings",
                match: /^\/(settings|wallet)(\/|$)/
            },
            {
                label: "Help",
                icon: "help",
                to: "/help",
                match: /^\/(help|news)(\/|$)/
            }
        ]
    }
];

/**
 * The menu with the AI assistants' page (MCP, docs/MCP.md) behind Advanced, when the app was
 * built with it. A build without it has no entry and no route.
 */
export function withMcp(
    groups: RailNavGroup[],
    enabled: boolean
): RailNavGroup[] {
    if (!enabled) return groups;
    return groups.map(group =>
        group.label !== "More"
            ? group
            : {
                  ...group,
                  items: group.items.reduce(
                      (items, item) =>
                          items.concat(
                              item.to === "/advanced"
                                  ? [
                                        item,
                                        {
                                            label: "AI assistants",
                                            icon: "assistant",
                                            to: "/mcp",
                                            match: /^\/mcp(\/|$)/
                                        }
                                    ]
                                  : [item]
                          ),
                      [] as typeof group.items
                  )
              }
    );
}

// A market's name as the trade page takes it: BASE_QUOTE.
const MARKET_NAME = /^[A-Za-z0-9._-]+_[A-Za-z0-9._-]+$/;

/**
 * The menu with "Trade" pointing at the market the user traded last (the
 * original header's behaviour), when there is one; the default market
 * otherwise.
 */
export function withLastMarket(
    groups: RailNavGroup[],
    lastMarket: unknown
): RailNavGroup[] {
    if (typeof lastMarket !== "string" || !MARKET_NAME.test(lastMarket)) {
        return groups;
    }
    return groups.map(group => ({
        ...group,
        items: group.items.map(item =>
            item.to && item.to.indexOf("/market/") === 0
                ? {...item, to: `/market/${lastMarket}`}
                : item
        )
    }));
}

// Capitalized first path segment as a stand-in breadcrumb (e.g. "/market/
// BTS_CNY" -> "Market"). Real per-route breadcrumbs/titles are a Phase 2
// concern (each migrated screen can pass its own); this just keeps the
// topbar from lying with a hardcoded "Phase 1 shell preview" label now
// that the shell wraps every route, not just /next. Segments whose
// capitalized form would read badly ("Credit-offer") get an explicit title.
const CRUMB_TITLES: Record<string, string> = {
    portfolio: "Portfolio",
    "credit-offer": "Credit offers",
    "samet-funds": "SameT funds",
    advanced: "Advanced",
    membership: "Lifetime membership",
    mcp: "AI assistants",
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
    overview: "Portfolio",
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
    if (segment === "account") {
        // `/account/<name>` is the portfolio itself
        if (!parts[2]) return "Portfolio";
        if (ACCOUNT_PAGE_TITLES[parts[2]]) return ACCOUNT_PAGE_TITLES[parts[2]];
    }
    return (
        CRUMB_TITLES[segment] ||
        segment.charAt(0).toUpperCase() + segment.slice(1)
    );
}
