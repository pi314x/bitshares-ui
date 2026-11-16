import {
    txErrorExplanationKey,
    txErrorKind,
    txErrorText
} from "../../lib/common/txErrors";

describe("txErrorKind", () => {
    it("knows a fill-or-kill order that could not be filled whole (the text of the node, as it came)", () => {
        const raw =
            '3050101 - Execution error: Killing limit order due to unable to fill: Killing limit order {"fee":{"amount":48260,"asset_id":"1.3.0"},"seller":"1.2.893838","amount_to_sell":{"amount":18301000,"asset_id":"1.3.0"},"min_to_receive":{"amount":163,"asset_id":"1.3.5659"},"fill_or_kill":true,"extensions":{}} due to unable to fill';
        expect(txErrorKind(raw)).toBe("unfilled");
        expect(txErrorKind(new Error(raw))).toBe("unfilled");
        expect(txErrorExplanationKey({message: raw})).toBe(
            "operation_dialog.explain_unfilled"
        );
    });

    it("knows a floor that was missed, an empty balance, an expired transaction", () => {
        expect(txErrorKind("Unable to exchange due to slippage")).toBe("floor");
        expect(txErrorKind("min_to_receive not reached")).toBe("floor");
        expect(txErrorKind("Insufficient Balance: have 0")).toBe("balance");
        expect(txErrorKind("Transaction expired")).toBe("expired");
    });

    it("takes nothing (a cancelled dialog rejects with nothing) and a word of cancelling as cancelled", () => {
        expect(txErrorKind(undefined)).toBe("cancelled");
        expect(txErrorKind(null)).toBe("cancelled");
        expect(txErrorKind("")).toBe("cancelled");
        expect(txErrorKind(new Error("User rejected the request"))).toBe(
            "cancelled"
        );
    });

    it("does not call a signing problem a market event, and does not guess at the rest", () => {
        expect(txErrorKind("Missing signing key for slippage")).toBeNull();
        expect(txErrorKind("Missing required active authority")).toBeNull();
        expect(txErrorKind("network down")).toBeNull();
        expect(txErrorExplanationKey("network down")).toBeNull();
    });
});

describe("txErrorText", () => {
    it("reads strings, Errors and plain objects", () => {
        expect(txErrorText("a")).toBe("a");
        expect(txErrorText(new Error("b"))).toBe("b");
        expect(txErrorText({code: 3})).toBe('{"code":3}');
        expect(txErrorText(undefined)).toBe("");
    });
});
