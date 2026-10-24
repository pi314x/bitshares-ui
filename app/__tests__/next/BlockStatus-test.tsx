import * as React from "react";
import {render} from "@testing-library/react";
import Immutable from "immutable";

let mockDynamic: any = null;
let mockStatus: string | null = "open";

jest.mock("bitsharesjs", () => ({
    ChainStore: {getObject: () => mockDynamic}
}));
jest.mock("../../next/hooks/useChainStoreTick", () => ({
    useChainStoreTick: () => 0
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    useReduxState: () => ({rpc_connection_status: mockStatus})
}));

import BlockStatus, {blockHealth, formatAge} from "../../next/BlockStatus";

describe("blockHealth", () => {
    it("is live for a fresh block, slow, stalled, and offline without a connection", () => {
        expect(blockHealth(2, true)).toBe("live");
        expect(blockHealth(20, true)).toBe("slow");
        expect(blockHealth(120, true)).toBe("stalled");
        expect(blockHealth(1, false)).toBe("offline");
    });
});

describe("formatAge", () => {
    it("reads seconds, minutes and hours", () => {
        expect(formatAge(0.4)).toBe("now");
        expect(formatAge(7.9)).toBe("7s");
        expect(formatAge(125)).toBe("2m");
        expect(formatAge(7300)).toBe("2h");
        expect(formatAge(NaN)).toBe("-");
    });
});

describe("BlockStatus", () => {
    beforeEach(() => {
        mockStatus = "open";
        mockDynamic = Immutable.Map({
            head_block_number: 115209581,
            last_irreversible_block_num: 115209565,
            time: new Date(Date.now() - 3000).toISOString().replace("Z", "")
        });
    });

    it("shows the head block and its age, and how far irreversibility is behind on hover", () => {
        const {container} = render(<BlockStatus />);
        const text = container.textContent || "";
        expect(text).toContain("#115,209,581");
        expect(text).toMatch(/[2-4]s/);
        const chip = container.firstChild as HTMLElement;
        expect(chip.title).toContain("16 behind");
    });

    it("colours a late block", () => {
        mockDynamic = mockDynamic.set(
            "time",
            new Date(Date.now() - 90000).toISOString().replace("Z", "")
        );
        const {container} = render(<BlockStatus />);
        expect((container.firstChild as HTMLElement).className).toMatch(
            /stalled/
        );
    });

    it("shows nothing before the chain's properties are known", () => {
        mockDynamic = null;
        const {container} = render(<BlockStatus />);
        expect(container.textContent).toBe("");
    });
});
