// TypeScript port of the legacy PiratecashMethods.js (Phase 7,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes - the
// Piratecash gateway's raw fetch calls and local-storage-backed
// withdrawal-address history helpers. Structurally identical to
// XbtsxMethods.ts (this codebase already had the two gateways as
// near-duplicate files before this migration); kept as a separate file
// rather than deduplicated, matching the original and this migration's
// "mechanical port, no unrequested refactors" approach.
//
// Preserved verbatim: the local storage handle is named `xbtsxStorage`
// in the original (an inherited copy-paste artifact from XbtsxMethods.js
// - it has nothing to do with Xbtsx here), kept as-is since renaming an
// internal variable is not part of a mechanical port.
import ls from "./localStorage";
import {pirateCashAPIs} from "api/apiConfig";
const xbtsxStorage = (ls as any)("");

export function fetchCoinList(
    url: string = pirateCashAPIs.BASE + pirateCashAPIs.COINS_LIST
) {
    return fetch(url, {method: "post"})
        .then(reply =>
            reply.json().then(result => {
                return result;
            })
        )
        .catch(err => {
            console.log("error fetching xbtsx list of coins", err, url);
        });
}

export function requestDepositAddress({
    walletType,
    inputCoinType,
    outputCoinType,
    outputAddress,
    url = pirateCashAPIs.BASE,
    stateCallback
}: {
    walletType: string;
    inputCoinType: string;
    outputCoinType: string;
    outputAddress: string;
    url?: string;
    stateCallback?: (address: {
        address: string;
        memo?: string | null;
        error?: any;
    }) => void;
}) {
    const body = {
        inputCoinType,
        outputCoinType,
        outputAddress
    };

    const body_string = JSON.stringify(body);

    fetch(url + `/wallets/${walletType}/new-deposit-address`, {
        method: "post",
        headers: new Headers({
            Accept: "application/json",
            "Content-Type": "application/json"
        }),
        body: body_string
    })
        .then(
            reply => {
                reply.json().then(
                    json => {
                        // console.log( "reply: ", json )
                        const address = {
                            address: json.inputAddress || "unknown",
                            memo: json.inputMemo,
                            error: json.error || null
                        };
                        if (stateCallback) stateCallback(address);
                    },
                    () => {
                        // console.log( "error: ",error  );
                        if (stateCallback)
                            stateCallback({address: "unknown", memo: null});
                    }
                );
            },
            () => {
                // console.log( "error: ",error  );
                if (stateCallback)
                    stateCallback({address: "unknown", memo: null});
            }
        )
        .catch(err => {
            console.log("fetch error:", err);
        });
}

export function validateAddress({
    url = pirateCashAPIs.BASE,
    walletType,
    newAddress
}: {
    url?: string;
    walletType: string;
    newAddress: string;
}) {
    if (!newAddress) return new Promise(res => res(undefined));
    return fetch(url + "/wallets/" + walletType + "/check-address", {
        method: "post",
        headers: new Headers({
            Accept: "application/json",
            "Content-Type": "application/json"
        }),
        body: JSON.stringify({address: newAddress})
    })
        .then(reply => reply.json().then(json => json.isValid))
        .catch(err => {
            console.log("validate error:", err);
        });
}

function hasWithdrawalAddress(wallet: string) {
    return xbtsxStorage.has(`history_address_${wallet}`);
}

function setWithdrawalAddresses({
    wallet,
    addresses
}: {
    wallet: string;
    addresses: any;
}) {
    xbtsxStorage.set(`history_address_${wallet}`, addresses);
}

function getWithdrawalAddresses(wallet: string) {
    return xbtsxStorage.get(`history_address_${wallet}`, []);
}

function setLastWithdrawalAddress({
    wallet,
    address
}: {
    wallet: string;
    address: string;
}) {
    xbtsxStorage.set(`history_address_last_${wallet}`, address);
}

function getLastWithdrawalAddress(wallet: string) {
    return xbtsxStorage.get(`history_address_last_${wallet}`, "");
}

export const WithdrawAddresses = {
    has: hasWithdrawalAddress,
    set: setWithdrawalAddresses,
    get: getWithdrawalAddresses,
    setLast: setLastWithdrawalAddress,
    getLast: getLastWithdrawalAddress
};
