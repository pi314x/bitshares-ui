// The node sends at most 500 balances in a full account. An account with 502 balance objects
// (most of them empty) lost the last two, and one of them was XBTSX.A, bought on the market and
// missing from the holdings.
import {installCompleteBalances} from "../../lib/chain/completeBalances";

const fullAccount = (balances: any[], more: boolean) => [
    [
        "thmsfnd02",
        {
            account: {id: "1.2.9", name: "thmsfnd02"},
            balances,
            more_data_available: {balances: more, limit_orders: false}
        }
    ]
];
const balanceObject = (n: number, asset: string, amount: number) => ({
    id: `2.5.${n}`,
    owner: "1.2.9",
    asset_type: asset,
    balance: amount,
    maintenance_flag: false
});

// a stand-in for the API class: what the node answers, by method
function makeApi(answers: Record<string, any>, calls: string[] = []) {
    class FakeApi {
        api_name = "database";
        exec(method: string, params: any[] = []) {
            calls.push(method);
            // (the answers do not depend on the parameters)
            void params;
            const answer = answers[method];
            return answer instanceof Error
                ? Promise.reject(answer)
                : Promise.resolve(answer);
        }
    }
    installCompleteBalances(FakeApi as any);
    return {Api: FakeApi, calls};
}

describe("installCompleteBalances", () => {
    it("adds the balances the full account lacks when the node says there are more", async () => {
        const {Api} = makeApi({
            get_full_accounts: fullAccount(
                [balanceObject(100, "1.3.0", 5000)],
                true
            ),
            get_account_balances: [
                {amount: 5000, asset_id: "1.3.0"},
                {amount: 1380649755, asset_id: "1.3.6620"},
                {amount: 0, asset_id: "1.3.77"}
            ]
        });
        const [[, full]] = await new Api().exec("get_full_accounts", [
            ["thmsfnd02"],
            true
        ]);
        expect(full.balances.map((b: any) => b.asset_type)).toEqual([
            "1.3.0",
            "1.3.6620",
            "1.3.77"
        ]);
        const added = full.balances[1];
        expect(added).toMatchObject({
            owner: "1.2.9",
            asset_type: "1.3.6620",
            balance: 1380649755
        });
        // an id no real balance object has, and one for each asset
        expect(added.id).toMatch(/^2\.5\.\d+$/);
        expect(parseInt(added.id.split(".")[2], 10)).toBeGreaterThan(1e9);
        expect(added.id).not.toBe(full.balances[2].id);
    });

    it("leaves a full account alone when nothing is missing", async () => {
        const calls: string[] = [];
        const {Api} = makeApi(
            {
                get_full_accounts: fullAccount(
                    [balanceObject(100, "1.3.0", 5000)],
                    false
                )
            },
            calls
        );
        const [[, full]] = await new Api().exec("get_full_accounts", [
            ["thmsfnd02"],
            true
        ]);
        expect(full.balances).toHaveLength(1);
        expect(calls).toEqual(["get_full_accounts"]);
    });

    it("gives the account as the node sent it when the rest cannot be read", async () => {
        const {Api} = makeApi({
            get_full_accounts: fullAccount(
                [balanceObject(100, "1.3.0", 5000)],
                true
            ),
            get_account_balances: new Error("node says no")
        });
        const [[, full]] = await new Api().exec("get_full_accounts", [
            ["thmsfnd02"],
            true
        ]);
        expect(full.balances).toHaveLength(1);
    });

    it("does not touch other calls", async () => {
        const {Api} = makeApi({get_objects: [{id: "2.1.0"}]});
        expect(await new Api().exec("get_objects", [["2.1.0"]])).toEqual([
            {id: "2.1.0"}
        ]);
    });
});
