// A prepared transaction as the MCP server makes it, for the tests of the review.
import crypto from "crypto";
import {fingerprint} from "../../../mcp/src/proposal";

export const sha256Hex = (text: string) =>
    crypto
        .createHash("sha256")
        .update(text)
        .digest("hex");

export const CHAIN =
    "4018d7844c78f6a6c41c6a552b898022310fc5dec06da467ee7905a8dad512c8";
export const NOW = Date.parse("2026-10-20T21:35:00Z");

export function makeProposal(over?: any) {
    const p: any = {
        v: 1,
        chain: CHAIN,
        account: {id: "1.2.100", name: "alice"},
        ops: [
            [
                1,
                {
                    fee: {amount: "0", asset_id: "1.3.0"},
                    seller: "1.2.100",
                    amount_to_sell: {amount: "10000000", asset_id: "1.3.0"},
                    min_to_receive: {amount: "1205", asset_id: "1.3.121"},
                    expiration: "2026-10-21T21:31:15",
                    fill_or_kill: false,
                    extensions: []
                }
            ]
        ],
        created: "2026-10-20T21:31:15Z",
        expires: "2026-10-20T21:41:15Z",
        nonce: "abababababababab",
        ref: ""
    };
    Object.assign(p, over || {});
    p.ref = fingerprint(p, sha256Hex);
    return p;
}

export const CANCEL_OPS = [
    [
        2,
        {
            fee: {amount: "0", asset_id: "1.3.0"},
            fee_paying_account: "1.2.100",
            order: "1.7.500",
            extensions: []
        }
    ]
];
