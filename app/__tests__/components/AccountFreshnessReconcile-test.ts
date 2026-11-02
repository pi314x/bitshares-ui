import * as Immutable from "immutable";

const mockOnUpdate = jest.fn();
const mockExec = jest.fn();
let mockAccount: any = null;
let mockObjects: {[id: string]: any} = {};
jest.mock("bitsharesjs", () => ({
    ChainStore: {
        getAccount: () => mockAccount,
        getObject: (id: string) => mockObjects[id],
        onUpdate: (...args: any[]) => mockOnUpdate(...args),
        subscribe: () => undefined,
        unsubscribe: () => undefined
    }
}));
jest.mock("bitsharesjs-ws", () => ({
    Apis: {instance: () => ({db_api: () => ({exec: mockExec})})}
}));
jest.mock("../../next/hooks/useChainStoreTick", () => ({
    useChainStoreTick: () => 0
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    useReduxState: () => ({})
}));

import {depsFor} from "../../components/AccountFreshness";

beforeEach(() => {
    mockOnUpdate.mockReset();
    mockExec.mockReset();
    mockAccount = Immutable.fromJS({
        id: "1.2.7",
        statistics: "2.6.7",
        orders: ["1.7.1", "1.7.2"],
        call_orders: ["1.8.1"]
    });
    mockObjects = {
        "2.6.7": Immutable.fromJS({id: "2.6.7", most_recent_op: "2.9.10"})
    };
});

describe("the freshness of the connected account against the real chain store", () => {
    it("reads the chain's most recent operation of the account, and the chain store's", async () => {
        mockExec.mockResolvedValue([{id: "2.6.7", most_recent_op: "2.9.55"}]);
        const deps = depsFor("me");
        expect(await deps.chainMostRecent()).toBe("2.9.55");
        expect(mockExec).toHaveBeenCalledWith("get_objects", [["2.6.7"]]);
        expect(deps.cachedMostRecent()).toBe("2.9.10");
    });

    it("knows nothing while the account is not in the chain store yet", async () => {
        mockAccount = null;
        const deps = depsFor("me");
        expect(await deps.chainMostRecent()).toBeNull();
        expect(deps.cachedMostRecent()).toBeNull();
        expect(mockExec).not.toHaveBeenCalled();
    });

    it("gives the chain store the account's data as a notice would: statistics, balances (a new asset too), orders, positions, and the ids of what is gone", async () => {
        mockExec.mockResolvedValue([
            [
                "1.2.7",
                {
                    statistics: {id: "2.6.7", most_recent_op: "2.9.55"},
                    balances: [
                        {
                            id: "2.5.1",
                            owner: "1.2.7",
                            asset_type: "1.3.0",
                            balance: "100"
                        },
                        {
                            id: "2.5.9",
                            owner: "1.2.7",
                            asset_type: "1.3.50",
                            balance: "7"
                        }
                    ],
                    // 1.7.1 is still open, 1.7.2 was filled meanwhile, 1.7.3 is new
                    limit_orders: [{id: "1.7.1"}, {id: "1.7.3"}],
                    // the position 1.8.1 was closed
                    call_orders: []
                }
            ]
        ]);
        await depsFor("me").reconcile();
        expect(mockExec).toHaveBeenCalledWith("get_full_accounts", [
            ["me"],
            false
        ]);
        expect(mockOnUpdate).toHaveBeenCalledTimes(1);
        const [updates] = mockOnUpdate.mock.calls[0];
        expect(updates).toHaveLength(1);
        expect(updates[0]).toEqual([
            {id: "2.6.7", most_recent_op: "2.9.55"},
            {id: "2.5.1", owner: "1.2.7", asset_type: "1.3.0", balance: "100"},
            {id: "2.5.9", owner: "1.2.7", asset_type: "1.3.50", balance: "7"},
            {id: "1.7.1"},
            {id: "1.7.3"},
            // (a bare id tells the chain store the object is gone)
            "1.7.2",
            "1.8.1"
        ]);
    });

    it("gives nothing when the chain has no such account", async () => {
        mockExec.mockResolvedValue([]);
        await depsFor("me").reconcile();
        expect(mockOnUpdate).not.toHaveBeenCalled();
    });
});
