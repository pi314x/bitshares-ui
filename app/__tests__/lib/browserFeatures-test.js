import missingBrowserFeatures from "../../lib/feature_detect/browserFeatures";

const modern = () => ({
    indexedDB: {},
    localStorage: {},
    WebSocket: function() {},
    fetch: function() {},
    Promise: function() {},
    TextEncoder: function() {},
    Uint8Array: function() {}
});

describe("missingBrowserFeatures", () => {
    it("is empty for a current browser, whatever it is called", () => {
        expect(missingBrowserFeatures(modern())).toEqual([]);
    });

    it("names what an old browser lacks", () => {
        const env = modern();
        delete env.fetch;
        delete env.TextEncoder;
        expect(missingBrowserFeatures(env)).toEqual(["fetch", "TextEncoder"]);
    });

    it("treats blocked storage (the getter throws) as missing", () => {
        const env = modern();
        Object.defineProperty(env, "localStorage", {
            get() {
                throw new Error("denied");
            }
        });
        expect(missingBrowserFeatures(env)).toEqual(["localStorage"]);
    });

    it("runs against jsdom's window", () => {
        expect(Array.isArray(missingBrowserFeatures(window))).toBe(true);
    });
});
