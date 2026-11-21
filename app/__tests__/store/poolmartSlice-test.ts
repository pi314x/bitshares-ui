import Immutable from "immutable";
import reducer, {
    getLiquidityPools,
    getLiquidityPoolsAccount
} from "../../store/slices/poolmartSlice";

const pool = (n: number) => ({id: `1.19.${n}`, share_asset: `1.3.${n}`});

describe("poolmartSlice: the pools of an account (Created by me)", () => {
    // the page of all pools has put every pool of the chain in the list
    const withAllPools = () =>
        reducer(
            undefined,
            getLiquidityPools({
                loading: false,
                liquidityPools: [pool(1), pool(2), pool(3)]
            })
        );

    it("replaces the list with the pools the account owns", () => {
        const state = reducer(
            withAllPools(),
            getLiquidityPoolsAccount({
                loading: false,
                liquidityPools: [pool(2)]
            })
        );
        expect(
            state.liquidityPools
                .toList()
                .map((p: any) => p.id)
                .toJS()
        ).toEqual(["1.19.2"]);
        expect(state.lastPoolId).toBe("1.19.2");
    });

    it("empties the list for an account that owns none, instead of keeping every pool", () => {
        const before = withAllPools();
        expect(before.liquidityPools.size).toBe(3);
        const state = reducer(
            before,
            getLiquidityPoolsAccount({loading: false, liquidityPools: []})
        );
        expect(Immutable.Map.isMap(state.liquidityPools)).toBe(true);
        expect(state.liquidityPools.size).toBe(0);
        expect(state.lastPoolId).toBeNull();
        expect(state.liquidityPoolsLoading).toBe(false);
    });
});
