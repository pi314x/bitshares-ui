// Any operation, written as JSON: the operation's name and its fields as the chain
// reads them (what `get_transaction_hex` and the command-line wallet take). Used where
// a screen cannot have a form for every field - the steps between the borrow and the
// repay of a flash loan, and the operations an assertion guards - and by the screen that
// sends one operation as it is. The text is checked by serializing it with the library,
// which is what the transaction will do.
import {ops, ChainTypes} from "bitsharesjs";
import {Built, FEE_PLACEHOLDER} from "./advancedOps";

/** Operations the chain makes itself; they cannot be sent. */
const VIRTUAL = [4, 42, 44, 46, 51, 53, 74];

/** [id, name] of every operation that can be sent, in id order. */
export function sendableOperations(): Array<[number, string]> {
    const operations = (ChainTypes as any).operations as Record<string, number>;
    return Object.keys(operations)
        .map(name => [operations[name], name] as [number, string])
        .filter(([id]) => !VIRTUAL.includes(id))
        .sort((a, b) => a[0] - b[0]);
}

/** Whether the field can be left out (the library's `optional`). */
function isOptional(type: any): boolean {
    try {
        return type.toObject(undefined, {}) === undefined;
    } catch (e) {
        return false;
    }
}

/**
 * A skeleton of an operation's fields (the fee and the extensions are filled in when it
 * is sent), as JSON text. Optional fields are left out.
 */
export function operationTemplate(name: string): string {
    const serializer = (ops as any)[name];
    if (!serializer || !serializer.keys) return "{}";
    const template: any = {};
    serializer.keys.forEach((key: string) => {
        if (key === "fee" || key === "extensions") return;
        const type = serializer.types[key];
        if (isOptional(type)) return;
        try {
            template[key] = type.toObject(undefined, {use_default: true});
        } catch (e) {
            // a type without a default: leave it for the person to write
        }
    });
    return JSON.stringify(template, null, 2);
}

/** The library's error, without its stack: "transfer.amount cause: ...". */
export function describeSerializerError(error: any): string {
    const message = String((error && error.message) || error || "");
    return message
        .split(" stack:")[0]
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * The operation `[id, fields]` of a name and its JSON text; a missing fee is filled with
 * the placeholder the transaction replaces by the real fee.
 */
export function parseOperationJson(name: string, text: string): Built<any[]> {
    const id = (ChainTypes as any).operations[name];
    if (id === undefined || VIRTUAL.includes(id)) {
        return {ok: false, error: "operation_invalid"};
    }
    let data: any;
    try {
        data = JSON.parse(text);
    } catch (e) {
        return {ok: false, error: "json_invalid", detail: (e as Error).message};
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return {ok: false, error: "json_invalid"};
    }
    if (!data.fee) data.fee = {...FEE_PLACEHOLDER};
    // operations with a list of extensions take the empty one
    const serializer = (ops as any)[name];
    if (
        serializer &&
        serializer.keys &&
        serializer.keys.includes("extensions") &&
        data.extensions === undefined
    ) {
        data.extensions = [];
    }
    try {
        (ops as any).operation.fromObject([id, data]);
    } catch (e) {
        return {
            ok: false,
            error: "json_invalid",
            detail: describeSerializerError(e)
        };
    }
    return {ok: true, op: [id, data]};
}

export interface Step {
    name: string;
    text: string;
}

/**
 * The steps of a transaction, each an operation as JSON, as [name, fields] pairs. The
 * first one that cannot be read is named by its place ("#2") in the detail.
 */
export function parseSteps(steps: Step[]): Built<Array<[string, any]>> {
    const parsed: Array<[string, any]> = [];
    for (let i = 0; i < steps.length; i++) {
        const built = parseOperationJson(steps[i].name, steps[i].text);
        if (!built.ok) {
            return {
                ok: false,
                error: built.error,
                detail: `#${i + 1}${built.detail ? `: ${built.detail}` : ""}`
            };
        }
        parsed.push([steps[i].name, built.op[1]]);
    }
    return {ok: true, op: parsed};
}
