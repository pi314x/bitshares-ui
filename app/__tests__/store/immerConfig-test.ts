// Characterization test for app/store/immerConfig.ts: Redux Toolkit's
// auto-freeze must stay off so legacy call sites that mutate `getState()`
// results in place keep working (see the module header for the incident
// this guards against).
import "../../store/immerConfig";
import SettingsStore from "../../stores/SettingsStore";

describe("store/immerConfig", () => {
    it("leaves slice state mutable, like the Alt.js stores it replaced", () => {
        const servers = SettingsStore.getState().defaults.apiServer;
        expect(servers.length).toBeGreaterThan(0);
        expect(Object.isFrozen(servers)).toBe(false);
        expect(Object.isFrozen(servers[0])).toBe(false);
        expect(() => {
            servers[0].hidden = !!servers[0].hidden;
        }).not.toThrow();
        expect(Object.isFrozen(SettingsStore.getState().apiLatencies)).toBe(
            false
        );
    });
});
