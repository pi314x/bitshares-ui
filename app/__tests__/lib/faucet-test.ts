import {registrationFaucet} from "../../lib/common/faucet";

describe("registrationFaucet", () => {
    const settings = {
        faucet_address: "https://faucet.example",
        testnet_faucet: "https://testnet-faucet.example"
    };

    it("is the settings' faucet on the main chain", () => {
        expect(registrationFaucet(false, settings)).toBe(
            "https://faucet.example"
        );
    });

    it("is the test chain's faucet on a test chain, never the main one", () => {
        expect(registrationFaucet(true, settings)).toBe(
            "https://testnet-faucet.example"
        );
        expect(
            registrationFaucet(true, {faucet_address: "https://faucet.example"})
        ).toBe("");
    });

    it("is empty, not undefined, when nothing is set", () => {
        expect(registrationFaucet(false, {})).toBe("");
    });
});
