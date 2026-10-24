import Immutable from "immutable";
import {ChainConfig} from "bitsharesjs-ws";
import {estimateFee} from "../../lib/common/trxHelper";

// the node's fee schedule for a transfer (operation 0): a fee and a price per kilobyte
const globalObject = (Immutable as any).fromJS({
    parameters: {
        current_fees: {
            scale: 10000,
            parameters: [[0, {fee: 100000, price_per_kbyte: 100000}]]
        }
    }
});

describe("the fee of a transfer with a memo", () => {
    const original = (ChainConfig as any).address_prefix;
    afterEach(() => (ChainConfig as any).setPrefix(original));

    // The estimate encrypts a dummy memo of the same length to learn its size; the keys it
    // used were "BTS..." ones, which bitsharesjs refuses on a chain whose prefix is another:
    // on the testnet every transfer with a memo had an "Unknown" fee.
    // (the estimate is cached by the memo's length: each case uses its own length)
    it.each([
        ["BTS", 10],
        ["TEST", 20],
        ["GPH", 30]
    ])(
        "can be estimated on a chain whose keys begin with %s",
        (prefix: string, length: number) => {
            (ChainConfig as any).setPrefix(prefix);
            const withMemo = estimateFee(
                "transfer",
                ["price_per_kbyte"],
                globalObject,
                {type: "memo", content: "m".repeat(length)}
            );
            const without = estimateFee(
                "transfer",
                ["price_per_kbyte"],
                globalObject,
                {type: "memo", content: ""}
            );
            // the memo costs something on top of the base fee
            expect(withMemo).toBeGreaterThan(without);
        }
    );
});
