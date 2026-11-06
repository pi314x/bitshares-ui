// A stand-in for `window.bitsharesWallet` that behaves the way the real
// extension's `inpage.js` + service worker are documented and written to
// (pi314x/bitshares-wallet-browser-extension v0.8.7): `connect` refuses a wrong
// chain, `signTransaction` answers `{success, result}` or `{success: false,
// error}` and never throws for a rejected or failed transaction.
import {BitSharesWalletProvider} from "../../wallet-extension/provider";

export const MAINNET =
    "4018d7844c78f6a6c41c6a552b898022310fc5dec06da467ee7905a8dad512c8";
/** What an extension with memo encryption and a fee asset answers (protocol 2). */
export const CAPABILITIES = {
    protocol: 2,
    version: "0.9.0",
    // transfer, limit orders, call order, samet funds
    operations: [0, 1, 2, 3, 64, 65, 66, 67, 68],
    memoEncryption: true,
    feeAsset: true
};

export const TESTNET =
    "39f5e2ede1f8bc1a3a54a7914414e3779e33193f1f5693510e73cb7a87617447";

export interface FakeOptions {
    chainId?: string;
    locked?: boolean;
    connected?: boolean;
    account?: {name: string; id: string};
    signResponse?: any;
    rejectConnect?: boolean;
    /** what `getCapabilities` answers; omitted: "Unknown method", as an older extension */
    capabilities?: any;
}

export function makeFakeProvider(options: FakeOptions = {}) {
    const state = {
        chainId: options.chainId || MAINNET,
        locked: options.locked === true,
        connected: options.connected === true,
        account: options.account || {name: "alice", id: "1.2.100"},
        // the extension connects an ACCOUNT to a site, not the extension: these accounts are
        connectedIds: new Set<string>()
    };
    if (state.connected) state.connectedIds.add(state.account.id);
    const calls: Array<{method: string; params?: any}> = [];
    const listeners: Record<string, Array<(d: any) => void>> = {};
    const provider: BitSharesWalletProvider = {
        isBitSharesWallet: true,
        async connect(opts: any = {}) {
            calls.push({method: "connect", params: opts});
            if (options.rejectConnect)
                throw new Error("User rejected connection");
            if (state.locked) throw new Error("Wallet is locked");
            if (opts.chain_id && opts.chain_id !== state.chainId) {
                throw new Error(
                    "Chain ID mismatch: cannot approve connection — site chain does not match the wallet's current network."
                );
            }
            state.connected = true;
            state.connectedIds.add(state.account.id);
            return {account: {...state.account}, balances: []};
        },
        async checkConnection() {
            calls.push({method: "checkConnection"});
            return state.connected
                ? {connected: true, account: {...state.account}}
                : {connected: false, account: null};
        },
        async getChainId() {
            calls.push({method: "getChainId"});
            return state.chainId;
        },
        async disconnect() {
            calls.push({method: "disconnect"});
            state.connected = false;
        },
        async signTransaction(transaction: any) {
            calls.push({method: "signTransaction", params: transaction});
            if (options.signResponse !== undefined) return options.signResponse;
            return {success: true, result: {id: "abc", block_num: 42}};
        },
        async request(method: string, params: any = {}) {
            calls.push({method, params});
            if (method === "isLocked") return {locked: state.locked};
            if (method === "getCapabilities" && options.capabilities) {
                return options.capabilities;
            }
            throw new Error("Unknown method: " + method);
        },
        on(event, callback) {
            (listeners[event] = listeners[event] || []).push(callback);
        },
        off(event, callback) {
            listeners[event] = (listeners[event] || []).filter(
                cb => cb !== callback
            );
        }
    };
    const emit = (event: string, data?: any) =>
        (listeners[event] || []).slice().forEach(cb => cb(data));
    return {
        provider,
        state,
        calls,
        emit,
        /** The user switches account in the extension: it is connected to this site or not. */
        switchTo(account: {name: string; id: string}) {
            state.account = {...account};
            state.connected = state.connectedIds.has(account.id);
            emit("accountChanged", {...account});
        }
    };
}
