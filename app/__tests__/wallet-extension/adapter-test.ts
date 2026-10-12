import {
    createExtensionSigner,
    toSignerError
} from "../../wallet-extension/adapter";
import {findProvider, waitForProvider} from "../../wallet-extension/provider";
import {ExternalSignerError} from "../../wallet-extension/types";
import {makeFakeProvider, MAINNET, TESTNET} from "../utils/fakeProvider";

const tx = {
    operations: [
        [
            0,
            {
                fee: {amount: "0", asset_id: "1.3.0"},
                from: "1.2.100",
                to: "1.2.200",
                amount: {amount: "5000", asset_id: "1.3.0"}
            }
        ] as [number, any]
    ]
};
const alice = {accountName: "alice", accountId: "1.2.100"};

async function codeOf(promise: Promise<any>): Promise<string> {
    try {
        await promise;
    } catch (e) {
        return (e as ExternalSignerError).code;
    }
    return "none";
}

describe("provider detection", () => {
    it("accepts only the real shape", () => {
        const {provider} = makeFakeProvider();
        expect(findProvider({bitsharesWallet: provider})).toBe(provider);
        expect(findProvider({bitsharesWallet: {}})).toBeNull();
        expect(
            findProvider({
                bitsharesWallet: {...provider, isBitSharesWallet: false}
            })
        ).toBeNull();
        expect(findProvider({})).toBeNull();
    });

    it("does not look at window.beet", () => {
        const {provider} = makeFakeProvider();
        expect(findProvider({beet: provider})).toBeNull();
    });

    it("waits for the ready event, then gives up", async () => {
        const target = new EventTarget() as any;
        const {provider} = makeFakeProvider();
        const waiting = waitForProvider(target, 500);
        target.bitsharesWallet = provider;
        target.dispatchEvent(new Event("bitsharesWalletReady"));
        expect(await waiting).toBe(provider);
        expect(await waitForProvider(new EventTarget() as any, 20)).toBeNull();
    });
});

describe("connect", () => {
    it("asks the extension to refuse another chain and returns the account", async () => {
        const fake = makeFakeProvider();
        const account = await createExtensionSigner(
            () => fake.provider
        ).connect(MAINNET);
        expect(account).toEqual(alice);
        expect(fake.calls[0]).toEqual({
            method: "connect",
            params: {chain_id: MAINNET}
        });
    });

    it("fails with chain_mismatch when the extension is on another network", async () => {
        const fake = makeFakeProvider({chainId: TESTNET});
        expect(
            await codeOf(
                createExtensionSigner(() => fake.provider).connect(MAINNET)
            )
        ).toBe("chain_mismatch");
    });

    it("reports a rejection and a locked wallet distinctly", async () => {
        expect(
            await codeOf(
                createExtensionSigner(
                    () => makeFakeProvider({rejectConnect: true}).provider
                ).connect(MAINNET)
            )
        ).toBe("rejected");
        expect(
            await codeOf(
                createExtensionSigner(
                    () => makeFakeProvider({locked: true}).provider
                ).connect(MAINNET)
            )
        ).toBe("locked");
    });

    it("does not accept an account the extension made up", async () => {
        const fake = makeFakeProvider({account: {name: "x", id: "not-an-id"}});
        expect(
            await codeOf(
                createExtensionSigner(() => fake.provider).connect(MAINNET)
            )
        ).toBe("failed");
    });

    it("is unavailable without a provider", async () => {
        const signer = createExtensionSigner(() => null);
        expect(await signer.isAvailable()).toBe(false);
        expect(await codeOf(signer.connect(MAINNET))).toBe("unavailable");
    });
});

describe("restore", () => {
    it("returns the approved account silently, or null", async () => {
        const approved = makeFakeProvider({connected: true});
        expect(
            await createExtensionSigner(() => approved.provider).restore(
                MAINNET
            )
        ).toEqual(alice);
        const never = makeFakeProvider();
        expect(
            await createExtensionSigner(() => never.provider).restore(MAINNET)
        ).toBeNull();
        expect(never.calls.map(c => c.method)).not.toContain("connect");
    });

    it("treats another chain or no extension as not connected", async () => {
        const other = makeFakeProvider({connected: true, chainId: TESTNET});
        expect(
            await createExtensionSigner(() => other.provider).restore(MAINNET)
        ).toBeNull();
        expect(
            await createExtensionSigner(() => null).restore(MAINNET)
        ).toBeNull();
    });
});

describe("signAndBroadcast", () => {
    it("sends the operations and returns the broadcast result", async () => {
        const fake = makeFakeProvider({connected: true});
        const out = await createExtensionSigner(
            () => fake.provider
        ).signAndBroadcast(alice, tx, MAINNET);
        expect(out.result).toEqual({id: "abc", block_num: 42});
        const sent = fake.calls.find(c => c.method === "signTransaction")!;
        expect(sent.params).toEqual({
            operations: tx.operations,
            extensions: []
        });
    });

    it("checks lock, chain and account on every call, before signing", async () => {
        const fake = makeFakeProvider({connected: true});
        await createExtensionSigner(() => fake.provider).signAndBroadcast(
            alice,
            tx,
            MAINNET
        );
        const order = fake.calls.map(c => c.method);
        expect(order.indexOf("isLocked")).toBeLessThan(
            order.indexOf("signTransaction")
        );
        expect(order.indexOf("getChainId")).toBeLessThan(
            order.indexOf("signTransaction")
        );
        expect(order.indexOf("checkConnection")).toBeLessThan(
            order.indexOf("signTransaction")
        );
    });

    it.each([
        ["locked", {connected: true, locked: true}, "locked"],
        [
            "on another network",
            {connected: true, chainId: TESTNET},
            "chain_mismatch"
        ],
        ["not connected any more", {connected: false}, "account_mismatch"],
        [
            "connected as another account",
            {connected: true, account: {name: "bob", id: "1.2.300"}},
            "account_mismatch"
        ]
    ])(
        "does not sign when the extension is %s",
        async (_label, options, code) => {
            const fake = makeFakeProvider(options as any);
            expect(
                await codeOf(
                    createExtensionSigner(() => fake.provider).signAndBroadcast(
                        alice,
                        tx,
                        MAINNET
                    )
                )
            ).toBe(code);
            expect(fake.calls.some(c => c.method === "signTransaction")).toBe(
                false
            );
        }
    );

    it("does not even ask when an operation acts for another account", async () => {
        const fake = makeFakeProvider({connected: true});
        const other = {
            operations: [
                [0, {...tx.operations[0][1], from: "1.2.999"}] as [number, any]
            ]
        };
        expect(
            await codeOf(
                createExtensionSigner(() => fake.provider).signAndBroadcast(
                    alice,
                    other,
                    MAINNET
                )
            )
        ).toBe("account_mismatch");
        expect(fake.calls.length).toBe(0);
    });

    it.each([
        [{success: false, error: "User rejected transaction"}, "rejected"],
        [{success: false, error: "Request timeout"}, "unknown"],
        [{success: false, error: "Extension disconnected"}, "unknown"],
        [
            {
                success: false,
                error:
                    "Transaction signing request timed out. Please click the BitShares extension icon to approve."
            },
            "timeout"
        ],
        [
            {
                success: false,
                error: "Operation type 5 is not permitted from dApp requests."
            },
            "failed"
        ],
        [{success: false}, "failed"],
        [{result: "no success flag"}, "failed"],
        [null, "failed"],
        ["ok", "failed"]
    ])("maps the answer %j to %s", async (signResponse, code) => {
        const fake = makeFakeProvider({connected: true, signResponse});
        expect(
            await codeOf(
                createExtensionSigner(() => fake.provider).signAndBroadcast(
                    alice,
                    tx,
                    MAINNET
                )
            )
        ).toBe(code);
    });

    it("treats a thrown timeout from the provider as an unknown outcome", async () => {
        const fake = makeFakeProvider({connected: true});
        fake.provider.signTransaction = async () => {
            throw new Error("Request timeout");
        };
        const error = await createExtensionSigner(() => fake.provider)
            .signAndBroadcast(alice, tx, MAINNET)
            .catch(e => e);
        expect(error.code).toBe("unknown");
        expect(error.message).toMatch(/check your account history/);
    });

    it("keeps only the first line of a long broadcast error", () => {
        const error = toSignerError(
            new Error(
                "Assert Exception: insufficient balance\n\n[ops JSON for diagnosis]:\n" +
                    "x".repeat(5000)
            )
        );
        expect(error.message).toBe("Assert Exception: insufficient balance");
    });
});
