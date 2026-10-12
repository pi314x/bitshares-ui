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
            {label: "Settings", to: "/settings"}
        ]
    },
    {
        label: "Markets",
        items: [
            {label: "Trade", to: `/market/${getDefaultMarket()}`},
            {label: "Liquidity pools", to: "/pools"},
            {label: "Explorer", to: "/explorer"}
        ]
    },
    {
        label: "Lending",
        items: [
            {label: "Credit offers", to: "/credit-offer"},
            {label: "SameT funds", to: "/samet-funds"}
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
    "samet-funds": "SameT funds"
};

export function crumbFromPath(pathname: string): string {
    const segment = pathname.split("/").filter(Boolean)[0];
    if (!segment) return "Dashboard";
    return (
        CRUMB_TITLES[segment] ||
        segment.charAt(0).toUpperCase() + segment.slice(1)
    );
}
