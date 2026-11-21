// The node-selection step must never write to the state objects it reads:
// SettingsStore is Redux-backed, and a write to a frozen object throws a
// TypeError in strict mode, which used to abort willTransitionTo and leave
// the app stuck on "Application initialization issues".
import {routerTransitioner} from "../routerTransition";
import SettingsStore from "stores/SettingsStore";

function deepFreeze(value) {
    Object.freeze(value);
    Object.values(value).forEach(child => {
        if (child && typeof child === "object" && !Object.isFrozen(child)) {
            deepFreeze(child);
        }
    });
    return value;
}

describe("routerTransition with frozen settings state", () => {
    beforeEach(() => {
        const state = SettingsStore.getState();
        deepFreeze(state.defaults.apiServer);
        deepFreeze(state.apiLatencies);
    });

    it("getNodes works on copies and leaves the source entries alone", () => {
        const before = JSON.stringify(
            SettingsStore.getState().defaults.apiServer
        );
        let nodes;
        expect(() => {
            nodes = routerTransitioner.getNodes(null, false, true);
        }).not.toThrow();
        expect(nodes.length).toBeGreaterThan(0);
        nodes.forEach(node => {
            expect(typeof node.hidden).toBe("boolean");
            expect(typeof node.name).toBe("string");
            expect(node).toHaveProperty("latency");
        });
        expect(
            JSON.stringify(SettingsStore.getState().defaults.apiServer)
        ).toBe(before);
    });

    it("_updateLatencies merges into a copy of the stored map", () => {
        const url = "wss://latency-test.example/ws";
        const container = {};
        expect(() => {
            routerTransitioner._updateLatencies({[url]: 42}, true, container);
        }).not.toThrow();
        expect(container[url]).toBe(42);
        expect(SettingsStore.getState().apiLatencies[url]).toBe(42);
    });
});

describe("the nodes the automatic selection knocks on", () => {
    afterEach(() => jest.restoreAllMocks());

    it("leaves out a node on this computer unless it is the one that was chosen: the browser logs every refused connection as an error", () => {
        const local = "ws://127.0.0.1:8090";
        const urls = chosen => {
            jest.spyOn(routerTransitioner, "_getLastNode").mockReturnValue(
                chosen
            );
            return routerTransitioner
                .getNodes(null, false, true)
                .map(node => node.url);
        };
        expect(urls("wss://fake.automatic-selection.com")).not.toContain(local);
        expect(urls("wss://dex.iobanker.com/ws")).not.toContain(local);
        // chosen: it is tried
        expect(urls(local)).toContain(local);
        // (the public nodes are there either way)
        expect(urls(local)).toContain("wss://dex.iobanker.com/ws");
    });

    it("has no node whose host does not exist any more", () => {
        const urls = routerTransitioner
            .getNodes(null, false, true, true, true)
            .map(node => node.url);
        [
            "btsws.roelandp.nl",
            "api.btslebin.com",
            "bitsharesapi.loclx.io"
        ].forEach(host => expect(urls.join(" ")).not.toContain(host));
    });
});
