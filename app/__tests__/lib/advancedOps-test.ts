import "../../lib/chain/extraOperations";
import {ops} from "bitsharesjs";
import {ChainConfig} from "bitsharesjs-ws";
import vectors from "../fixtures/coreOperationVectors.json";
import {
    buildAccountTransfer,
    buildAssert,
    buildBlindTransfer,
    buildCommitteeMemberUpdate,
    buildCustom,
    buildFlashLoan,
    buildOverrideTransfer,
    buildTransferFromBlind,
    buildTransferToBlind,
    flashFee,
    isValidAccountName,
    isValidAssetSymbol,
    lendable,
    overrideProblem,
    parseBlindInputs,
    parseBlindOutputs,
    textToHex
} from "../../lib/common/advancedOps";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ByteBuffer: any = require("bytebuffer");
const operation = (ops as any).operation;
const vector = (name: string) => (vectors as any)[name];

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

/** What the builder makes is what the chain reads: the node's bytes for the same data. */
function sameAsNode(id: number, op: any, name: string) {
    expect(hexOf([id, op])).toBe(vector(name).hex);
}

describe("buildAccountTransfer", () => {
    it("makes the operation the node serializes the same way", () => {
        const built = buildAccountTransfer({
            accountId: "1.2.5",
            newOwnerId: "1.2.6"
        });
        expect(built.ok).toBe(true);
        if (built.ok) sameAsNode(9, built.op, "account_transfer");
    });

    it("needs two accounts that differ", () => {
        expect(
            buildAccountTransfer({accountId: null, newOwnerId: "1.2.6"})
        ).toMatchObject({ok: false, error: "account_missing"});
        expect(
            buildAccountTransfer({accountId: "1.2.5", newOwnerId: "1.2.5"})
        ).toMatchObject({ok: false, error: "same_account"});
    });
});

describe("buildCommitteeMemberUpdate", () => {
    const base = {
        memberId: "1.5.3",
        accountId: "1.2.5",
        currentUrl: "https://old.example"
    };

    it("sends the new url", () => {
        const built = buildCommitteeMemberUpdate({
            ...base,
            newUrl: "  https://example.org/committee "
        });
        expect(built.ok).toBe(true);
        if (built.ok) {
            sameAsNode(30, built.op, "committee_member_update url");
        }
    });

    it("refuses a url that is too long, one that is the same, a wrong member", () => {
        expect(
            buildCommitteeMemberUpdate({...base, newUrl: "x".repeat(127)})
        ).toMatchObject({ok: false, error: "url_too_long"});
        expect(
            buildCommitteeMemberUpdate({...base, newUrl: "x".repeat(126)}).ok
        ).toBe(true);
        expect(
            buildCommitteeMemberUpdate({...base, newUrl: base.currentUrl})
        ).toMatchObject({ok: false, error: "unchanged"});
        expect(
            buildCommitteeMemberUpdate({
                ...base,
                memberId: "1.6.3",
                newUrl: "a"
            })
        ).toMatchObject({ok: false, error: "member_invalid"});
    });
});

describe("buildCustom", () => {
    it("makes the operation the node serializes the same way", () => {
        const built = buildCustom({
            payerId: "1.2.5",
            requiredAuthIds: ["1.2.6", "1.2.7"],
            id: "7",
            dataMode: "hex",
            data: "DEADBEEF00ff"
        });
        expect(built.ok).toBe(true);
        if (built.ok) sameAsNode(35, built.op, "custom");
    });

    it("turns text into its UTF-8 bytes", () => {
        expect(textToHex("hi")).toBe("6869");
        expect(textToHex("é€")).toBe("c3a9e282ac");
        const built = buildCustom({
            payerId: "1.2.5",
            requiredAuthIds: [],
            id: "0",
            dataMode: "text",
            data: "é"
        });
        expect(built.ok && built.op.data).toBe("c3a9");
    });

    it("refuses an id out of range, data that is not hex, data that is too big", () => {
        const base = {
            payerId: "1.2.5",
            requiredAuthIds: [],
            dataMode: "hex" as const,
            data: "00"
        };
        expect(buildCustom({...base, id: "65536"})).toMatchObject({
            error: "id_invalid"
        });
        expect(buildCustom({...base, id: "-1"})).toMatchObject({
            error: "id_invalid"
        });
        expect(buildCustom({...base, id: "1", data: "abc"})).toMatchObject({
            error: "data_invalid"
        });
        expect(
            buildCustom({...base, id: "1", data: "00".repeat(11), maxBytes: 10})
        ).toMatchObject({error: "data_too_large"});
        expect(buildCustom({...base, id: "1", payerId: null})).toMatchObject({
            error: "account_missing"
        });
    });

    it("lists each required account once", () => {
        const built = buildCustom({
            payerId: "1.2.5",
            requiredAuthIds: ["1.2.6", "1.2.6"],
            id: "1",
            dataMode: "text",
            data: ""
        });
        expect(built.ok && built.op.required_auths).toEqual(["1.2.6"]);
    });
});

describe("names and symbols", () => {
    it("follow the chain's rules", () => {
        ["a", "abc", "a-b", "a1", "abc.def", "a.b-c"].forEach(name =>
            expect(isValidAccountName(name)).toBe(true)
        );
        [
            "",
            "1a",
            "-a",
            "a-",
            "A",
            "a..b",
            ".a",
            "a b",
            "a".repeat(64)
        ].forEach(name => expect(isValidAccountName(name)).toBe(false));
        ["BTS", "XBTSX.USDT", "A1B", "ABC.DEF.GHI"].forEach(symbol =>
            expect(isValidAssetSymbol(symbol)).toBe(true)
        );
        ["AB", "bts", "1BC", "ABC.", "A".repeat(17), "ABC..D"].forEach(symbol =>
            expect(isValidAssetSymbol(symbol)).toBe(false)
        );
    });
});

describe("buildAssert", () => {
    it("makes the operation the node serializes the same way", () => {
        const built = buildAssert({
            payerId: "1.2.5",
            predicates: [
                {
                    type: "account_name",
                    accountId: "1.2.5",
                    name: "committee-account"
                }
            ],
            requiredAuthIds: ["1.2.5"],
            maxOpcode: 3
        });
        expect(built.ok).toBe(true);
        if (built.ok) sameAsNode(36, built.op, "assert name");
    });

    it("builds all three predicates", () => {
        const built = buildAssert({
            payerId: "1.2.5",
            predicates: [
                {type: "account_name", accountId: "1.2.5", name: "abc"},
                {type: "asset_symbol", assetId: "1.3.0", symbol: "BTS"},
                {type: "block_id", id: "AB".repeat(20)}
            ],
            requiredAuthIds: [],
            maxOpcode: 3
        });
        expect(built.ok).toBe(true);
        if (built.ok) sameAsNode(36, built.op, "assert all");
    });

    it("offers only the predicates the chain allows (max_predicate_opcode)", () => {
        // the live chain has 1: only the account name test
        const attempt = (type: any, extra: any) =>
            buildAssert({
                payerId: "1.2.5",
                predicates: [{type, ...extra}],
                requiredAuthIds: [],
                maxOpcode: 1
            });
        expect(
            attempt("account_name", {accountId: "1.2.5", name: "abc"}).ok
        ).toBe(true);
        expect(
            attempt("asset_symbol", {assetId: "1.3.0", symbol: "BTS"})
        ).toMatchObject({ok: false, error: "predicate_not_allowed"});
        expect(attempt("block_id", {id: "00".repeat(20)})).toMatchObject({
            ok: false,
            error: "predicate_not_allowed"
        });
    });

    it("refuses nothing to assert, bad names, symbols and block ids", () => {
        const make = (predicates: any[]) =>
            buildAssert({
                payerId: "1.2.5",
                predicates,
                requiredAuthIds: [],
                maxOpcode: 3
            });
        expect(make([])).toMatchObject({error: "no_predicates"});
        expect(
            make([{type: "account_name", accountId: "1.2.5", name: "Bad Name"}])
        ).toMatchObject({error: "name_invalid"});
        expect(
            make([{type: "asset_symbol", assetId: "1.3.0", symbol: "bts"}])
        ).toMatchObject({error: "symbol_invalid"});
        expect(make([{type: "block_id", id: "abcd"}])).toMatchObject({
            error: "block_id_invalid"
        });
    });
});

describe("override_transfer", () => {
    const args = {
        issuerId: "1.2.5",
        fromId: "1.2.6",
        toId: "1.2.7",
        assetId: "1.3.121",
        precision: 3,
        amount: "1"
    };

    it("makes the operation the node serializes the same way", () => {
        const built = buildOverrideTransfer(args);
        expect(built.ok).toBe(true);
        if (built.ok) sameAsNode(38, built.op, "override_transfer");
    });

    it("applies validate(): different accounts, the issuer does not take from itself, a positive amount", () => {
        expect(buildOverrideTransfer({...args, toId: "1.2.6"})).toMatchObject({
            error: "from_is_to"
        });
        expect(
            buildOverrideTransfer({...args, fromId: "1.2.5"})
        ).toMatchObject({error: "issuer_is_from"});
        expect(buildOverrideTransfer({...args, amount: "0"})).toMatchObject({
            error: "amount_invalid"
        });
        expect(
            buildOverrideTransfer({...args, amount: "1.2345"})
        ).toMatchObject({
            error: "amount_invalid"
        });
        expect(buildOverrideTransfer({...args, amount: "x"})).toMatchObject({
            error: "amount_invalid"
        });
    });

    it("knows when an asset lets its issuer override", () => {
        const asset = (issuer: string, flags: number) => ({
            issuer,
            options: {flags}
        });
        expect(overrideProblem(asset("1.2.5", 0x04), "1.2.5")).toBeNull();
        expect(
            overrideProblem(asset("1.2.5", 0x04 | 0x40), "1.2.5")
        ).toBeNull();
        expect(overrideProblem(asset("1.2.5", 0x08), "1.2.5")).toBe(
            "not_permitted"
        );
        expect(overrideProblem(asset("1.2.9", 0x04), "1.2.5")).toBe(
            "not_issuer"
        );
        expect(overrideProblem(null, "1.2.5")).toBe("asset_missing");
    });
});

describe("blind transfers", () => {
    const sample = vector("transfer_to_blind").op[1];
    const outputsText = JSON.stringify(sample.outputs.slice(0, 1));

    it("takes the pieces another tool made and builds the three operations", () => {
        const to = buildTransferToBlind({
            fromId: "1.2.5",
            assetId: "1.3.0",
            precision: 5,
            amount: "0.01",
            blindingFactor: sample.blinding_factor,
            outputs: JSON.stringify(sample.outputs.slice(0, 1))
        });
        expect(to.ok).toBe(true);
        if (to.ok) {
            // serializes: the library accepts every field
            expect(() => hexOf([39, to.op])).not.toThrow();
            expect(to.op.amount).toEqual({amount: "1000", asset_id: "1.3.0"});
        }
        const between = buildBlindTransfer({
            assetId: "1.3.0",
            inputs: JSON.stringify(vector("blind_transfer").op[1].inputs),
            outputs: JSON.stringify(vector("blind_transfer").op[1].outputs)
        });
        expect(between.ok).toBe(true);
        if (between.ok) sameAsNode(40, between.op, "blind_transfer");
        const from = buildTransferFromBlind({
            toId: "1.2.5",
            assetId: "1.3.0",
            precision: 5,
            amount: "0.00005",
            blindingFactor: sample.blinding_factor,
            inputs: JSON.stringify(vector("transfer_from_blind").op[1].inputs)
        });
        expect(from.ok).toBe(true);
        if (from.ok) sameAsNode(41, from.op, "transfer_from_blind");
    });

    it("refuses a blinding factor or a commitment of the wrong length", () => {
        expect(
            buildTransferToBlind({
                fromId: "1.2.5",
                assetId: "1.3.0",
                precision: 5,
                amount: "1",
                blindingFactor: "00",
                outputs: outputsText
            })
        ).toMatchObject({error: "hex_invalid", detail: "blinding_factor"});
        const short = JSON.parse(outputsText);
        short[0].commitment = "02" + "22".repeat(31);
        expect(parseBlindOutputs(JSON.stringify(short))).toMatchObject({
            error: "hex_invalid",
            detail: "commitment"
        });
    });

    it("refuses what is not JSON, empty lists, a missing range proof and a missing owner", () => {
        expect(parseBlindOutputs("nope")).toMatchObject({
            error: "json_invalid"
        });
        expect(parseBlindOutputs("{}")).toMatchObject({error: "json_invalid"});
        expect(parseBlindOutputs("[]")).toMatchObject({
            error: "outputs_missing"
        });
        expect(parseBlindInputs("[]")).toMatchObject({error: "inputs_missing"});
        const output = JSON.parse(outputsText)[0];
        expect(
            parseBlindOutputs(JSON.stringify([{...output, range_proof: ""}]))
        ).toMatchObject({error: "hex_invalid", detail: "range_proof"});
        expect(
            parseBlindOutputs(JSON.stringify([{...output, owner: undefined}]))
        ).toMatchObject({error: "authority_invalid"});
    });

    it("needs commitments in ascending order and without repeats, as the chain does", () => {
        const output = JSON.parse(outputsText)[0];
        const low = {...output, commitment: "02" + "11".repeat(32)};
        const high = {...output, commitment: "02" + "33".repeat(32)};
        expect(parseBlindOutputs(JSON.stringify([low, high])).ok).toBe(true);
        expect(parseBlindOutputs(JSON.stringify([high, low]))).toMatchObject({
            error: "unsorted"
        });
        expect(parseBlindOutputs(JSON.stringify([low, low]))).toMatchObject({
            error: "unsorted"
        });
    });

    it("refuses an authority nobody can satisfy", () => {
        const output = JSON.parse(outputsText)[0];
        output.owner = {
            weight_threshold: 5,
            account_auths: [],
            key_auths: [[output.owner.key_auths[0][0], 1]],
            address_auths: []
        };
        expect(parseBlindOutputs(JSON.stringify([output]))).toMatchObject({
            error: "authority_invalid"
        });
    });

    it("pays the fee of transfer_from_blind in the asset sent", () => {
        const from = buildTransferFromBlind({
            toId: "1.2.5",
            assetId: "1.3.121",
            precision: 4,
            amount: "1",
            blindingFactor: sample.blinding_factor,
            inputs: JSON.stringify(vector("transfer_from_blind").op[1].inputs)
        });
        expect(from.ok && from.op.fee.asset_id).toBe("1.3.121");
    });
});

describe("flash loans", () => {
    const fund = {
        id: "1.20.2",
        asset_type: "1.3.0",
        balance: "1000000",
        unpaid_amount: "200000",
        fee_rate: 300
    };

    it("asks the fee the chain asks: rounded up, in 1/1,000,000", () => {
        expect(flashFee("1000000", 300)).toBe("300");
        expect(flashFee("1000", 300)).toBe("1"); // 0.3 up
        expect(flashFee("3334", 300)).toBe("2"); // 1.0002 up
        expect(flashFee("1000", 0)).toBe("0");
        // beyond what a float holds exactly
        expect(flashFee("9007199254740993000", 1)).toBe("9007199254741");
    });

    it("lends what is not already out", () => {
        expect(lendable(fund)).toBe(BigInt(800000));
    });

    it("makes the pair the node serializes the same way", () => {
        const built = buildFlashLoan({
            borrowerId: "1.2.5",
            fund: {...fund, balance: "10000", unpaid_amount: "0"},
            precision: 5,
            amount: "0.01"
        });
        expect(built.ok).toBe(true);
        if (built.ok) {
            // 1000 units borrowed at 300/1e6 -> fee 1; the vector holds 1000 and fee 2
            expect(built.op.fee).toBe("1");
            expect(hexOf([67, built.op.borrow])).toBe(
                vector("samet_fund_borrow").hex
            );
            expect(() => hexOf([68, built.op.repay])).not.toThrow();
            expect(built.op.repay.fund_fee).toEqual({
                amount: "1",
                asset_id: "1.3.0"
            });
        }
    });

    it("refuses more than the fund holds, a bad fund, a bad amount", () => {
        const base = {borrowerId: "1.2.5", fund, precision: 5};
        expect(buildFlashLoan({...base, amount: "8.00001"})).toMatchObject({
            error: "too_much"
        });
        expect(buildFlashLoan({...base, amount: "8"}).ok).toBe(true);
        expect(buildFlashLoan({...base, amount: "0"})).toMatchObject({
            error: "amount_invalid"
        });
        expect(
            buildFlashLoan({...base, fund: null, amount: "1"})
        ).toMatchObject({error: "fund_invalid"});
        expect(
            buildFlashLoan({
                ...base,
                fund: {...fund, id: "1.21.2"},
                amount: "1"
            })
        ).toMatchObject({error: "fund_invalid"});
        expect(
            buildFlashLoan({...base, borrowerId: null, amount: "1"})
        ).toMatchObject({error: "account_missing"});
    });
});
