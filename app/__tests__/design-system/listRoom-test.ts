import {listRoom, MIN_LIST_HEIGHT} from "../../design-system/listRoom";

describe("design-system/listRoom", () => {
    const field = {top: 531, bottom: 569};

    it("is what is left of the window under the field, less the gap and the edge", () => {
        // 844 - (569 + 4) - 8
        expect(listRoom(field, false, 844)).toBe(263);
    });

    it("is what is left above the field when the list is drawn there", () => {
        // 531 - 4 - 8
        expect(listRoom(field, true, 844)).toBe(519);
    });

    it("is taken from the visual viewport where there is one: a keyboard is up", () => {
        // the keyboard leaves 494px, the field is at 531..569 of the page: nothing under it is in view
        expect(listRoom(field, false, 844, {offsetTop: 0, height: 494})).toBe(
            MIN_LIST_HEIGHT
        );
        // the field is lower than the first 300px that are in view, the top of what is in view is 200
        expect(listRoom(field, true, 844, {offsetTop: 200, height: 600})).toBe(
            319
        );
        expect(listRoom(field, false, 844, {offsetTop: 200, height: 600})).toBe(
            219
        );
    });

    it("is never so short that the list is of no use", () => {
        expect(listRoom(field, false, 700)).toBe(MIN_LIST_HEIGHT);
        expect(listRoom({top: 20, bottom: 58}, true, 844)).toBe(
            MIN_LIST_HEIGHT
        );
    });
});
