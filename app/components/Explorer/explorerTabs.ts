// Which Explorer tab is shown for an address. Kept apart from Explorer.tsx
// (which pulls in every tab's screen) so it is a plain function that is tested
// directly.

export const EXPLORER_TAB_LINKS = {
    blocks: "/explorer/blocks",
    assets: "/explorer/assets",
    accounts: "/explorer/accounts",
    witnesses: "/explorer/witnesses",
    committee_members: "/explorer/committee-members",
    markets: "/explorer/markets",
    fees: "/explorer/fees"
};

export const DEFAULT_EXPLORER_TAB = EXPLORER_TAB_LINKS.blocks;

const LINKS: string[] = Object.keys(EXPLORER_TAB_LINKS).map(
    k => (EXPLORER_TAB_LINKS as any)[k]
);

/** The tab to show for a path: the path's own tab, otherwise (at plain
 * /explorer) the one the user used last, otherwise the blockchain. */
export function explorerTabFor(
    pathname: string,
    remembered: string | null
): string {
    const path = pathname.replace(/\/$/, "");
    if (LINKS.indexOf(path) !== -1) return path;
    return remembered && LINKS.indexOf(remembered) !== -1
        ? remembered
        : DEFAULT_EXPLORER_TAB;
}
