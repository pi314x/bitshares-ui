// The page-facing API the BitShares wallet extension injects as
// `window.bitsharesWallet` (source: its `src/content/inpage.js`). Only the
// members this app uses are typed.
//
// `window.beet` is deliberately NOT used: the extension offers it as a
// compatibility shim for BeetEOS dApps, and that shim is not a faithful
// protocol (its `requestIdentity` reads `.name` off a `{account, balances}`
// result).

export interface ProviderAccount {
    name: string;
    id: string;
}

export interface BitSharesWalletProvider {
    isBitSharesWallet: true;
    connect(options?: {
        chain_id?: string;
    }): Promise<{account: ProviderAccount | null; balances: unknown[]}>;
    checkConnection(): Promise<{
        connected: boolean;
        account: ProviderAccount | null;
    }>;
    getChainId(): Promise<string>;
    disconnect(): Promise<void>;
    /** Signs AND broadcasts; resolves `{success, result}` or `{success: false, error}`. */
    signTransaction(transaction: {
        operations: unknown[];
        extensions?: unknown[];
    }): Promise<{success?: boolean; result?: unknown; error?: string}>;
    request(method: string, params?: Record<string, unknown>): Promise<any>;
    on(event: string, callback: (data: any) => void): void;
    off(event: string, callback: (data: any) => void): void;
}

export function isProvider(value: any): value is BitSharesWalletProvider {
    return (
        !!value &&
        value.isBitSharesWallet === true &&
        typeof value.connect === "function" &&
        typeof value.checkConnection === "function" &&
        typeof value.getChainId === "function" &&
        typeof value.signTransaction === "function" &&
        typeof value.request === "function"
    );
}

export function findProvider(
    target: any = typeof window !== "undefined" ? window : undefined
): BitSharesWalletProvider | null {
    const candidate = target && target.bitsharesWallet;
    return isProvider(candidate) ? candidate : null;
}

/**
 * The extension injects at `document_start`, so the provider is normally there
 * by the time the app runs; this also covers a slower injection by waiting for
 * the `bitsharesWalletReady` event, and gives up after `timeoutMs`.
 */
export function waitForProvider(
    target: any = typeof window !== "undefined" ? window : undefined,
    timeoutMs = 1500
): Promise<BitSharesWalletProvider | null> {
    const now = findProvider(target);
    if (now || !target || typeof target.addEventListener !== "function") {
        return Promise.resolve(now);
    }
    return new Promise(resolve => {
        // `done` only runs later (event or timeout), after `timer` exists
        const done = () => {
            clearTimeout(timer);
            target.removeEventListener("bitsharesWalletReady", done);
            resolve(findProvider(target));
        };
        target.addEventListener("bitsharesWalletReady", done);
        const timer = setTimeout(done, timeoutMs);
    });
}
