// The help follows the app's menu: what the help pages are about, in the order
// of the menu groups they belong to. Titles come from each locale's toc.md
// (`getHelpTitles`); the names of the groups are translated in `help_page.
// groups`. A page that is not here (the component help pages) is reachable by
// link only.

export interface HelpGroup {
    key: string;
    paths: string[];
}

export const HELP_GROUPS: HelpGroup[] = [
    {
        key: "start",
        paths: [
            "introduction/bitshares",
            "introduction/wallets",
            "introduction/backups",
            "introduction/blockchain",
            "introduction/bridges_gateways"
        ]
    },
    {
        key: "account",
        paths: [
            "accounts/general",
            "accounts/permissions",
            "accounts/membership",
            "accounts/proposed",
            "voting"
        ]
    },
    {
        key: "payments",
        paths: [
            "payments/timed_transfer",
            "gateways/introduction",
            "gateways/xbtsx",
            "gateways/ioxbank"
        ]
    },
    {
        key: "markets",
        paths: [
            "dex/introduction",
            "dex/trading",
            "dex/shorting",
            "markets/pools"
        ]
    },
    {
        key: "assets",
        paths: ["assets/mpa", "assets/uia", "assets/privbitassets"]
    },
    {
        key: "network",
        paths: [
            "introduction/witness",
            "introduction/workers",
            "introduction/committee"
        ]
    },
    {key: "reference", paths: ["glossary", "disclaimer"]}
];

/** The titled entries of every group, for a locale's titles. */
export function structuredHelp(titles: {[path: string]: string}) {
    return HELP_GROUPS.map(group => ({
        key: group.key,
        entries: group.paths
            .filter(path => !!titles[path])
            .map(path => ({path, title: titles[path]}))
    })).filter(group => group.entries.length > 0);
}

/** Entries whose title contains `query` (case-insensitive), by group. */
export function filterHelp<
    G extends {entries: {path: string; title: string}[]}
>(groups: G[], query: string): G[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups
        .map(group => ({
            ...group,
            entries: group.entries.filter(entry =>
                entry.title.toLowerCase().includes(needle)
            )
        }))
        .filter(group => group.entries.length > 0);
}
