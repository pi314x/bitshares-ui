// Integration tests for the Xbtsx gateway's raw fetch calls and
// localStorage-backed withdrawal-address history helpers (Phase 7,
// docs/UI_MIGRATION_PLAN.md's exit criteria for this gateway: "with its
// own integration test using recorded/mocked API fixtures - never hit
// the live gateway APIs in CI"). `global.fetch` is mocked with
// hand-built fixtures shaped like the real xbts.io API responses; no
// network call is ever made.
import {
    fetchCoinList,
    requestDepositAddress,
    validateAddress,
    WithdrawAddresses
} from "lib/common/XbtsxMethods";

function mockFetchOnce(jsonBody) {
    global.fetch = jest.fn(() =>
        Promise.resolve({
            json: () => Promise.resolve(jsonBody)
        })
    );
}

describe("XbtsxMethods", () => {
    const originalFetch = global.fetch;
    const originalHeaders = global.Headers;

    beforeAll(() => {
        // jsdom doesn't ship a `Headers` implementation; a minimal stand-in
        // is enough since XbtsxMethods only ever constructs one to pass to
        // fetch(), never reads it back.
        global.Headers =
            global.Headers ||
            function Headers(init) {
                this._init = init;
            };
    });

    afterAll(() => {
        global.Headers = originalHeaders;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it("fetchCoinList resolves with the parsed coin list", async () => {
        const fixture = [
            {symbol: "PPY", backingCoin: "btc", depositAllowed: true}
        ];
        mockFetchOnce(fixture);

        const result = await fetchCoinList("https://apis.xbts.io/api/v2/coin");

        expect(
            global.fetch
        ).toHaveBeenCalledWith("https://apis.xbts.io/api/v2/coin", {
            method: "post"
        });
        expect(result).toEqual(fixture);
    });

    it("fetchCoinList swallows fetch errors and resolves undefined", async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error("network down")));
        jest.spyOn(console, "log").mockImplementation(() => {});

        const result = await fetchCoinList("https://apis.xbts.io/api/v2/coin");

        expect(result).toBeUndefined();
    });

    it("requestDepositAddress calls stateCallback with the resolved address/memo", done => {
        mockFetchOnce({
            inputAddress: "bc1qxyz",
            inputMemo: null
        });

        requestDepositAddress({
            walletType: "btc",
            inputCoinType: "btc",
            outputCoinType: "ppy",
            outputAddress: "alice",
            url: "https://apis.xbts.io/api/v2",
            stateCallback: address => {
                expect(address).toEqual({
                    address: "bc1qxyz",
                    memo: null,
                    error: null
                });
                expect(global.fetch).toHaveBeenCalledWith(
                    "https://apis.xbts.io/api/v2/wallets/btc/new-deposit-address",
                    expect.objectContaining({method: "post"})
                );
                done();
            }
        });
    });

    it("requestDepositAddress falls back to 'unknown' when the API errors", done => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.reject(new Error("bad json"))
            })
        );

        requestDepositAddress({
            walletType: "btc",
            inputCoinType: "btc",
            outputCoinType: "ppy",
            outputAddress: "alice",
            url: "https://apis.xbts.io/api/v2",
            stateCallback: address => {
                expect(address).toEqual({address: "unknown", memo: null});
                done();
            }
        });
    });

    it("validateAddress resolves the isValid flag from a real-shaped response", async () => {
        mockFetchOnce({isValid: true});

        const result = await validateAddress({
            url: "https://apis.xbts.io/api/v2",
            walletType: "btc",
            newAddress: "bc1qxyz"
        });

        expect(result).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
            "https://apis.xbts.io/api/v2/wallets/btc/check-address",
            expect.objectContaining({
                method: "post",
                body: JSON.stringify({address: "bc1qxyz"})
            })
        );
    });

    it("validateAddress resolves without calling fetch when newAddress is empty", async () => {
        global.fetch = jest.fn();

        const result = await validateAddress({
            url: "https://apis.xbts.io/api/v2",
            walletType: "btc",
            newAddress: ""
        });

        expect(result).toBeUndefined();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    describe("WithdrawAddresses (localStorage-backed)", () => {
        const wallet = "test-wallet-" + Date.now();

        afterEach(() => {
            window.localStorage.clear();
        });

        it("has()/get() default to false/[] for an unknown wallet", () => {
            expect(WithdrawAddresses.has(wallet)).toBe(false);
            expect(WithdrawAddresses.get(wallet)).toEqual([]);
        });

        it("set()/get() round-trips the address list", () => {
            WithdrawAddresses.set({
                wallet,
                addresses: ["addr1", "addr2"]
            });

            expect(WithdrawAddresses.has(wallet)).toBe(true);
            expect(WithdrawAddresses.get(wallet)).toEqual(["addr1", "addr2"]);
        });

        it("setLast()/getLast() round-trips the last-used address", () => {
            expect(WithdrawAddresses.getLast(wallet)).toBe("");

            WithdrawAddresses.setLast({wallet, address: "addr1"});

            expect(WithdrawAddresses.getLast(wallet)).toBe("addr1");
        });
    });
});
