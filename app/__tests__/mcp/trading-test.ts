/** @jest-environment node */
import crypto from "crypto";
import {readConfig} from "../../../mcp/src/env";
import {createContext} from "../../../mcp/src/tools";
import {createProtocol} from "../../../mcp/src/protocol";
import {
    decodeProposal,
    encodeProposal,
    fingerprint,
    verifyReference,
    isCurrent,
    summarize,
    strictOperation,
    fromBase64Url
} from "../../../mcp/src/proposal";
import {createChain, CHAIN_ID} from "../utils/fakeChain";
import {createLedger} from "../../../mcp/src/policy";
import {fileStore} from "../../../mcp/src/store";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const sha256Hex = (text: string) =>
    crypto
        .createHash("sha256")
        .update(text)
        .digest("hex");

const NOW = Date.parse("2026-10-20T21:31:15Z");

const SETTINGS = {
    MCP_ENABLED: "true",
    MCP_TRADING_ENABLED: "true",
    MCP_TRADING_ACCOUNTS: "alice",
    MCP_TRADE_LIMITS: "BTS:1000:1500,USD:100",
    MCP_APP_URL: "https://desk.example"
};

function setup(extra?: Record<string, string>, ledger?: any) {
    const chain = createChain();
    const clock = {now: NOW};
    const config = readConfig({...SETTINGS, ...(extra || {})});
    const context = createContext({
        rpc: chain.rpc,
        config,
        ledger,
        now: () => clock.now,
        randomHex: (n: number) => "ab".repeat(n),
        sha256Hex
    });
    const protocol = createProtocol({config, context});
    const call = async (name: string, args: any) => {
        const reply: any = await protocol.handle({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {name, arguments: args}
        });
        return reply;
    };
    const order = (over?: any) =>
        call("bitshares_prepare_limit_order", {
            account: "alice",
            sell_asset: "BTS",
            sell_amount: "100",
            receive_asset: "USD",
            receive_amount: "0.1205",
            ...(over || {})
        });
    const refusal = async (reply: any, pattern: RegExp) => {
        expect(reply.result.isError).toBe(true);
        expect(reply.result.content[0].text).toMatch(pattern);
    };
    return {chain, clock, config, call, order, refusal};
}

describe("preparing a limit order", () => {
    it("makes a summary, a reference and a link, and says nothing is signed or sent", async () => {
        const {order} = setup();
        const reply = await order();
        expect(reply.result.isError).toBe(false);
        const out = reply.result.structuredContent;
        expect(out).toMatchObject({
            status: "prepared",
            signed: false,
            sent: false,
            account: "alice"
        });
        expect(out.summary).toBe(
            "Sell 100.00000 BTS for at least 0.1205 USD (829.87552 BTS per USD), open until 2026-10-21 21:31:15 UTC"
        );
        expect(out.reference).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
        expect(out.proposal_expires_at).toBe("2026-10-20 21:41:15 UTC");
        expect(out.next_step).toMatch(/Nothing has been placed/);
        expect(out.checks.price_unit).toBe("BTS per 1 USD");
        expect(out.checks.price_vs_market_percent).toBeLessThan(0);
        expect(out.checks.free_balance).toBe("200.00000 BTS");
        expect(
            out.review_url.indexOf("https://desk.example/mcp/review#p=")
        ).toBe(0);
    });

    it("builds the operation the chain reads: ids, units, the fee left for the wallet, no extensions", async () => {
        const {order} = setup();
        const out = (await order({fill_or_kill: true, expires_in_hours: 2}))
            .result.structuredContent;
        const proposal = decodeProposal(out.review_url.split("#p=")[1]);
        expect(proposal.ok).toBe(true);
        const p = (proposal as any).proposal;
        expect(p.chain).toBe(CHAIN_ID);
        expect(p.account).toEqual({id: "1.2.100", name: "alice"});
        expect(p.ops).toEqual([
            [
                1,
                {
                    fee: {amount: "0", asset_id: "1.3.0"},
                    seller: "1.2.100",
                    amount_to_sell: {amount: "10000000", asset_id: "1.3.0"},
                    min_to_receive: {amount: "1205", asset_id: "1.3.121"},
                    expiration: "2026-10-20T23:31:15",
                    fill_or_kill: true,
                    extensions: []
                }
            ]
        ]);
        expect(p.created).toBe("2026-10-20T21:31:15Z");
        expect(p.expires).toBe("2026-10-20T21:41:15Z");
        // the reference is the one the operations give; a tampered copy does not keep it
        expect(verifyReference(p, sha256Hex)).toBe(true);
        expect(out.reference).toBe(p.ref);
        const tampered = JSON.parse(JSON.stringify(p));
        tampered.ops[0][1].min_to_receive.amount = "1";
        expect(verifyReference(tampered, sha256Hex)).toBe(false);
        expect(fingerprint(tampered, sha256Hex)).not.toBe(p.ref);
        expect(isCurrent(p, NOW + 5 * 60000)).toBe(true);
        expect(isCurrent(p, NOW + 11 * 60000)).toBe(false);
        expect(isCurrent(p, NOW - 10 * 60000)).toBe(false);
    });

    it("uses a hash-router link when asked", async () => {
        const {order} = setup({MCP_APP_HASH_ROUTER: "true"});
        const out = (await order()).result.structuredContent;
        expect(
            out.review_url.indexOf("https://desk.example/#/mcp/review?p=")
        ).toBe(0);
    });

    it("does not exist when trading is off, and refuses when it was turned off", async () => {
        const off = setup({MCP_TRADING_ENABLED: "false"});
        expect((await off.order()).error.code).toBe(-32602);
    });

    it("refuses an account the person did not allow", async () => {
        const {order, refusal} = setup({MCP_TRADING_ACCOUNTS: "carol"});
        await refusal(
            await order(),
            /not one of the accounts the person allowed/
        );
    });

    it("refuses an asset that is not on the list, selling or buying", async () => {
        const {order, refusal} = setup({MCP_TRADE_LIMITS: "BTS:1000"});
        await refusal(
            await order(),
            /USD is not one of the assets the person allowed/
        );
        const second = setup({MCP_TRADE_LIMITS: "USD:100"});
        await refusal(await second.order(), /BTS is not one of the assets/);
        // an asset nobody listed, by symbol and by id
        const third = setup();
        await refusal(
            await third.order({
                receive_asset: "XBTSX.USDT",
                receive_amount: "0.12"
            }),
            /XBTSX.USDT is not one of the assets/
        );
    });

    it("keeps the limit of one order and of a day", async () => {
        const {order, refusal, clock} = setup({
            MCP_TRADE_LIMITS: "BTS:150:180,USD:100"
        });
        await refusal(
            await order({sell_amount: "151", receive_amount: "0.1820"}),
            /above the limit of 150 BTS for one order/
        );
        expect(
            (await order({sell_amount: "100", receive_amount: "0.1205"})).result
                .isError
        ).toBe(false);
        await refusal(
            await order({sell_amount: "100", receive_amount: "0.1205"}),
            /would pass the limit of 180 BTS a day/
        );
        // the day is rolling: a day later it fits again
        clock.now += 24 * 3600 * 1000 + 1000;
        expect(
            (await order({sell_amount: "100", receive_amount: "0.1205"})).result
                .isError
        ).toBe(false);
    });

    it("refuses more than the account has free", async () => {
        const {order, refusal} = setup();
        await refusal(
            await order({sell_amount: "300", receive_amount: "0.3614"}),
            /has 200.00000 BTS free/
        );
    });

    it("refuses a price that pays too much over the market, which also catches a slipped decimal", async () => {
        const {order, refusal} = setup();
        // 100 BTS for 0.1 USD is 1000 BTS per USD, the market asks about 834
        await refusal(
            await order({receive_amount: "0.1"}),
            /pays 19\.9\d% more than the market asks/
        );
        // a factor of ten off
        await refusal(
            await order({receive_amount: "0.0121"}),
            /pays \d+\.\d+% more/
        );
        // a better price than the market's is no reason to refuse
        expect((await order({receive_amount: "0.13"})).result.isError).toBe(
            false
        );
    });

    it("refuses a market it has no price for, unless the person allowed that", async () => {
        const blank = {latest: "0", lowest_ask: "0", highest_bid: "0"};
        const a = setup();
        a.chain.state.ticker = blank;
        await a.refusal(await a.order(), /no market price/);
        const b = setup({MCP_ALLOW_UNPRICED_MARKETS: "true"});
        b.chain.state.ticker = blank;
        const out = (await b.order()).result.structuredContent;
        expect(out.checks.market_price).toBeNull();
    });

    it("uses the last price when one side of the book is empty", async () => {
        const {order, chain} = setup();
        chain.state.ticker = {
            latest: "830",
            lowest_ask: "0",
            highest_bid: "828"
        };
        expect((await order()).result.isError).toBe(false);
        chain.state.ticker = {latest: "0", lowest_ask: "0", highest_bid: "0"};
        expect((await order()).result.isError).toBe(true);
    });

    it("limits how long an order stays open and how many are prepared in an hour", async () => {
        const {order, refusal, clock} = setup({
            MCP_MAX_ORDER_EXPIRATION_HOURS: "12",
            MCP_PREPARE_PER_HOUR: "2"
        });
        await refusal(await order({expires_in_hours: 13}), /12 hours at most/);
        expect((await order()).result.isError).toBe(false);
        expect(
            (await order({sell_amount: "10", receive_amount: "0.012"})).result
                .isError
        ).toBe(false);
        await refusal(
            await order({sell_amount: "10", receive_amount: "0.012"}),
            /limit the person set \(2\)/
        );
        clock.now += 3600 * 1000 + 1;
        expect(
            (await order({sell_amount: "10", receive_amount: "0.012"})).result
                .isError
        ).toBe(false);
    });

    it("refuses an amount with too many decimals, and zero", async () => {
        const {order, refusal} = setup();
        await refusal(
            await order({receive_amount: "0.12051"}),
            /more than 4 decimals/
        );
        await refusal(await order({sell_amount: "0"}), /above zero/);
        await refusal(
            await order({sell_asset: "USD", receive_asset: "usd"}),
            /must differ/
        );
    });

    it("refuses arguments of the wrong form before anything happens", async () => {
        const {call, chain} = setup();
        const reply = await call("bitshares_prepare_limit_order", {
            account: "alice",
            sell_asset: "BTS",
            sell_amount: 100,
            receive_asset: "USD",
            receive_amount: "1e3"
        });
        expect(reply.error.code).toBe(-32602);
        expect(chain.state.calls).toEqual([]);
    });
});

describe("preparing the cancellation of an order", () => {
    it("makes the operation for an open order of the account", async () => {
        const {call} = setup();
        const reply = await call("bitshares_prepare_cancel_order", {
            account: "alice",
            order_id: "1.7.500"
        });
        expect(reply.result.isError).toBe(false);
        const out = reply.result.structuredContent;
        expect(out.summary).toBe("Cancel the open order 1.7.500");
        const p = (decodeProposal(out.review_url.split("#p=")[1]) as any)
            .proposal;
        expect(p.ops).toEqual([
            [
                2,
                {
                    fee: {amount: "0", asset_id: "1.3.0"},
                    fee_paying_account: "1.2.100",
                    order: "1.7.500",
                    extensions: []
                }
            ]
        ]);
    });

    it("refuses an order the account does not have", async () => {
        const {call} = setup();
        const reply = await call("bitshares_prepare_cancel_order", {
            account: "alice",
            order_id: "1.7.999"
        });
        expect(reply.result.isError).toBe(true);
        expect(reply.result.content[0].text).toMatch(/no open order 1.7.999/);
        const bad = await call("bitshares_prepare_cancel_order", {
            account: "alice",
            order_id: "1.7.5; x"
        });
        expect(bad.error.code).toBe(-32602);
    });
});

describe("the policy tool", () => {
    it("tells the model what it may ask for", async () => {
        const {call} = setup();
        const out = (await call("bitshares_trading_policy", {})).result
            .structuredContent;
        expect(out.accounts).toEqual(["alice"]);
        expect(out.assets).toEqual([
            {symbol: "BTS", max_per_order: "1000", max_per_24_hours: "1500"},
            {symbol: "USD", max_per_order: "100", max_per_24_hours: "100"}
        ]);
        expect(out).toMatchObject({
            max_price_deviation_percent: 3,
            proposal_valid_minutes: 10,
            signing: "only by the person, in their own wallet"
        });
    });
});

describe("the document in a link", () => {
    const base = () => ({
        v: 1,
        chain: CHAIN_ID,
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
        ref: "ABCD-1234"
    });
    const decode = (p: any) => decodeProposal(encodeProposal(p)) as any;

    it("is read back as it was written, in base64url", () => {
        const text = encodeProposal(base());
        expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(JSON.parse(fromBase64Url(text))).toEqual(base());
        expect(decode(base()).ok).toBe(true);
    });

    it("refuses what is not a document of this kind", () => {
        expect(decodeProposal("").error).toBe("empty");
        expect(decodeProposal("not base64!").error).toBe("not_encoded");
        expect(decodeProposal("a".repeat(9000)).error).toBe("too_large");
        expect(
            decodeProposal(
                Buffer.from("not json")
                    .toString("base64")
                    .replace(/=+$/, "")
            ).error
        ).toBe("not_json");
        const extra = {...base(), extra: 1};
        expect(decode(extra).error).toBe("fields");
        expect(decode({...base(), v: 2}).error).toBe("version");
        expect(decode({...base(), chain: "zz"}).error).toBe("chain");
        expect(decode({...base(), ops: []}).error).toBe("operations");
        expect(decode({...base(), created: "x"}).error).toBe("time");
        expect(decode({...base(), expires: "2026-10-20T21:31:15Z"}).error).toBe(
            "time"
        );
        expect(decode({...base(), expires: "2026-10-21T21:31:15Z"}).error).toBe(
            "time"
        );
        expect(decode({...base(), ref: "abcd"}).error).toBe("reference");
        expect(
            decode({...base(), account: {id: "1.2.101", name: "alice"}}).error
        ).toBe("account_mismatch");
    });

    it("takes only the two operations trading needs, with exactly their fields", () => {
        const withOp = (op: any) => decode({...base(), ops: [op]});
        const create = base().ops[0] as any;
        // a transfer is not carried, nor anything else
        expect(
            withOp([
                0,
                {
                    from: "1.2.100",
                    to: "1.2.5",
                    amount: {amount: "1", asset_id: "1.3.0"}
                }
            ]).error
        ).toBe("operation");
        expect(withOp([6, {}]).detail).toMatch(/cannot be carried/);
        // an extra field, a changed fee, an extension, an unknown asset id form
        const f = (over: any) => withOp([1, {...create[1], ...over}]).error;
        expect(f({memo: "x"})).toBe("operation");
        expect(f({fee: {amount: "5", asset_id: "1.3.0"}})).toBe("operation");
        expect(f({fee: {amount: "0", asset_id: "1.3.121"}})).toBe("operation");
        expect(f({extensions: [{}]})).toBe("operation");
        expect(f({amount_to_sell: {amount: "-1", asset_id: "1.3.0"}})).toBe(
            "operation"
        );
        expect(f({amount_to_sell: {amount: "0", asset_id: "1.3.0"}})).toBe(
            "operation"
        );
        expect(f({amount_to_sell: {amount: "1", asset_id: "BTS"}})).toBe(
            "operation"
        );
        expect(f({min_to_receive: {amount: "1205", asset_id: "1.3.0"}})).toBe(
            "operation"
        );
        expect(f({expiration: "tomorrow"})).toBe("operation");
        expect(f({fill_or_kill: "no"})).toBe("operation");
        expect(
            strictOperation([
                2,
                {
                    fee: {amount: "0", asset_id: "1.3.0"},
                    fee_paying_account: "1.2.100",
                    order: "1.7.500",
                    extensions: []
                }
            ])
        ).toBeNull();
        expect(
            strictOperation([
                2,
                {
                    fee: {amount: "0", asset_id: "1.3.0"},
                    fee_paying_account: "1.2.100",
                    order: "1.7.x",
                    extensions: []
                }
            ])
        ).not.toBeNull();
    });

    it("describes an operation from the operation itself", () => {
        const lookup = (id: string) =>
            (({
                "1.3.0": {symbol: "BTS", precision: 5},
                "1.3.121": {symbol: "USD", precision: 4}
            } as any)[id] || null);
        expect(summarize(base().ops[0] as any, lookup)).toBe(
            "Sell 100.00000 BTS for at least 0.1205 USD (829.87552 BTS per USD), open until 2026-10-21 21:31:15 UTC"
        );
        // an asset it does not know is named by its id, with whole units
        expect(summarize(base().ops[0] as any, () => null)).toContain(
            "Sell 10000000 1.3.0"
        );
    });
});

describe("the limits survive a restart", () => {
    const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "mcp-state-"));

    it("a new process counts what the last one prepared", async () => {
        const file = path.join(tmp(), "state.json");
        const limits = {MCP_TRADE_LIMITS: "BTS:150:180,USD:100"};
        const first = setup(limits, createLedger(fileStore(file)));
        expect((await first.order()).result.isError).toBe(false);
        // a client that starts the server again for its next session
        const second = setup(limits, createLedger(fileStore(file)));
        await second.refusal(
            await second.order(),
            /would pass the limit of 180 BTS a day/
        );
        // the file is private and holds amounts as text
        expect((fs.statSync(file).mode & 0o777).toString(8)).toBe("600");
        expect(
            JSON.parse(fs.readFileSync(file, "utf8")).sold.BTS[0].units
        ).toBe("10000000");
        // a day later it counts for nothing
        second.clock.now += 24 * 3600 * 1000 + 1000;
        expect((await second.order()).result.isError).toBe(false);
    });

    it("counts what another process added in the meantime", async () => {
        const file = path.join(tmp(), "state.json");
        const limits = {MCP_TRADE_LIMITS: "BTS:150:180,USD:100"};
        const a = setup(limits, createLedger(fileStore(file)));
        const b = setup(limits, createLedger(fileStore(file)));
        expect((await a.order()).result.isError).toBe(false);
        // b started before a prepared anything, and still sees it
        await b.refusal(await b.order(), /would pass the limit/);
    });

    it("refuses everything while the file cannot be read, rather than start from zero", async () => {
        const file = path.join(tmp(), "state.json");
        fs.writeFileSync(file, "{not json");
        expect(() => createLedger(fileStore(file))).toThrow(/is damaged/);
        const bad = path.join(tmp(), "bad.json");
        fs.writeFileSync(bad, JSON.stringify({prepared: [{t: "x"}]}));
        expect(() => createLedger(fileStore(bad))).toThrow(/is damaged/);
        // a file that is not there yet is an empty ledger
        expect(
            createLedger(fileStore(path.join(tmp(), "none.json"))).prepared
        ).toEqual([]);
    });
});
