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
