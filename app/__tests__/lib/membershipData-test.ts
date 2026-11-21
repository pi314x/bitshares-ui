// What the Lifetime membership page reads from the node: the fee schedule (as the node answers it), the
// account's membership and the core asset the fees are in.
const mockExec = jest.fn();
jest.mock("bitsharesjs-ws", () => ({
    Apis: {instance: () => ({db_api: () => ({exec: mockExec})})}
}));

import {loadMembership} from "../../lib/chain/membershipData";

// as the node answers: the live figures of the chain's fee schedule
const properties = {
    parameters: {
        network_percent_of_fee: 2000,
        cashback_vesting_period_seconds: 7776000,
        cashback_vesting_threshold: 10000000,
        current_fees: {
            scale: 10000,
            parameters: [
                [1, {fee: 48260}],
                [
                    8,
                    {
                        membership_annual_fee: 579131307,
                        membership_lifetime_fee: 579131307
                    }
                ],
                [63, {fee: 100000}]
            ]
        }
    }
};
const answers = (account: any, assets: any = [{symbol: "BTS", precision: 5}]) =>
    mockExec.mockImplementation(async (method: string) => {
        if (method === "get_global_properties") return properties;
        if (method === "get_assets") return assets;
        return account;
    });

beforeEach(() => mockExec.mockReset());

describe("loadMembership", () => {
    it("reads what a Lifetime membership costs and gives back, and the account's own status", async () => {
        answers([{membership_expiration_date: "1970-01-01T00:00:00"}]);
        const info = await loadMembership("me");
        expect(info.lifetimeFee).toBe(BigInt("579131307"));
        expect(info.networkBp).toBe(2000);
        expect(info.exchangeFee).toBe(BigInt(100000));
        expect(info.orderFee).toBe(BigInt(48260));
        expect(info.vestingThreshold).toBe(BigInt(10000000));
        expect(info.vestingDays).toBe(90);
        expect(info.status).toBe("basic");
        expect(mockExec).toHaveBeenCalledWith("get_accounts", [["me"]]);
    });

    it("takes the symbol and precision of the core asset from the chain", async () => {
        answers([{}], [{symbol: "TEST", precision: 4}]);
        expect((await loadMembership("me")).core).toEqual({
            symbol: "TEST",
            precision: 4
        });
        expect(mockExec).toHaveBeenCalledWith("get_assets", [["1.3.0"]]);
    });

    it("keeps BTS with 5 decimals when the asset cannot be read", async () => {
        mockExec.mockImplementation(async (method: string) => {
            if (method === "get_global_properties") return properties;
            if (method === "get_assets") throw new Error("offline");
            return [{membership_expiration_date: "1970-01-01T00:00:00"}];
        });
        const info = await loadMembership("me");
        expect(info.core).toEqual({symbol: "BTS", precision: 5});
        expect(info.lifetimeFee).toBe(BigInt("579131307"));
    });

    it("knows a Lifetime member, and does not ask for an account when there is none", async () => {
        answers([{membership_expiration_date: "2106-02-07T06:28:15"}]);
        expect((await loadMembership("lifetime-one")).status).toBe("lifetime");
        mockExec.mockClear();
        expect((await loadMembership(null)).status).toBe("unknown");
        expect(mockExec).not.toHaveBeenCalledWith(
            "get_accounts",
            expect.anything()
        );
    });

    it("keeps the fees when the account cannot be read, and scales them by the schedule's scale", async () => {
        mockExec.mockImplementation(async (method: string) => {
            if (method === "get_global_properties") {
                return {
                    parameters: {
                        ...properties.parameters,
                        current_fees: {
                            ...properties.parameters.current_fees,
                            scale: 5000
                        }
                    }
                };
            }
            if (method === "get_assets") return [{symbol: "BTS", precision: 5}];
            throw new Error("offline");
        });
        const info = await loadMembership("me");
        expect(info.status).toBe("unknown");
        // half the scale: half the fee
        expect(info.exchangeFee).toBe(BigInt(50000));
    });

    it("fails when the chain's parameters cannot be read", async () => {
        mockExec.mockRejectedValue(new Error("offline"));
        await expect(loadMembership("me")).rejects.toThrow("offline");
    });
});
