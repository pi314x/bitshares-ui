// Which faucet registers a new account. The faucet of the settings is the mainnet one; on a test
// chain the new account's keys begin with `TEST` and the account has to be registered on that
// chain, by the test chain's faucet. Sending it to the mainnet faucet asks a real faucet to register a
// name on the real chain (it rejects the keys today, but that is not a thing to lean on).

export interface FaucetSettings {
    /** the faucet of the settings (the mainnet one) */
    faucet_address?: string;
    /** the faucet of the test chain */
    testnet_faucet?: string;
}

export function registrationFaucet(
    onTestnet: boolean,
    settings: FaucetSettings
): string {
    const chosen = onTestnet
        ? settings.testnet_faucet
        : settings.faucet_address;
    return typeof chosen === "string" ? chosen : "";
}
