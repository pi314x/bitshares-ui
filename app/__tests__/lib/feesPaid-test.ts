// What the page reads of an account's fees: the exact total from its statistics, then the recent
// operations, priced in the core asset, with the time they span. A history that cannot be read leaves the
// total standing.
const mockDb = jest.fn();
const mockHistory = jest.fn();
jest.mock("bitsharesjs-ws", () => ({
    Apis: {
        instance: () => ({
            db_api: () => ({exec: mockDb}),
            history_api: () => ({exec: mockHistory})
        })
    }
}));

import {loadOwnFees} from "../../lib/chain/feesPaid";

const ME = "1.2.10";
const op = (id: string, block: number, type: number, data: any) => ({
    id,
    block_num: block,
    op: [type, data]
});
const swap = (fee: any) => ({account: ME, fee});

const answers = (over: Record<string, any> = {}) =>
    mockDb.mockImplementation(async (method: string, params: any[]) => {
        if (over[method] instanceof Error) throw over[method];
        if (method in over) return over[method];
        switch (method) {
            case "get_account_by_name":
                return {id: ME, statistics: "2.6.10"};
            case "get_objects":
                return [
                    {
                        lifetime_fees_paid: "2827762603",
                        pending_fees: 150,
                        pending_vested_fees: 50,
                        total_ops: 226457
                    }
                ];
            case "get_assets":
                return params[0].map((id: string) => ({
                    id,
                    options: {
                        core_exchange_rate: {
                            base: {amount: 1, asset_id: id},
                            quote: {amount: 4, asset_id: "1.3.0"}
                        }
                    }
                }));
            case "get_block_header":
                return {
                    timestamp:
                        params[0] === 200
                            ? "2026-10-27T18:50:27"
                            : "2026-10-25T18:50:27"
                };
        }
        return null;
    });

beforeEach(() => {
    mockDb.mockReset();
    mockHistory.mockReset();
    answers();
    mockHistory.mockResolvedValue([
        op("1.11.9", 200, 63, swap({amount: 100000, asset_id: "1.3.0"})),
        op("1.11.8", 150, 1, {
            seller: ME,
            fee: {amount: 1000, asset_id: "1.3.7"}
        }),
        op("1.11.7", 100, 4, {
            account_id: ME,
            fee: {amount: 0, asset_id: "1.3.7"}
        })
    ]);
});

describe("loadOwnFees", () => {
    it("takes the exact total from the account's statistics, with what is pending", async () => {
        const info = await loadOwnFees("me");
        expect(info.accountId).toBe(ME);
        // 2,827,762,603 counted + 150 + 50 pending
        expect(info.lifetimeFees).toBe(BigInt("2827762803"));
        expect(info.totalOps).toBe(226457);
        expect(mockDb).toHaveBeenCalledWith("get_account_by_name", ["me"]);
        expect(mockDb).toHaveBeenCalledWith("get_objects", [["2.6.10"]]);
    });

    it("prices the recent fees in the core asset, and says the days they span", async () => {
        const info = await loadOwnFees("me");
        const recent = info.recent!;
        // 100000 in the core asset + 1000 of an asset worth 4 core each
        expect(recent.fees.coreUnits).toBe(BigInt(104000));
        expect(recent.fees.ops).toBe(2);
        expect(recent.entries).toBe(3);
        expect(recent.days).toBeCloseTo(2, 5);
        expect(mockDb).toHaveBeenCalledWith("get_assets", [["1.3.7"]]);
        // the blocks of the oldest and the newest operation
        expect(mockDb).toHaveBeenCalledWith("get_block_header", [100]);
        expect(mockDb).toHaveBeenCalledWith("get_block_header", [200]);
    });

    it("asks for the next page while there are full pages, and stops at one that brings nothing new", async () => {
        const full = (from: number) =>
            Array.from({length: 100}, (_, i) =>
                op(
                    `1.11.${from - i}`,
                    1000 - i,
                    63,
                    swap({amount: 10, asset_id: "1.3.0"})
                )
            );
        mockHistory
            .mockResolvedValueOnce(full(500))
            // the start is part of the next answer
            .mockResolvedValueOnce([...full(401)])
            .mockResolvedValue(full(401));
        const info = await loadOwnFees("me");
        // the second page repeated its first row (401) and 99 new ones
        expect(info.recent!.entries).toBe(199);
        expect(mockHistory.mock.calls[1][1][3]).toBe("1.11.401");
        expect(mockHistory.mock.calls.length).toBeLessThanOrEqual(3);
    });

    it("keeps the total when the history cannot be read, and has no days when the blocks cannot", async () => {
        mockHistory.mockRejectedValue(new Error("history blocked"));
        const broken = await loadOwnFees("me");
        expect(broken.recent).toBeNull();
        expect(broken.lifetimeFees).toBe(BigInt("2827762803"));

        mockHistory.mockResolvedValue([
            op("1.11.9", 200, 63, swap({amount: 100000, asset_id: "1.3.0"}))
        ]);
        answers({get_block_header: new Error("pruned")});
        const noTime = await loadOwnFees("me");
        expect(noTime.recent!.days).toBe(0);
        expect(noTime.recent!.fees.coreUnits).toBe(BigInt(100000));
    });

    it("fails, as the page says, when the account or its statistics cannot be read", async () => {
        answers({get_account_by_name: null});
        await expect(loadOwnFees("nobody")).rejects.toThrow(/no account/);
        answers({get_objects: []});
        await expect(loadOwnFees("me")).rejects.toThrow(/statistics/);
        answers({get_account_by_name: new Error("offline")});
        await expect(loadOwnFees("me")).rejects.toThrow("offline");
    });
});
