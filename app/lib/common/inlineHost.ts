import * as React from "react";

// A place in the page that has taken over showing something that is otherwise a
// global popup (the "confirm this transaction" dialog). While at least one such
// host is mounted the global instance stays out of the way, so the dialog is
// shown once, in the page; screens without a host (the account creation
// screens, which are not inside the shell) keep the popup.
//
// This is a small external store, read with `useSyncExternalStore`.

const listeners = new Set<() => void>();
const hosts = new Map<string, number>();

function emit() {
    listeners.forEach(listener => listener());
}

/** Registers a host for `name`; returns the function that removes it. */
export function registerInlineHost(name: string): () => void {
    hosts.set(name, (hosts.get(name) || 0) + 1);
    emit();
    return () => {
        const left = (hosts.get(name) || 1) - 1;
        if (left > 0) hosts.set(name, left);
        else hosts.delete(name);
        emit();
    };
}

export function hasInlineHost(name: string): boolean {
    return (hosts.get(name) || 0) > 0;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function useHasInlineHost(name: string): boolean {
    return React.useSyncExternalStore(
        subscribe,
        () => hasInlineHost(name),
        () => false
    );
}
