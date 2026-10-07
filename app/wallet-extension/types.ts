// Placeholder integration seam for signing via the BitShares wallet browser
// extension (docs/UI_MIGRATION_PLAN.md, Phase 6). Deliberately protocol-
// agnostic: which extension (Beet, or a purpose-built "BitShares" one) and
// its exact wire protocol (injected `window` object vs. `postMessage`,
// request/response shape) were not confirmed when this was scaffolded, and
// a wallet that moves funds is not the place to guess at one. Implement a
// concrete adapter against this interface once that's confirmed — don't
// extend or change this interface's shape speculatively before then.

export interface ExternalSignerAccount {
    accountName: string;
    accountId: string;
}

export interface ExternalSigner {
    /** Whether the extension is installed and reachable in this browser. */
    isAvailable(): Promise<boolean>;

    /** Prompts the user, in the extension, to link an account to this site. */
    connect(): Promise<ExternalSignerAccount>;

    /**
     * Hands a built (unsigned) transaction to the extension for the user to
     * review and sign there; the extension broadcasts it. `transaction` is
     * intentionally untyped here — it should be the same transaction object
     * `bitsharesjs`'s TransactionBuilder produces, typed precisely once the
     * concrete adapter is implemented against a confirmed protocol.
     */
    signAndBroadcast(
        account: ExternalSignerAccount,
        transaction: unknown
    ): Promise<{transactionId: string}>;

    disconnect(): Promise<void>;
}
