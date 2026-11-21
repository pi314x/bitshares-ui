// What went wrong with a transaction, in a few words a person can act on. The node's own text
// ("3050101 - Execution error: Killing limit order due to unable to fill: Killing limit order
// {...} due to unable to fill") stays available as the details; this only says which of the common
// cases it is, so that a dialog can lead with a sentence instead of a wall of JSON.

export type TxErrorKind =
    | "unfilled"
    | "floor"
    | "balance"
    | "expired"
    | "cancelled";

/** The error as text: strings, Errors, plain objects; nothing (a cancelled dialog rejects with none). */
export function txErrorText(error: any): string {
    if (error === undefined || error === null || error === "") return "";
    if (typeof error === "string") return error;
    if (error.message) return String(error.message);
    try {
        return JSON.stringify(error);
    } catch (e) {
        return String(error);
    }
}

/** Which common case an error is, or null when it is none of them. */
export function txErrorKind(error: any): TxErrorKind | null {
    const text = txErrorText(error).toLowerCase();
    if (!text) return "cancelled";
    // a refusal of the signing is not a market event, whatever else the text says
    if (/missing signing key|authority|signature/.test(text)) return null;
    if (/cancel|user reject|rejected by the user|denied/.test(text)) {
        return "cancelled";
    }
    // a fill-or-kill order the book could not fill whole (the market moved since the quote)
    if (
        /killing limit order|unable to fill|fill.or.kill|fill_or_kill|not fully filled/.test(
            text
        )
    ) {
        return "unfilled";
    }
    // a pool (or order) that returned less than the floor of its operation
    if (
        /slippage|min_to_receive|unable to exchange|less than the minimum/.test(
            text
        )
    ) {
        return "floor";
    }
    if (/insufficient balance|insufficient funds|not enough/.test(text)) {
        return "balance";
    }
    if (/expire/.test(text)) return "expired";
    return null;
}

/** The locale key (`operation_dialog.*`) of the sentence for an error, or null. */
export function txErrorExplanationKey(error: any): string | null {
    const kind = txErrorKind(error);
    return kind ? `operation_dialog.explain_${kind}` : null;
}
