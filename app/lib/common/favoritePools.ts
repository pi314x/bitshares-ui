// The liquidity pools the user marked with a star: kept in this browser, by the id of the pool's share asset
// (what the node's pool queries take). A small external store, read with `useSyncExternalStore`.
import * as React from "react";

const KEY = "__graphene__favoritePools";
export const MAX_FAVORITE_POOLS = 100;

const SHARE_ASSET = /^1\.3\.\d+$/;

function load(): string[] {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]");
        if (!Array.isArray(parsed)) return [];
        const seen = new Set<string>();
        return parsed
            .filter(
                (id: any) =>
                    typeof id === "string" &&
                    SHARE_ASSET.test(id) &&
                    !seen.has(id) &&
                    !!seen.add(id)
            )
            .slice(0, MAX_FAVORITE_POOLS);
    } catch (e) {
        return [];
    }
}

let favorites: string[] = load();
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach(listener => listener());
}

function save() {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(favorites));
    } catch (e) {
        // not kept: the stars stay for this visit
    }
}

export const getFavoritePools = (): string[] => favorites;

/** Stars the pool (by its share asset) when it has no star, takes it away when it has one. */
export function toggleFavoritePool(shareAsset: string): void {
    if (!SHARE_ASSET.test(shareAsset)) return;
    if (favorites.includes(shareAsset)) {
        favorites = favorites.filter(id => id !== shareAsset);
    } else {
        // the newest first; the oldest go when there are too many
        favorites = [shareAsset, ...favorites].slice(0, MAX_FAVORITE_POOLS);
    }
    save();
    emit();
}

/** Back to what is stored (tests). */
export function reloadFavoritePools(): void {
    favorites = load();
    emit();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** The starred pools (share asset ids, newest first); the page redraws when one is starred or unstarred. */
export function useFavoritePools(): string[] {
    return React.useSyncExternalStore(subscribe, getFavoritePools, () => []);
}
