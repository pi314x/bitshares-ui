import "../../lib/chain/extraOperations";
import {ops} from "bitsharesjs";
import {ChainConfig} from "bitsharesjs-ws";
import vectors from "../fixtures/coreOperationVectors.json";
import {
    PARAMETERS,
    applyParameterEdits,
    buildParameterProposal,
    parameterValue,
    validateParameters
} from "../../lib/common/chainParameters";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ByteBuffer: any = require("bytebuffer");
const operation = (ops as any).operation;
// the main network's parameters, as its node reported them
const LIVE = (vectors as any)["committee_member_update_global_parameters"].op[1]
    .new_parameters;

beforeAll(() => {
    (ChainConfig as any).setPrefix("BTS");
});

function hexOf(object: any): string {
    const bb = new ByteBuffer(
        ByteBuffer.DEFAULT_CAPACITY,
        ByteBuffer.LITTLE_ENDIAN
    );
    operation.appendByteBuffer(bb, operation.fromObject(object));
    bb.flip();
    return bb.toHex();
}

describe("PARAMETERS", () => {
    it("names parameters the chain has, each once", () => {
        const keys = PARAMETERS.map(d => `${d.parent}.${d.key}`);
        expect(new Set(keys).size).toBe(keys.length);
        PARAMETERS.filter(d => !d.parent).forEach(d =>
            expect(LIVE[d.key]).not.toBeUndefined()
        );
        expect(parameterValue(LIVE, PARAMETERS[0])).toBe("3");
    });

    it("reads the extension members, and nothing for one that is not set", () => {
        const def = (key: string) => PARAMETERS.find(d => d.key === key)!;
        expect(parameterValue(LIVE, def("maker_fee_discount_percent"))).toBe(
            "9600"
        );
        expect(parameterValue(LIVE, def("max_timeout_secs"))).toBe("2592000");
        expect(parameterValue(LIVE, def("market_fee_network_percent"))).toBe(
            ""
        );
        expect(
            parameterValue(LIVE, def("max_custom_authority_restrictions"))
        ).toBe("");
    });

    it("the live parameters pass the chain's own rules", () => {
        expect(validateParameters(LIVE)).toBeNull();
    });
});

describe("applyParameterEdits", () => {
    it("changes what is edited and leaves the rest as it was", () => {
        const result = applyParameterEdits(LIVE, {
            block_interval: "5",
            witness_pay_per_block: "20000"
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.op.changed).toEqual([
            "block_interval",
            "witness_pay_per_block"
        ]);
        expect(result.op.parameters.block_interval).toBe(5);
        expect(result.op.parameters.witness_pay_per_block).toBe("20000");
        expect(result.op.parameters.current_fees).toEqual(LIVE.current_fees);
        // the chain's object is not touched
        expect(LIVE.block_interval).toBe(3);
    });

    it("an edit equal to the present value is no change", () => {
        expect(applyParameterEdits(LIVE, {block_interval: "3"})).toMatchObject({
            ok: false,
            error: "nothing_changed"
        });
        expect(applyParameterEdits(LIVE, {})).toMatchObject({
            error: "nothing_changed"
        });
    });

    it("sets and removes the optional members", () => {
        const set = applyParameterEdits(LIVE, {
            market_fee_network_percent: "1500"
        });
        expect(
            set.ok && set.op.parameters.extensions.market_fee_network_percent
        ).toBe(1500);
        const removed = applyParameterEdits(LIVE, {
            maker_fee_discount_percent: ""
        });
        expect(removed.ok).toBe(true);
        if (removed.ok) {
            expect(
                "maker_fee_discount_percent" in removed.op.parameters.extensions
            ).toBe(false);
        }
        // a required one cannot be left empty
        expect(applyParameterEdits(LIVE, {block_interval: ""})).toMatchObject({
            ok: false,
            error: "parameter_invalid",
            detail: "block_interval"
        });
    });

    it("sets the options that come in a block only whole", () => {
        expect(
            applyParameterEdits(LIVE, {
                "custom_authority_options.max_custom_authority_restrictions":
                    "10"
            })
        ).toMatchObject({
            ok: false,
            detail: "custom_authority_options"
        });
        const whole = applyParameterEdits(LIVE, {
            "custom_authority_options.max_custom_authority_lifetime_seconds":
                "31536000",
            "custom_authority_options.max_custom_authorities_per_account": "10",
            "custom_authority_options.max_custom_authorities_per_account_op":
                "5",
            "custom_authority_options.max_custom_authority_restrictions": "10"
        });
        expect(whole.ok).toBe(true);
        // removing both htlc members drops the block
        const gone = applyParameterEdits(LIVE, {
            "updatable_htlc_options.max_timeout_secs": "",
            "updatable_htlc_options.max_preimage_size": ""
        });
        expect(
            gone.ok && "updatable_htlc_options" in gone.op.parameters.extensions
        ).toBe(false);
        expect(
            applyParameterEdits(LIVE, {
                "updatable_htlc_options.max_timeout_secs": ""
            })
        ).toMatchObject({ok: false, detail: "updatable_htlc_options"});
    });

    it("refuses numbers out of range and text that is not a number", () => {
        const refuse = (edits: any) =>
            expect(applyParameterEdits(LIVE, edits)).toMatchObject({
                ok: false,
                error: "parameter_invalid"
            });
        refuse({block_interval: "256"});
        refuse({block_interval: "-1"});
        refuse({block_interval: "1.5"});
        refuse({maximum_witness_count: "65536"});
        refuse({maximum_block_size: "4294967296"});
        refuse({witness_pay_per_block: "9223372036854775808"});
        refuse({count_non_member_votes: "maybe"});
        expect(
            applyParameterEdits(LIVE, {count_non_member_votes: "false"}).ok
        ).toBe(true);
    });

    it("applies the chain's validate(): block interval, maintenance, sizes, percentages", () => {
        const refuse = (edits: any, detail: string) =>
            expect(applyParameterEdits(LIVE, edits)).toMatchObject({
                ok: false,
                error: "parameter_invalid",
                detail
            });
        refuse({block_interval: "0"}, "block_interval");
        refuse({block_interval: "31"}, "block_interval");
        // 3600 is not a multiple of 7
        refuse({block_interval: "7"}, "maintenance_interval");
        refuse({maintenance_interval: "3"}, "maintenance_interval");
        refuse({maximum_transaction_size: "1023"}, "maximum_transaction_size");
        refuse({maximum_block_size: "5119"}, "maximum_block_size");
        refuse(
            {maximum_time_until_expiration: "3"},
            "maximum_time_until_expiration"
        );
        refuse(
            {committee_proposal_review_period: "2419200"},
            "maximum_proposal_lifetime"
        );
        refuse({reserve_percent_of_fee: "10001"}, "reserve_percent_of_fee");
        refuse({network_percent_of_fee: "7500"}, "network_percent_of_fee");
        refuse(
            {market_fee_network_percent: "3001"},
            "market_fee_network_percent"
        );
        refuse(
            {maker_fee_discount_percent: "10001"},
            "maker_fee_discount_percent"
        );
        expect(
            applyParameterEdits(LIVE, {market_fee_network_percent: "3000"}).ok
        ).toBe(true);
    });
});

describe("buildParameterProposal", () => {
    it("proposes the change, in a proposal the library serializes", () => {
        const built = buildParameterProposal({
            proposerId: "1.2.100",
            current: LIVE,
            edits: {block_interval: "5"}
        });
        expect(built.ok).toBe(true);
        if (!built.ok) return;
        expect(built.op.changed).toEqual(["block_interval"]);
        const proposal = {
            fee: {amount: 0, asset_id: "1.3.0"},
            expiration_time: "2030-01-01T00:00:00",
            review_period_seconds: 1209600,
            extensions: [],
            ...built.op.op
        };
        const hex = hexOf([22, proposal]);
        // the parameters inside are the ones the node serializes, but for the edit
        expect(hex.length).toBeGreaterThan(1500);
        expect(hex).toContain("31"); // the operation tag is in there
    });

    it("needs a proposer and a change", () => {
        expect(
            buildParameterProposal({
                proposerId: null,
                current: LIVE,
                edits: {block_interval: "5"}
            })
        ).toMatchObject({ok: false, error: "account_missing"});
        expect(
            buildParameterProposal({
                proposerId: "1.2.100",
                current: LIVE,
                edits: {}
            })
        ).toMatchObject({ok: false, error: "nothing_changed"});
    });
});
