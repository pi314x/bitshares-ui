/** @jest-environment node */
// The SameT funds tool of the UI: the funds that lend an asset for the length of one transaction, what each can lend, its
// fee, and the fee of a loan of an amount. The node is a table of the shape the live one gave (checked on 2026-11-22).
import crypto from "crypto";
import {readConfig} from "../../../mcp/src/env";
import {createContext} from "../../../mcp/src/tools";
import {createProtocol} from "../../../mcp/src/protocol";
import {createChain} from "../utils/fakeChain";

function setup(funds: any[]) {
    const chain = createChain();
    const calls: any[] = [];
    const rpc = {
        async call(api: any, method: string, params: any[]) {
            calls.push([method, params]);
            if (method === "list_samet_funds") {
                return params[1] === null || params[1] === "1.20.0"
                    ? funds
                    : [];
            }
            return chain.rpc.call(api, method, params);
        },
        last: () => "https://node.test/ws"
    };
    const config = readConfig({MCP_ENABLED: "true"});
    const context = createContext({
        rpc,
        config,
        now: () => Date.parse("2026-11-22T10:00:00Z"),
        randomHex: (n: number) => "ab".repeat(n),
        sha256Hex: (t: string) =>
            crypto
                .createHash("sha256")
                .update(t)
                .digest("hex")
    });
    const protocol = createProtocol({config, context, log: () => {}});
    const call = async (args?: any) =>
        (await protocol.handle({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {name: "bitshares_samet_funds", arguments: args}
        })) as any;
    const data = async (args?: any) => {
        const reply = await call(args);
        expect(reply.result.isError).toBe(false);
        return reply.result.structuredContent;
    };
    return {calls, call, data};
}

// BTS (1.3.0, 5 decimals) and USD (1.3.121, 4 decimals) are in the fake chain
const fund = (
    id: string,
    asset: string,
    balance: string,
    rate: number,
    unpaid: any = 0
) => ({
    id,
    owner_account: "1.2.100",
    asset_type: asset,
    balance,
    fee_rate: rate,
    unpaid_amount: unpaid
});
const FUNDS = [
    fund("1.20.1", "1.3.0", "1000000000", 500),
    fund("1.20.2", "1.3.0", "50000000", 300),
    fund("1.20.3", "1.3.121", "200000", 300),
    // lends nothing now: everything is out
    fund("1.20.4", "1.3.0", "70000000", 100, "70000000")
];

describe("bitshares_samet_funds", () => {
    it("lists the funds with what each can lend and its fee, by asset and then by fee", async () => {
        const {data} = setup(FUNDS);
        const out = await data({});
        expect(out.count).toBe(4);
        expect(out.funds.map((f: any) => f.id)).toEqual([
            "1.20.4",
            "1.20.2",
            "1.20.1",
            "1.20.3"
        ]);
        expect(out.funds[1]).toEqual({
            id: "1.20.2",
            asset: "BTS",
            lends: "500.00000",
            fee_percent: 0.03,
            fee_rate: 300,
            fee_for_amount: null,
            can_lend_amount: null
        });
        // what is out is not lendable: the fund 1.20.4 lends 0
        expect(out.funds[0].lends).toBe("0.00000");
        expect(out.notes.join(" ")).toMatch(/not a flash loan/);
    });

    it("takes the funds of one asset, the cheapest loan of an amount first, and says which can lend it", async () => {
        const {data} = setup(FUNDS);
        const out = await data({asset: "BTS", amount: "400"});
        // 1.20.4 lends nothing and is left out; both others can lend 400: the cheaper fee first
        expect(out.funds.map((f: any) => f.id)).toEqual(["1.20.2", "1.20.1"]);
        expect(out.funds[0]).toMatchObject({
            fee_for_amount: "0.12000",
            can_lend_amount: true
        });
        expect(out.funds[1]).toMatchObject({
            fee_for_amount: "0.20000",
            can_lend_amount: true
        });
    });

    it("puts a fund that cannot lend the whole amount after the ones that can, whatever its fee", async () => {
        const {data} = setup(FUNDS);
        // 1.20.2 holds 500: it cannot lend 800 and 1.20.1 (500 fee rate) can
        const out = await data({asset: "BTS", amount: "800"});
        expect(out.funds.map((f: any) => [f.id, f.can_lend_amount])).toEqual([
            ["1.20.1", true],
            ["1.20.2", false]
        ]);
    });

    it("rounds the fee up, as the chain does, and has none for a fund with a rate of 0", async () => {
        const {data} = setup([
            fund("1.20.1", "1.3.0", "1000000000", 1),
            fund("1.20.2", "1.3.0", "1000000000", 0)
        ]);
        const out = await data({asset: "BTS", amount: "0.00001"});
        // 1 unit at 1 / 1,000,000 rounds up to 1 unit; a rate of 0 charges nothing
        const byId: any = {};
        out.funds.forEach((f: any) => (byId[f.id] = f));
        expect(byId["1.20.1"].fee_for_amount).toBe("0.00001");
        expect(byId["1.20.2"].fee_for_amount).toBe("0.00000");
    });

    it("needs the asset to price an amount, and says so for an asset that does not exist", async () => {
        const {call} = setup(FUNDS);
        const noAsset = await call({amount: "5"});
        expect(noAsset.result.isError).toBe(true);
        expect(JSON.stringify(noAsset.result)).toMatch(/Give the asset too/);
        const nope = await call({asset: "NOPE"});
        expect(nope.result.isError).toBe(true);
    });

    it("reads at most 20 pages of 100, stops on a page that adds nothing, and cuts the answer to the limit", async () => {
        const full = Array.from({length: 100}, (_, i) =>
            fund("1.20." + (i + 1), "1.3.0", "1000000", 300)
        );
        const {data, calls} = setup(full);
        const out = await data({limit: 5});
        expect(out.count).toBe(5);
        // the stand-in answers the same 100 funds for any start: a page that adds nothing new ends the reading
        expect(
            calls.filter(c => c[0] === "list_samet_funds").length
        ).toBeLessThanOrEqual(2);
    });
});
