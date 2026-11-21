// What the start-up has read from this device, for the loading screen to show: the
// settings, the local database, the keys stored in this browser, the wallet, the
// accounts. Counts and names only - never a key, a password or a phrase.
// `routerTransition` reports a step as it finishes; the screen reads them here.

export type LocalStepId =
    | "settings"
    | "database"
    | "keys"
    | "wallet"
    | "accounts";

export type LocalStepState = "pending" | "active" | "done" | "none" | "failed";

export interface LocalStep {
    state: LocalStepState;
    /** the number the line is about (keys, accounts, wallets) */
    count?: number;
    /** a name the line is about (the wallet, the last account) */
    name?: string;
    /** the sign-in is by account name and password (no wallet is needed) */
    password?: boolean;
}

// in the order the start-up reads them: the database opens, then what is in it
export const LOCAL_STEP_ORDER: LocalStepId[] = [
    "database",
    "settings",
    "keys",
    "wallet",
    "accounts"
];

const initial = (): Record<LocalStepId, LocalStep> => ({
    settings: {state: "pending"},
    database: {state: "pending"},
    keys: {state: "pending"},
    wallet: {state: "pending"},
    accounts: {state: "pending"}
});

let steps = initial();
const listeners = new Set<() => void>();

export function getLocalSteps(): Record<LocalStepId, LocalStep> {
    return steps;
}

export function subscribeLocalSteps(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Record how a step stands; `detail` fills the step's count, name, password. */
export function reportLocalStep(
    id: LocalStepId,
    state: LocalStepState,
    detail: Omit<LocalStep, "state"> = {}
): void {
    steps = {...steps, [id]: {state, ...detail}};
    listeners.forEach(listener => listener());
}

/** A new start: nothing is read yet. */
export function resetLocalSteps(): void {
    steps = initial();
    listeners.forEach(listener => listener());
}

/**
 * The locale key and its parameters for a step's line. The line says what is being done
 * and keeps saying it when the step is checked: only a failure replaces it.
 */
export function describeLocalStep(
    id: LocalStepId,
    step: LocalStep
): {key: string; params: {[name: string]: string | number}} {
    const base = `app_init.local.${id}`;
    const params: {[name: string]: string | number} = {
        count: step.count ?? 0,
        name: step.name ?? ""
    };
    return {key: step.state === "failed" ? `${base}_failed` : base, params};
}
