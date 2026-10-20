// Integration seam for signing through the BitShares wallet browser extension
// (docs/UI_MIGRATION_PLAN.md, Phase 6, §7.11). The extension is
// https://github.com/pi314x/bitshares-wallet-browser-extension; this interface
// is its page-facing protocol (`window.bitsharesWallet`, see `provider.ts`) seen
// from the app, written from that repository's source (v0.8.7) and not from
// memory or its README alone - the README documents `transfer({amount: {...}})`
// while the code accepts `amount` as a number or string, so only `signTransaction`
// is used.
//
// The extension holds the keys. The app never sees them: it builds the
// operations, hands them over, the user approves in the extension's own dialog,
// and the extension signs and broadcasts.

export interface ExternalSignerAccount {
    accountName: string;
    accountId: string;
}

/** `[operation id, operation as canonical node JSON]`, as `bitsharesjs` emits. */
export type ExtensionOperation = [number, Record<string, any>];

export interface ExtensionTransaction {
    operations: ExtensionOperation[];
}

export type ExternalSignerErrorCode =
    | "unavailable"
    | "locked"
    | "rejected"
    | "timeout"
    | "unknown"
    | "chain_mismatch"
    | "account_mismatch"
    | "unsupported"
    | "failed";

export class ExternalSignerError extends Error {
    code: ExternalSignerErrorCode;
    constructor(code: ExternalSignerErrorCode, message: string) {
        super(message);
        this.name = "ExternalSignerError";
        this.code = code;
    }
}

/**
 * What the extension tells a site it can do (its `getCapabilities`, protocol 2). An older
 * extension does not know the method: that is `null` here, and the app keeps to what every
 * version does (no memo, core-asset fee, whatever operations the extension answers for).
 */
export interface ExtensionCapabilities {
    protocol: number;
    version: string;
    /** the operation ids `signTransaction` accepts from a site */
    operations: number[];
    /** a transfer's plain-text `memo` string is encrypted by the extension */
    memoEncryption: boolean;
    /** `fee.asset_id` of the operations is the asset the fee is paid in */
    feeAsset: boolean;
}

export interface ExternalSigner {
    /** Whether the extension is installed and reachable in this browser. */
    isAvailable(): Promise<boolean>;

    /** Whether the extension's wallet is locked (it must be unlocked there). */
    isLocked(): Promise<boolean>;

    /** What the extension can do; `null` for an extension that cannot say. Never rejects. */
    capabilities(): Promise<ExtensionCapabilities | null>;

    /**
     * Prompts the user, in the extension, to link an account to this site. The
     * extension refuses when it is on a different chain than `chainId`.
     */
    connect(chainId: string): Promise<ExternalSignerAccount>;

    /**
     * Restores a connection the user approved earlier, without showing
     * anything; `null` when there is none.
     */
    restore(chainId: string): Promise<ExternalSignerAccount | null>;

    /**
     * Hands built operations to the extension for the user to review and sign
     * there; the extension broadcasts. Re-checks the chain and the connected
     * account first. Rejects with an `ExternalSignerError`.
     */
    signAndBroadcast(
        account: ExternalSignerAccount,
        transaction: ExtensionTransaction,
        chainId: string
    ): Promise<{result: unknown}>;

    disconnect(): Promise<void>;
}
