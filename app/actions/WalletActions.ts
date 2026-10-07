// Redux-backed replacement for the Alt.js WalletActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 9 - see
// `../stores/IntlStore.ts`'s header for the cluster explanation).
// `setWallet` is bound by BOTH `WalletManagerStore` and `AccountStore`
// under real Alt - calls both directly, same full payload each (matching
// the original: both received the same dispatched object, `AccountStore
// .onSetWallet` just only ever read `wallet_name` off it).
// `restore`/`setBackupDate`/`setBrainkeyBackupDate`/`deleteWallet` are
// only ever bound by `WalletManagerStore`.
//
// `createAccountWithPassword`/`createAccount`/`claimVestingBalance`/
// `importBalance` are NOT bound by any store (their dispatch calls were
// already dead no-ops under Alt) - dispatch calls dropped, the real
// key-generation/transaction-building/`WalletDb` calls preserved
// byte-for-byte. Security-sensitive per AGENTS.md: these generate real
// private keys (`WalletDb.generateKeyFromPassword`/`generateNextKey`)
// and build/broadcast real transactions (`WalletDb.process_transaction`/
// `saveKeys`) - never touches `WalletDb.ts` itself, every call
// preserved exactly including the brainkey-sequence-decrement rollback
// on a failed faucet account creation. `importBalance`'s original `let
// db = Apis.instance().db_api()`/`address_publickey_map` locals are
// dropped - genuinely unused in the original too (same "dead variable
// TypeScript surfaces that plain JS didn't" precedent as batch 8's
// `PrivateKeyStore.decodeMemo` `lockedWallet` drop).
import WalletDb from "stores/WalletDb";
import WalletUnlockActions from "actions/WalletUnlockActions";
import CachedPropertyActions from "actions/CachedPropertyActions";
import ApplicationApi from "api/ApplicationApi";
import {TransactionBuilder, FetchChain} from "bitsharesjs";
import SettingsStore from "stores/SettingsStore";
import walletManagerStore from "../stores/WalletManagerStore";
import accountStore from "../stores/AccountStore";

class WalletActionsFacade {
    /** Restore and make active a new wallet_object. */
    restore(wallet_name = "default", wallet_object: any) {
        wallet_name = wallet_name.toLowerCase();
        (walletManagerStore as any).onRestore({wallet_name, wallet_object});
        return {wallet_name, wallet_object};
    }

    /** Make an existing wallet active or create a wallet (and make it active).
        If <b>wallet_name</b> does not exist, provide a <b>create_wallet_password</b>.
    */
    setWallet(
        wallet_name: string,
        create_wallet_password?: string,
        brnkey?: string
    ): Promise<void> {
        (WalletUnlockActions as any).lock();
        if (!wallet_name) wallet_name = "default";
        return new Promise(resolve => {
            const payload = {
                wallet_name,
                create_wallet_password,
                brnkey,
                resolve
            };
            (walletManagerStore as any).onSetWallet(payload);
            (accountStore as any).onSetWallet(payload);
        });
    }

    setBackupDate() {
        (CachedPropertyActions as any).set("backup_recommended", false);
        (walletManagerStore as any).onSetBackupDate();
        return true;
    }

    setBrainkeyBackupDate() {
        (walletManagerStore as any).onSetBrainkeyBackupDate();
        return true;
    }

    deleteWallet(name: string) {
        (walletManagerStore as any).onDeleteWallet(name);
        return name;
    }

    createAccountWithPassword(
        account_name: string,
        password: string,
        registrar: any,
        referrer: any,
        referrer_percent: any,
        refcode: any
    ) {
        const {privKey: owner_private} = (WalletDb as any).generateKeyFromPassword(
            account_name,
            "owner",
            password
        );
        const {privKey: active_private} = (WalletDb as any).generateKeyFromPassword(
            account_name,
            "active",
            password
        );
        const {privKey: memo_private} = (WalletDb as any).generateKeyFromPassword(
            account_name,
            "memo",
            password
        );
        console.log("create account:", account_name);
        console.log(
            "new active pubkey",
            active_private.toPublicKey().toPublicKeyString()
        );
        console.log(
            "new owner pubkey",
            owner_private.toPublicKey().toPublicKeyString()
        );
        console.log(
            "new memo pubkey",
            memo_private.toPublicKey().toPublicKeyString()
        );

        return new Promise((resolve, reject) => {
            const create_account = () => {
                return (ApplicationApi as any)
                    .create_account(
                        owner_private.toPublicKey().toPublicKeyString(),
                        active_private.toPublicKey().toPublicKeyString(),
                        memo_private.toPublicKey().toPublicKeyString(),
                        account_name,
                        registrar, //registrar_id,
                        referrer, //referrer_id,
                        referrer_percent, //referrer_percent,
                        true //broadcast
                    )
                    .then(resolve)
                    .catch(reject);
            };

            if (registrar) {
                // using another user's account as registrar
                return create_account();
            } else {
                // using faucet

                let faucetAddress = (SettingsStore as any).getSetting(
                    "faucet_address"
                );
                if (
                    window &&
                    window.location &&
                    window.location.protocol === "https:"
                ) {
                    faucetAddress = faucetAddress.replace(/http:\/\//, "https://");
                }

                const create_account_promise = fetch(
                    faucetAddress + "/api/v1/accounts",
                    {
                        method: "post",
                        mode: "cors",
                        headers: {
                            Accept: "application/json",
                            "Content-type": "application/json"
                        },
                        body: JSON.stringify({
                            account: {
                                name: account_name,
                                owner_key: owner_private
                                    .toPublicKey()
                                    .toPublicKeyString(),
                                active_key: active_private
                                    .toPublicKey()
                                    .toPublicKeyString(),
                                memo_key: memo_private
                                    .toPublicKey()
                                    .toPublicKeyString(),
                                refcode: refcode,
                                referrer: referrer
                            }
                        })
                    }
                )
                    .then(r =>
                        r.json().then(res => {
                            if (!res || (res && (res as any).error)) {
                                reject((res as any).error);
                            } else {
                                resolve(res);
                            }
                        })
                    )
                    .catch(reject);

                return create_account_promise
                    .then((result: any) => {
                        if (result && result.error) {
                            reject(result.error);
                        } else {
                            resolve(result);
                        }
                    })
                    .catch((error: any) => {
                        reject(error);
                    });
            }
        });
    }

    createAccount(
        account_name: string,
        registrar: any,
        referrer: any,
        referrer_percent: any,
        refcode: any
    ) {
        if ((WalletDb as any).isLocked()) {
            const error = "wallet locked";
            return Promise.reject(error);
        }
        const owner_private = (WalletDb as any).generateNextKey();
        const active_private = (WalletDb as any).generateNextKey();
        const memo_private = (WalletDb as any).generateNextKey();

        const updateWallet = () => {
            const transaction = (WalletDb as any).transaction_update_keys();
            const p = (WalletDb as any).saveKeys(
                [owner_private, active_private, memo_private],
                transaction
            );
            return p.catch(() => transaction.abort());
        };

        const create_account = () => {
            return (ApplicationApi as any)
                .create_account(
                    owner_private.private_key.toPublicKey().toPublicKeyString(),
                    active_private.private_key.toPublicKey().toPublicKeyString(),
                    memo_private.private_key.toPublicKey().toPublicKeyString(),
                    account_name,
                    registrar, //registrar_id,
                    referrer, //referrer_id,
                    referrer_percent, //referrer_percent,
                    true //broadcast
                )
                .then(() => updateWallet());
        };

        if (registrar) {
            // using another user's account as registrar
            return create_account();
        } else {
            // using faucet

            let faucetAddress = (SettingsStore as any).getSetting("faucet_address");
            if (
                window &&
                window.location &&
                window.location.protocol === "https:"
            ) {
                faucetAddress = faucetAddress.replace(/http:\/\//, "https://");
            }

            const create_account_promise = fetch(
                faucetAddress + "/api/v1/accounts",
                {
                    method: "post",
                    mode: "cors",
                    headers: {
                        Accept: "application/json",
                        "Content-type": "application/json"
                    },
                    body: JSON.stringify({
                        account: {
                            name: account_name,
                            owner_key: owner_private.private_key
                                .toPublicKey()
                                .toPublicKeyString(),
                            active_key: active_private.private_key
                                .toPublicKey()
                                .toPublicKeyString(),
                            memo_key: active_private.private_key
                                .toPublicKey()
                                .toPublicKeyString(),
                            //"memo_key": memo_private.private_key.toPublicKey().toPublicKeyString(),
                            refcode: refcode,
                            referrer: referrer
                        }
                    })
                }
            ).then(r => r.json());

            return create_account_promise
                .then((result: any) => {
                    if (result.error) {
                        throw result.error;
                    }
                    return updateWallet();
                })
                .catch((error: any) => {
                    /*
                     * Since the account creation failed, we need to decrement the
                     * sequence used to generate private keys from the brainkey. Three
                     * keys were generated, so we decrement three times.
                     */
                    (WalletDb as any).decrementBrainKeySequence();
                    (WalletDb as any).decrementBrainKeySequence();
                    (WalletDb as any).decrementBrainKeySequence();
                    throw error;
                });
        }
    }

    claimVestingBalance(account: any, vb: any, forceAll = false) {
        const tr = new (TransactionBuilder as any)();

        let balance;
        let available_percentage: any;
        let available_amount: any;

        if (vb) {
            balance = vb.balance.amount;
            available_amount = balance;

            // Vesting is 100% available if:
            // - policy[0] is set to 2
            // - vesting_seconds is 0
            // - foreAll is set to true
            available_percentage =
                vb.policy[0] === 2 || vb.policy[1].vesting_seconds === 0 || forceAll
                    ? 1
                    : 0;

            // Vesting percentage needs to be checked further
            if (!available_percentage && vb.policy && vb.policy[0] === 1) {
                // cdd_vesting_policy
                const start = Math.floor(
                    new Date(vb.policy[1].start_claim + "Z").getTime() / 1000
                );
                const now = Math.floor(new Date().getTime() / 1000);

                if (start > 0) {
                    // Vesting has a specific start date.
                    // Vesting with locked value required to mautre fully before claiming
                    // Full vesting period must pass before it can be claimed.
                    // Calculate days left before a claim is possible
                    // Example asset is BRIDGE.BCO - 1.3.1564

                    const seconds_earned = now - start;
                    const seconds_period = vb.policy[1].vesting_seconds;

                    if (seconds_earned >= seconds_period) {
                        available_percentage = 1;
                    }
                } else {
                    // Vesting has no start time.
                    // Vesting balances has a vesting with maturing value
                    // If period is 0 we expect a 100% claimable balance
                    // otherwise we expect to be allowed to claim the matured percentage.

                    // Core is lazy calculating the vesting balance object, so we
                    // need to account for the time passed since it was last updated
                    const seconds_last_updated = Math.floor(
                        new Date(
                            vb.policy[1].coin_seconds_earned_last_update + "Z"
                        ).getTime() / 1000
                    );
                    const seconds_earned =
                        parseFloat(vb.policy[1].coin_seconds_earned) +
                        balance * (now - seconds_last_updated);
                    const seconds_period = vb.policy[1].vesting_seconds;

                    available_percentage = seconds_earned / (seconds_period * balance);

                    // Make sure we don't go over 1
                    available_percentage =
                        available_percentage > 1 ? 1 : available_percentage;
                }
                available_amount = Math.floor(balance * available_percentage);
            } else if (!available_percentage && vb.policy && vb.policy[0] === 0) {
                // linear_vesting_policy
                const start = Math.floor(
                    new Date(vb.policy[1].begin_timestamp + "Z").getTime() / 1000
                );
                const now = Math.floor(new Date().getTime() / 1000);
                const seconds_earned = Math.max(now - start, 0);
                const seconds_period = vb.policy[1].vesting_duration_seconds;
                const seconds_cliff = vb.policy[1].vesting_cliff_seconds;
                const vested_percentage =
                    seconds_earned >= seconds_period
                        ? 1
                        : seconds_earned < seconds_cliff
                        ? 0
                        : seconds_earned / seconds_period;
                const begin_balance = vb.policy[1].begin_balance;
                const claimed_amount = begin_balance - balance;
                available_amount = Math.max(
                    Math.floor(begin_balance * vested_percentage) - claimed_amount,
                    0
                );
            }
        }

        tr.add_type_operation("vesting_balance_withdraw", {
            fee: {amount: "0", asset_id: "1.3.0"},
            owner: account,
            vesting_balance: vb.id,
            amount: {
                amount: available_amount,
                asset_id: vb.balance.asset_id
            }
        });

        return (WalletDb as any)
            .process_transaction(tr, null, true)
            .then((result: any) => {
                void result;
            })
            .catch((err: any) => {
                console.log("vesting_balance_withdraw err:", err);
            });
    }

    /** @parm balances is an array of balance objects with two
        additional values: {vested_balance, public_key_string}
    */
    importBalance(account_name_or_id: any, balances: any[], broadcast: boolean) {
        return new Promise(resolve => {
            const account_lookup = FetchChain("getAccount", account_name_or_id);
            const unlock = (WalletUnlockActions as any).unlock();

            const p = Promise.all([unlock, account_lookup])
                .then((results: any) => {
                    const account = results[1];
                    if (account == void 0)
                        return Promise.reject(
                            "Unknown account " + account_name_or_id
                        );

                    const balance_claims: any[] = [];
                    const signer_pubkeys: any = {};
                    for (const balance of balances as any) {
                        const {vested_balance, public_key_string} = balance;

                        let total_claimed;
                        if (vested_balance) {
                            if (vested_balance.amount == 0)
                                // recently claimed
                                continue;

                            total_claimed = vested_balance.amount;
                        } else total_claimed = balance.balance.amount;

                        //assert
                        if (
                            vested_balance &&
                            vested_balance.asset_id != balance.balance.asset_id
                        )
                            throw new Error(
                                "Vested balance record and balance record asset_id missmatch"
                            );

                        signer_pubkeys[public_key_string] = true;
                        balance_claims.push({
                            fee: {amount: "0", asset_id: "1.3.0"},
                            deposit_to_account: account.get("id"),
                            balance_to_claim: balance.id,
                            balance_owner_key: public_key_string,
                            total_claimed: {
                                amount: total_claimed,
                                asset_id: balance.balance.asset_id
                            }
                        });
                    }

                    const tr = new (TransactionBuilder as any)();

                    for (const balance_claim of balance_claims) {
                        tr.add_type_operation("balance_claim", balance_claim);
                    }
                    // With a lot of balance claims the signing can take so Long
                    // the transaction will expire.  This will increase the timeout...
                    tr.set_expire_seconds(15 * 60 + balance_claims.length);
                    return (WalletDb as any)
                        .process_transaction(
                            tr,
                            Object.keys(signer_pubkeys),
                            broadcast
                        )
                        .then((result: any) => {
                            return result;
                        });
                })
                .catch(() => {});
            resolve(p);
        });
    }
}

export default new WalletActionsFacade();
