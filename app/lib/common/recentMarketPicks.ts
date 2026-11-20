// The assets the user picked last in the market picker (the Exchange header's "Find by asset"): the picker lists them
// when the search box is empty, so a market that is used again and again is one press away. The newest first, at
// most five, each can be removed. Kept in this browser (localStorage); nothing in it is a secret.
//
// A small external store (read with `useSyncExternalStore`), like the address book.
import * as React from "react";
import {validAssetSymbol} from "./addressBook";

export interface RecentPick {
    /** the symbol of the asset that was picked */
    symbol: string;
    /** the asset's owner as the picker showed it ("" when it was not known) */
    issuer: string;
}

export const MAX_RECENT_PICKS = 5;
const MAX_ISSUER = 64;
const KEY = "__graphene__recentMarketPicks";

function clean(raw: any): RecentPick | null {
    if (!raw || typeof raw.symbol !== "string") return null;
    const symbol = raw.symbol.trim().toUpperCase();
    if (!validAssetSymbol(symbol)) return null;
    const issuer =
        typeof raw.issuer === "string" ? raw.issuer.slice(0, MAX_ISSUER) : "";
    return {symbol, issuer};
}

function load(): RecentPick[] {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]");
        if (!Array.isArray(parsed)) return [];
        const seen = new Set<string>();
        const out: RecentPick[] = [];
        for (const raw of parsed) {
            const pick = clean(raw);
            if (pick && !seen.has(pick.symbol)) {
                seen.add(pick.symbol);
                out.push(pick);
            }
        }
        return out.slice(0, MAX_RECENT_PICKS);
    } catch (e) {
        return [];
    }
}

let picks: RecentPick[] = load();
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach(listener => listener());
}

function save() {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(picks));
    } catch (e) {
        // not kept: the list stays for this visit
    }
}

export const getRecentPicks = (): RecentPick[] => picks;

/** A pick goes to the front (an asset that is in the list already moves there); only the last five are kept. */
export function addRecentPick(symbol: string, issuer = ""): void {
    const pick = clean({symbol, issuer});
    if (!pick) return;
    const same = picks[0] && picks[0].symbol === pick.symbol;
    if (same && picks[0].issuer === pick.issuer) return;
    picks = [pick, ...picks.filter(p => p.symbol !== pick.symbol)].slice(
        0,
        MAX_RECENT_PICKS
    );
    save();
    emit();
}

export function removeRecentPick(symbol: string): void {
    if (!picks.some(p => p.symbol === symbol)) return;
    picks = picks.filter(p => p.symbol !== symbol);
    save();
    emit();
}

/** Back to what is stored (tests). */
export function reloadRecentPicks(): void {
    picks = load();
    emit();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function useRecentPicks(): RecentPick[] {
    return React.useSyncExternalStore(subscribe, getRecentPicks, () => []);
}
