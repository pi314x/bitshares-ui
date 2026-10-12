// Turns the operations a screen has put on a `TransactionBuilder` into what the
// extension's `signTransaction` takes, and refuses what the extension cannot
// sign faithfully. Pure functions; no chain access, no keys.
//
// What the extension does with a transaction (read from its source, v0.8.7):
//   - it overwrites every operation's `fee` with the node's required fee in the
//     CORE asset, so a different fee asset chosen in the UI would be silently
//     ignored -> refused here;
//   - it serialises a memo as given, so a plain-text memo would land on chain
//     UNENCRYPTED, and the app has no memo key to encrypt it -> refused here;
//   - it signs with the connected account's ACTIVE key, and only checks the
//     authority fields it knows about -> every authority-bearing account field
//     is checked here against the connected account;
//   - it only accepts a whitelist of operation types and answers the rest with
//     an error, which is passed on as it is.
import {ops} from "bitsharesjs";
import {
    ExtensionOperation,
    ExtensionTransaction,
    ExternalSignerError
} from "./types";

export const CORE_ASSET_ID = "1.3.0";

// Fields that name the account whose authority signs the operation. A superset
// of the extension's own list: it misses `owner_account` (samet_fund_*,
// credit_offer_*), `borrower` and `owner`.
const AUTHORITY_FIELDS = [
    "from",
    "account",
    "seller",
    "fee_paying_account",
    "registrar",
    "account_id",
    "issuer",
    "funding_account",
    "owner_account",
    "borrower",
    "owner"
];

const ACCOUNT_ID = /^1\.2\.\d+$/;

function unsupported(message: string): ExternalSignerError {
    return new ExternalSignerError("unsupported", message);
}

/** Canonical node JSON for the builder's operations, with the guards above. */
export function toExtensionTransaction(
    operations: unknown[]
): ExtensionTransaction {
    if (!Array.isArray(operations) || !operations.length) {
        throw unsupported("There is nothing to sign.");
    }
    const out: ExtensionOperation[] = operations.map(op => {
        let object: any;
        try {
            object = (ops as any).operation.toObject(op);
        } catch (e) {
            throw new ExternalSignerError(
                "failed",
                "An operation could not be serialised: " +
                    String((e && (e as any).message) || e).split("\n")[0]
            );
        }
        const [id, data] = object as ExtensionOperation;
        if (data && data.memo) {
            throw unsupported(
                "A memo cannot be sent through the extension yet: it would be " +
                    "published unencrypted. Remove the memo or sign with the local wallet."
            );
        }
        const feeAsset = data && data.fee && data.fee.asset_id;
        if (feeAsset !== CORE_ASSET_ID) {
            throw unsupported(
                "The extension pays fees in the core asset only. Choose the core " +
                    "asset as the fee asset or sign with the local wallet."
            );
        }
        return [id, data];
    });
    return {operations: out};
}

/**
 * Every authority-bearing account field in every operation must be the
 * connected account: the extension signs with that account's key, and a
 * transaction that names another account would be rejected by the node
 * anyway - better to say so before the user is asked to approve it.
 */
export function assertOperationsBelongTo(
    transaction: ExtensionTransaction,
    accountId: string
): void {
    for (const [, data] of transaction.operations) {
        for (const field of AUTHORITY_FIELDS) {
            const value = data && data[field];
            if (
                typeof value === "string" &&
                ACCOUNT_ID.test(value) &&
                value !== accountId
            ) {
                throw new ExternalSignerError(
                    "account_mismatch",
                    "This transaction acts for " +
                        value +
                        ", but the extension is connected as " +
                        accountId +
                        "."
                );
            }
        }
    }
}
