import {
    accountsReady,
    coverVisible,
    READY_MAX_MS
} from "../../lib/common/startup";

describe("accountsReady", () => {
    it("needs both lists", () => {
        expect(accountsReady(null)).toBe(false);
        expect(accountsReady({})).toBe(false);
        expect(accountsReady({accountsLoaded: true})).toBe(false);
        expect(accountsReady({refsLoaded: true})).toBe(false);
        expect(accountsReady({accountsLoaded: true, refsLoaded: true})).toBe(
            true
        );
    });
});

describe("coverVisible", () => {
    const base = {apiConnected: false, apiError: false, appReady: false};

    it("is on while connecting and while the app is not ready", () => {
        expect(coverVisible(base)).toBe(true);
        expect(coverVisible({...base, apiConnected: true})).toBe(true);
    });

    it("goes when connected and ready: one start-up screen, not two", () => {
        expect(
            coverVisible({apiConnected: true, apiError: false, appReady: true})
        ).toBe(false);
    });

    it("never sits on an error screen", () => {
        expect(coverVisible({...base, apiError: true})).toBe(false);
    });

    it("has a limit", () => {
        expect(READY_MAX_MS).toBeGreaterThan(0);
    });
});
