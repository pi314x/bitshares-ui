// The asset page threw "undefined is not an object (evaluating 'backingAsset.get')": the chain
// store answers `undefined` for an asset it has not read yet (and `null` for one that does not
// exist), and the page only guarded the second.
jest.mock("../../../components/Utility/HelpContent", () => () => null);
jest.mock("../../../next/hooks/useChainStoreTick", () => ({
    useChainStoreTick: () => 0
}));

const mockAssets: Record<string, any> = {};

import * as React from "react";
import {render} from "@testing-library/react";
import {MemoryRouter, Routes, Route} from "react-router-dom";
import Immutable from "immutable";
import {ChainStore} from "bitsharesjs";
import Asset from "../../../components/Blockchain/Asset";

function page() {
    return render(
        <MemoryRouter initialEntries={["/asset/SMART"]}>
            <Routes>
                <Route path="/asset/:symbol" element={<Asset />} />
            </Routes>
        </MemoryRouter>
    );
}

const smartcoin = Immutable.fromJS({
    id: "1.3.100",
    symbol: "SMART",
    precision: 4,
    bitasset: {options: {short_backing_asset: "1.3.0"}}
});

describe("the asset page", () => {
    beforeEach(() => {
        for (const k of Object.keys(mockAssets)) delete mockAssets[k];
        jest.spyOn(ChainStore as any, "getAsset").mockImplementation(
            (id: any) => mockAssets[id]
        );
        jest.spyOn(ChainStore as any, "getObject").mockImplementation(
            () => undefined
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders nothing, and does not throw, while the backing asset is not read yet", () => {
        mockAssets.SMART = smartcoin;
        // "1.3.0" (the backing asset and the core asset) is not in the store yet
        expect(() => page()).not.toThrow();
    });

    it("renders nothing while only the core asset is missing", () => {
        mockAssets.SMART = smartcoin;
        mockAssets["1.3.0"] = undefined;
        const view = page();
        expect(view.container.textContent).toBe("");
    });

    it("shows the not-found page for an asset that does not exist", () => {
        mockAssets.SMART = null;
        const view = page();
        expect(view.container.textContent).not.toBe("");
    });
});
