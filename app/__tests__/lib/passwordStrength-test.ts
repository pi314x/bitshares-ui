import {
    loadPasswordStrength,
    passwordStrength
} from "../../lib/common/passwordStrength";

describe("passwordStrength", () => {
    it("says -1 until the library is loaded, as the old CDN wrapper did", () => {
        expect(passwordStrength("anything")).toEqual({score: -1});
    });

    it("scores a password once it is loaded: a guessable one low, a long random one high", async () => {
        await loadPasswordStrength();
        expect(passwordStrength("password").score).toBeLessThanOrEqual(1);
        expect(passwordStrength("123456").score).toBe(0);
        expect(
            passwordStrength("correct horse battery staple Zq7!vL2#").score
        ).toBe(4);
    });

    it("loads once", async () => {
        const first = loadPasswordStrength();
        expect(loadPasswordStrength()).toBe(first);
        await first;
    });
});
