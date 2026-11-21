import {openRoute, setRouteOpener} from "../../lib/common/openRoute";

describe("openRoute", () => {
    it("does nothing until the shell has said how pages are opened", () => {
        expect(openRoute("/block/1/0")).toBe(false);
    });

    it("hands a route of the app to the opener, and only that", () => {
        const opened: string[] = [];
        const stop = setRouteOpener(to => opened.push(to));
        expect(openRoute("/block/7000/3")).toBe(true);
        // a web address, a protocol-relative one, a script and nothing are not routes of the app
        expect(openRoute("https://evil.example/")).toBe(false);
        expect(openRoute("//evil.example/")).toBe(false);
        expect(openRoute("javascript:alert(1)")).toBe(false);
        expect(openRoute("")).toBe(false);
        expect(opened).toEqual(["/block/7000/3"]);
        stop();
        expect(openRoute("/block/1/0")).toBe(false);
    });

    it("a newer opener is not taken away by an older one stopping", () => {
        const first: string[] = [];
        const second: string[] = [];
        const stopFirst = setRouteOpener(to => first.push(to));
        const stopSecond = setRouteOpener(to => second.push(to));
        stopFirst();
        openRoute("/a");
        expect(second).toEqual(["/a"]);
        expect(first).toEqual([]);
        stopSecond();
    });
});
