// What an account paid in fees, read from its history: who pays an operation's fee, what a fee in another
// asset is worth in the core asset, what was trading.
import {
    FEE_PAYERS,
    FeeRate,
    coreValueOfFee,
    feePayer,
    ownFees
} from "../../lib/common/ownFees";
// the operations of the chain by id, as the MCP server lists them
// eslint-disable-next-line @typescript-eslint/no-var-requires
const OPERATION_NAMES: string[] = require("../../../mcp/src/opnames");

const ME = "1.2.10";
const fee = (amount: number, asset = "1.3.0") => ({amount, asset_id: asset});
const entry = (block: number, type: number, op: any) => ({
    block_num: block,
    op: [type, op] as [number, any]
});

describe("who pays an operation's fee", () => {
    it("has a row for every operation of the chain, under the chain's own name", () => {
        expect(FEE_PAYERS.length).toBe(OPERATION_NAMES.length);
        FEE_PAYERS.forEach(([id, name]) => {
            expect(OPERATION_NAMES[id]).toBe(name);
        });
    });

    it("names the sender of a transfer, the seller of an order, the account of a pool swap", () => {
        expect(feePayer(0, {from: ME, to: "1.2.99"})).toBe(ME);
        expect(feePayer(1, {seller: ME})).toBe(ME);
        expect(feePayer(2, {fee_paying_account: ME})).toBe(ME);
        expect(feePayer(63, {account: ME})).toBe(ME);
        expect(feePayer(17, {account: ME})).toBe(ME);
        expect(feePayer(67, {borrower: ME})).toBe(ME);
        // the issuer pays for an override transfer, not the account it takes from
        expect(feePayer(38, {issuer: "1.2.5", from: ME, to: "1.2.6"})).toBe(
            "1.2.5"
        );
    });

    it("names no one for the operations the chain makes itself: their fee is no network fee", () => {
        // a fill's fee is the market fee, paid to the asset's issuer
        [4, 42, 44, 46, 51, 53, 74].forEach(type => {
            expect(
                feePayer(type, {
                    account_id: ME,
                    account: ME,
                    to: ME,
                    bidder: ME
                })
            ).toBeNull();
        });
    });

    it("names no one for a blind transfer, an unknown operation or a missing field", () => {
        expect(feePayer(40, {})).toBeNull();
        expect(feePayer(41, {})).toBeNull();
        expect(feePayer(31, {})).toBeNull();
        expect(feePayer(999, {account: ME})).toBeNull();
        expect(feePayer(0, {})).toBeNull();
        expect(feePayer(0, null)).toBeNull();
    });
});

describe("what a fee in another asset is worth in the core asset", () => {
    // 1 unit of X is worth 4 units of core (the rate is X : core = 1 : 4), written either way round
    const rates = new Map<string, FeeRate>([
        [
            "1.3.7",
            {
                baseAssetId: "1.3.7",
                baseAmount: BigInt(1),
                quoteAssetId: "1.3.0",
                quoteAmount: BigInt(4)
            }
        ],
        [
            "1.3.8",
            {
                baseAssetId: "1.3.0",
                baseAmount: BigInt(4),
                quoteAssetId: "1.3.8",
                quoteAmount: BigInt(1)
            }
        ],
        [
            "1.3.9",
            {
                baseAssetId: "1.3.4",
                baseAmount: BigInt(1),
                quoteAssetId: "1.3.5",
                quoteAmount: BigInt(1)
            }
        ]
    ]);

    it("is the fee itself in the core asset, and zero for nothing", () => {
        expect(coreValueOfFee(fee(48260), rates)).toBe(BigInt(48260));
        expect(coreValueOfFee(fee(0, "1.3.77"), rates)).toBe(BigInt(0));
    });

    it("converts by the asset's rate, whichever way round it is written, rounding down", () => {
        expect(coreValueOfFee(fee(1000, "1.3.7"), rates)).toBe(BigInt(4000));
        expect(coreValueOfFee(fee(1000, "1.3.8"), rates)).toBe(BigInt(4000));
        const third = new Map<string, FeeRate>([
            [
                "1.3.7",
                {
                    baseAssetId: "1.3.7",
                    baseAmount: BigInt(3),
                    quoteAssetId: "1.3.0",
                    quoteAmount: BigInt(10)
                }
            ]
        ]);
        expect(coreValueOfFee(fee(10, "1.3.7"), third)).toBe(BigInt(33));
    });

    it("says it does not know a fee whose asset has no rate to the core asset", () => {
        expect(coreValueOfFee(fee(5, "1.3.55"), rates)).toBeNull();
        expect(coreValueOfFee(fee(5, "1.3.9"), rates)).toBeNull();
    });
});

describe("the fees an account paid", () => {
    const rates = new Map<string, FeeRate>([
        [
            "1.3.7",
            {
                baseAssetId: "1.3.7",
                baseAmount: BigInt(1),
                quoteAssetId: "1.3.0",
                quoteAmount: BigInt(4)
            }
        ]
    ]);

    it("counts what the account paid, in the core asset and in another, and what was trading", () => {
        const entries = [
            entry(300, 63, {account: ME, fee: fee(100000)}),
            entry(290, 1, {seller: ME, fee: fee(1000, "1.3.7")}),
            entry(280, 0, {from: ME, to: "1.2.2", fee: fee(50000)}),
            // paid by the sender, not by this account
            entry(270, 0, {from: "1.2.2", to: ME, fee: fee(50000)}),
            // a fill is made by the chain, and its fee is a market fee (not a network fee): not counted
            entry(260, 4, {account_id: ME, fee: fee(7777)}),
            entry(250, 2, {fee_paying_account: ME, fee: fee(500)})
        ];
        const out = ownFees(ME, entries, rates);
        // 100000 + 4000 (1000 of X) + 50000 + 500
        expect(out.coreUnits).toBe(BigInt(154500));
        // the swap, the order and the cancel; not the transfer
        expect(out.trading).toBe(BigInt(104500));
        expect(out.ops).toBe(4);
        expect(out.unpriced).toBe(0);
        expect([out.firstBlock, out.lastBlock]).toEqual([250, 300]);
    });

    it("leaves out a fee it cannot price, and says how many", () => {
        const out = ownFees(
            ME,
            [
                entry(10, 63, {account: ME, fee: fee(7, "1.3.55")}),
                entry(11, 63, {account: ME, fee: fee(100)})
            ],
            rates
        );
        expect(out.coreUnits).toBe(BigInt(100));
        expect(out.unpriced).toBe(1);
        expect(out.ops).toBe(1);
    });

    it("has nothing, and no block range, for no history", () => {
        const out = ownFees(ME, [], rates);
        expect(out.coreUnits).toBe(BigInt(0));
        expect([out.ops, out.firstBlock, out.lastBlock]).toEqual([
            0,
            null,
            null
        ]);
    });
});
