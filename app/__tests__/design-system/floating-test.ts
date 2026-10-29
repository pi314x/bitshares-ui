import {MARGIN, placeFloating} from "../../design-system/floating";

const view = {width: 400, height: 800};
const box = (left: number, top: number, width = 20, height = 20) => ({
    left,
    top,
    right: left + width,
    bottom: top + height
});
const bubble = {width: 200, height: 60};

describe("placeFloating", () => {
    it("puts a top bubble above the trigger, centred on it", () => {
        expect(placeFloating(box(190, 300), bubble, "top", view)).toEqual({
            left: 100,
            top: 300 - 8 - 60
        });
    });

    it("keeps a bubble inside the screen at the left edge, where the trigger is", () => {
        // a warning icon at the very left of a list: the bubble used to start left of the screen
        const {left} = placeFloating(box(10, 300), bubble, "top", view);
        expect(left).toBe(MARGIN);
    });

    it("keeps a bubble inside the screen at the right edge", () => {
        const {left} = placeFloating(box(380, 300), bubble, "top", view);
        expect(left).toBe(400 - 200 - MARGIN);
    });

    it("starts a topLeft bubble at the trigger's left edge and ends a topRight one at its right", () => {
        expect(placeFloating(box(100, 300), bubble, "topLeft", view).left).toBe(
            100
        );
        expect(
            placeFloating(box(300, 300), bubble, "topRight", view).left
        ).toBe(320 - 200);
    });

    it("goes below the trigger when there is no room above it", () => {
        const {top} = placeFloating(box(190, 20), bubble, "top", view);
        expect(top).toBe(20 + 20 + 8);
    });

    it("goes above the trigger when there is no room below it", () => {
        const {top} = placeFloating(box(190, 760), bubble, "bottom", view);
        expect(top).toBe(760 - 8 - 60);
    });

    it("goes to the right of a trigger at the left edge, and to the left of one at the right edge", () => {
        expect(placeFloating(box(10, 300), bubble, "left", view).left).toBe(
            30 + 8
        );
        expect(placeFloating(box(370, 300), bubble, "right", view).left).toBe(
            370 - 8 - 200
        );
    });

    it("stays on the screen even where neither side has room", () => {
        const tall = {width: 300, height: 700};
        const {left, top} = placeFloating(box(10, 400), tall, "left", view);
        expect(left).toBeGreaterThanOrEqual(MARGIN);
        expect(left + 300).toBeLessThanOrEqual(400 - MARGIN);
        expect(top).toBeGreaterThanOrEqual(MARGIN);
        expect(top + 700).toBeLessThanOrEqual(800 - MARGIN);
    });
});
