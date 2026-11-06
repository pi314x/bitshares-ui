import Immutable from "immutable";

const mockObjects: Record<string, any> = {};
const mockAssets: Record<string, any> = {};
jest.mock("bitsharesjs", () => ({
    ChainStore: {
        getObject: (id: string) => mockObjects[id],
        getAsset: (id: string) => mockAssets[id]
    }
}));

import {
    chainAsset,
    chainField,
    chainPrecision
} from "../../lib/chain/chainLookup";

describe("chain store reads that say not loaded instead of throwing", () => {
    beforeEach(() => {
        for (const k of Object.keys(mockObjects)) delete mockObjects[k];
        for (const k of Object.keys(mockAssets)) delete mockAssets[k];
    });

    it("gives null for an asset the store does not have (undefined while loading, null if missing) and for no id", () => {
        mockAssets["1.3.8"] = null;
        expect(chainAsset("1.3.7")).toBeNull();
        expect(chainAsset("1.3.8")).toBeNull();
        expect(chainAsset(undefined)).toBeNull();
        expect(chainAsset("")).toBeNull();
        expect(chainPrecision("1.3.7")).toBeNull();
    });

    it("gives the asset and its precision once it is loaded", () => {
        mockAssets["1.3.0"] = Immutable.Map({id: "1.3.0", precision: 5});
        expect(chainAsset("1.3.0").get("id")).toBe("1.3.0");
        expect(chainPrecision("1.3.0")).toBe(5);
        // (a precision of 0 is a precision)
        mockAssets["1.3.9"] = Immutable.Map({id: "1.3.9", precision: 0});
        expect(chainPrecision("1.3.9")).toBe(0);
    });

    it("gives null for an asset whose precision is not there", () => {
        mockAssets["1.3.5"] = Immutable.Map({id: "1.3.5"});
        expect(chainPrecision("1.3.5")).toBeNull();
    });

    it("reads a field of an object, null while the object or the field is missing", () => {
        mockObjects["2.5.1"] = Immutable.Map({balance: "42"});
        expect(chainField("2.5.1", "balance")).toBe("42");
        expect(chainField("2.5.1", "owner")).toBeNull();
        expect(chainField("2.5.2", "balance")).toBeNull();
        expect(chainField(null, "balance")).toBeNull();
        // (an object the store answers with something that is not a map yet)
        mockObjects["2.5.3"] = true;
        expect(chainField("2.5.3", "balance")).toBeNull();
    });
});
