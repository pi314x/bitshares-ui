// TypeScript port of the legacy WalletDb.js (Phase 5,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes - every method
// body below is a line-for-line translation of the original, with `as
// any` casts added only where TS needs them (untyped bitsharesjs/idb-*
// helpers) and no behavior altered. Same `extends (BaseStore as any)`
// treatment as the other Alt.js stores already ported in this migration
// (BrainkeyStore.ts, BackupStore.ts, ImportKeysStore.ts).
//
// Security-sensitive per AGENTS.md, more than any other file in this
// migration: this is wallet unlock, private-key decryption, and
// transaction-signing. Per the Phase 5 methodology note ("wrap it behind
// a typed interface and add characterization tests first, then refactor
// internals with the safety net in place"), the in-memory crypto paths
// (validatePassword, changePassword, getBrainKey(Private),
// generateKeyFromPassword, getPrivateKey/decryptTcomb_PrivateKey) were
// characterized against the pre-port .js implementation in
// app/__tests__/wallets/walletDbCrypto-test.js before this port, and pass
// unchanged against this port. The IndexedDB/Web-Worker-dependent methods
// (onCreateWallet, saveKey, importKeysWorker, loadDbData, _updateWallet)
// were not characterization-tested (mocking a full IndexedDB + Worker
// round trip was judged not worth the added test fragility for a
// mechanical port) - those got an extra-careful line-by-line diff review
// against the original instead, and are flagged here for the human
// second-reviewer this phase's exit criteria call for. The raw `WalletDb`
// class is now a named export (in addition to the default-exported
// singleton, unchanged) purely so those characterization tests can
// construct/inspect it directly - not a behavior change.
import alt from "alt-instance";
import BaseStore from "stores/BaseStore";

import iDB from "idb-instance";
import idb_helper from "idb-helper";
import {cloneDeep} from "lodash-es";

import PrivateKeyStore from "stores/PrivateKeyStore";
import SettingsStore from "stores/SettingsStore";
import {WalletTcomb} from "./tcomb_structs";
import TransactionConfirmActions from "actions/TransactionConfirmActions";
import WalletUnlockActions from "actions/WalletUnlockActions";
import PrivateKeyActions from "actions/PrivateKeyActions";
import AccountActions from "actions/AccountActions";
import {ChainStore, PrivateKey, key, Aes} from "bitsharesjs";
import {Apis, ChainConfig} from "bitsharesjs-ws";
import AddressIndex from "stores/AddressIndex";
import SettingsActions from "actions/SettingsActions";
import {Notification} from "bitshares-ui-style-guide";
import counterpart from "counterpart";

let aes_private: any = null;
let _passwordKey: any = null;
// let transaction;

const TRACE = false;

let dictJson: any, AesWorker: any;
if (__ELECTRON__) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    AesWorker = require("worker-loader?inline=no-fallback!workers/AesWorker")
        .default;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    dictJson = require("common/dictionary_en.json");
}

/** Represents a single wallet and related indexedDb database operations. */
export class WalletDb extends (BaseStore as any) {
    state: any;
    confirm_transactions: boolean;
    generateNextKey_pubcache: any[];
    chainstore_account_ids_by_key: any;
    brainkey_look_ahead: number | undefined;
    generatingKey: boolean;

    constructor() {
        super();
        this.state = {wallet: null, saving_keys: false};
        // Confirm only works when there is a UI (this is for mocha unit tests)
        this.confirm_transactions = true;
        (ChainStore as any).subscribe(this.checkNextGeneratedKey.bind(this));
        this.generateNextKey_pubcache = [];
        // WalletDb use to be a plan old javascript class (not an Alt store) so
        // for now many methods need to be exported...
        this._export(
            "checkNextGeneratedKey",
            "getWallet",
            "onLock",
            "isLocked",
            "decryptTcomb_PrivateKey",
            "getPrivateKey",
            "process_transaction",
            "transaction_update",
            "transaction_update_keys",
            "getBrainKey",
            "getBrainKeyPrivate",
            "onCreateWallet",
            "validatePassword",
            "changePassword",
            "generateNextKey",
            "incrementBrainKeySequence",
            "saveKeys",
            "saveKey",
            "setWalletModified",
            "setBackupDate",
            "setBrainkeyBackupDate",
            "_updateWallet",
            "loadDbData",
            "importKeysWorker",
            "resetBrainKeySequence",
            "decrementBrainKeySequence",
            "generateKeyFromPassword"
        );
        this.generatingKey = false;
    }

    /** Discover derived keys that are not in this wallet */
    checkNextGeneratedKey() {
        if (!this.state.wallet) return;
        if (!aes_private) return; // locked
        if (!this.state.wallet.encrypted_brainkey) return; // no brainkey
        if (
            this.chainstore_account_ids_by_key ===
            (ChainStore as any).account_ids_by_key
        )
            return; // no change
        this.chainstore_account_ids_by_key = (ChainStore as any).account_ids_by_key;
        // Helps to ensure we are looking at an un-used key
        try {
            this.generateNextKey(false /*save*/);
        } catch (e) {
            console.error(e);
        }
    }

    getWallet() {
        return this.state.wallet;
    }

    onLock() {
        _passwordKey = null;
        aes_private = null;
    }

    isLocked() {
        return !(!!aes_private || !!_passwordKey);
    }

    decryptTcomb_PrivateKey(private_key_tcomb: any) {
        if (!private_key_tcomb) return null;
        if (this.isLocked()) throw new Error("wallet locked");
        if (_passwordKey && _passwordKey[private_key_tcomb.pubkey]) {
            return _passwordKey[private_key_tcomb.pubkey];
        }
        const private_key_hex = aes_private.decryptHex(
            private_key_tcomb.encrypted_key
        );
        return (PrivateKey as any).fromBuffer(
            new Buffer(private_key_hex, "hex")
        );
    }

    /** @return ecc/PrivateKey or null */
    getPrivateKey(public_key: any) {
        if (_passwordKey) return _passwordKey[public_key];
        if (!public_key) return null;
        if (public_key.Q) public_key = public_key.toPublicKeyString();
        const private_key_tcomb = (PrivateKeyStore as any).getTcomb_byPubkey(
            public_key
        );
        if (!private_key_tcomb) return null;
        return this.decryptTcomb_PrivateKey(private_key_tcomb);
    }

    process_transaction(
        tr: any,
        signer_pubkeys: any,
        broadcast: any,
        extra_keys: any[] = []
    ) {
        const passwordLogin = (SettingsStore as any)
            .getState()
            .settings.get("passwordLogin");

        if (
            !passwordLogin &&
            this.state.wallet &&
            (Apis as any).instance().chain_id !== this.state.wallet.chain_id
        )
            return Promise.reject(
                "Mismatched chain_id; expecting " +
                    this.state.wallet.chain_id +
                    ", but got " +
                    (Apis as any).instance().chain_id
            );

        return (WalletUnlockActions as any)
            .unlock()
            .then(() => {
                (AccountActions as any).tryToSetCurrentAccount();
                return Promise.all([
                    tr.set_required_fees(),
                    tr.update_head_block()
                ]).then(() => {
                    const signer_pubkeys_added: any = {};
                    if (signer_pubkeys) {
                        // Balance claims are by address, only the private
                        // key holder can know about these additional
                        // potential keys.
                        const pubkeys = (PrivateKeyStore as any).getPubkeys_having_PrivateKey(
                            signer_pubkeys
                        );
                        if (!pubkeys.length)
                            throw new Error("Missing signing key");

                        for (const pubkey_string of pubkeys) {
                            const private_key = this.getPrivateKey(
                                pubkey_string
                            );
                            tr.add_signer(private_key, pubkey_string);
                            signer_pubkeys_added[pubkey_string] = true;
                        }
                    }

                    return tr
                        .get_potential_signatures()
                        .then(({pubkeys, addys}: any) => {
                            const my_pubkeys = (PrivateKeyStore as any).getPubkeys_having_PrivateKey(
                                pubkeys.concat(extra_keys),
                                addys
                            );

                            //{//Testing only, don't send All public keys!
                            //    let pubkeys_all = PrivateKeyStore.getPubkeys() // All public keys
                            //    tr.get_required_signatures(pubkeys_all).then( required_pubkey_strings =>
                            //        console.log('get_required_signatures all\t',required_pubkey_strings.sort(), pubkeys_all))
                            //    tr.get_required_signatures(my_pubkeys).then( required_pubkey_strings =>
                            //        console.log('get_required_signatures normal\t',required_pubkey_strings.sort(), pubkeys))
                            //}
                            return tr
                                .get_required_signatures(my_pubkeys)
                                .then((required_pubkeys: any) => {
                                    for (const pubkey_string of required_pubkeys) {
                                        if (signer_pubkeys_added[pubkey_string])
                                            continue;
                                        const private_key = this.getPrivateKey(
                                            pubkey_string
                                        );
                                        if (!private_key)
                                            // This should not happen, get_required_signatures will only
                                            // returned keys from my_pubkeys
                                            throw new Error(
                                                "Missing signing key for " +
                                                    pubkey_string
                                            );
                                        tr.add_signer(
                                            private_key,
                                            pubkey_string
                                        );
                                    }
                                });
                        })
                        .then(() => {
                            if (broadcast) {
                                if (this.confirm_transactions) {
                                    const p = new Promise((resolve, reject) => {
                                        (TransactionConfirmActions as any).confirm(
                                            tr,
                                            resolve,
                                            reject
                                        );
                                    });
                                    return p;
                                } else return tr.broadcast();
                            } else return tr.serialize();
                        });
                });
            })
            .catch((e: any) => {
                console.error(e);
            });
    }

    transaction_update() {
        const transaction = (iDB as any)
            .instance()
            .db()
            .transaction(["wallet"], "readwrite");
        return transaction;
    }

    transaction_update_keys() {
        const transaction = (iDB as any)
            .instance()
            .db()
            .transaction(["wallet", "private_keys"], "readwrite");
        return transaction;
    }

    getBrainKey() {
        const wallet = this.state.wallet;
        if (!wallet.encrypted_brainkey) throw new Error("missing brainkey");
        if (!aes_private) throw new Error("wallet locked");
        const brainkey_plaintext = aes_private.decryptHexToText(
            wallet.encrypted_brainkey
        );
        return brainkey_plaintext;
    }

    getBrainKeyPrivate(brainkey_plaintext: string = this.getBrainKey()) {
        if (!brainkey_plaintext) throw new Error("missing brainkey");
        return (PrivateKey as any).fromSeed(
            (key as any).normalize_brainKey(brainkey_plaintext)
        );
    }

    onCreateWallet(
        password_plaintext: string,
        brainkey_plaintext?: string,
        unlock = false,
        public_name = "default"
    ) {
        const walletCreateFct = (dictionary: any) => {
            return new Promise<void>((resolve, reject) => {
                if (typeof password_plaintext !== "string")
                    throw new Error("password string is required");

                let brainkey_backup_date;
                if (brainkey_plaintext) {
                    if (typeof brainkey_plaintext !== "string")
                        throw new Error("Brainkey must be a string");

                    if (brainkey_plaintext.trim() === "")
                        throw new Error("Brainkey can not be an empty string");

                    if (brainkey_plaintext.length < 50)
                        throw new Error(
                            "Brainkey must be at least 50 characters long"
                        );

                    // The user just provided the Brainkey so this avoids
                    // bugging them to back it up again.
                    brainkey_backup_date = new Date();
                }
                const password_aes = (Aes as any).fromSeed(password_plaintext);

                const encryption_buffer = (key as any)
                    .get_random_key()
                    .toBuffer();
                // encryption_key is the global encryption key (does not change even if the passsword changes)
                const encryption_key = password_aes.encryptToHex(
                    encryption_buffer
                );
                // If unlocking, local_aes_private will become the global aes_private object
                const local_aes_private = (Aes as any).fromSeed(
                    encryption_buffer
                );

                if (!brainkey_plaintext)
                    brainkey_plaintext = (key as any).suggest_brain_key(
                        dictionary.en
                    );
                else
                    brainkey_plaintext = (key as any).normalize_brainKey(
                        brainkey_plaintext
                    );
                const brainkey_private = this.getBrainKeyPrivate(
                    brainkey_plaintext
                );
                const brainkey_pubkey = brainkey_private
                    .toPublicKey()
                    .toPublicKeyString();
                const encrypted_brainkey = local_aes_private.encryptToHex(
                    brainkey_plaintext
                );

                const password_private = (PrivateKey as any).fromSeed(
                    password_plaintext
                );
                const password_pubkey = password_private
                    .toPublicKey()
                    .toPublicKeyString();

                const wallet = {
                    public_name,
                    password_pubkey,
                    encryption_key,
                    encrypted_brainkey,
                    brainkey_pubkey,
                    brainkey_sequence: 0,
                    brainkey_backup_date,
                    created: new Date(),
                    last_modified: new Date(),
                    chain_id: (Apis as any).instance().chain_id
                };
                (WalletTcomb as any)(wallet); // validation
                const transaction = this.transaction_update();
                const add = (idb_helper as any).add(
                    transaction.objectStore("wallet"),
                    wallet
                );
                const end = (idb_helper as any)
                    .on_transaction_end(transaction)
                    .then(() => {
                        this.state.wallet = wallet;
                        this.setState({wallet});
                        if (unlock) {
                            aes_private = local_aes_private;
                            (WalletUnlockActions as any)
                                .unlock()
                                .catch(() => {});
                        }
                    });
                Promise.all([add, end])
                    .then(() => {
                        resolve();
                    })
                    .catch((err: any) => {
                        reject(err);
                    });
            });
        };

        if (__ELECTRON__) {
            return walletCreateFct(dictJson);
        } else {
            const dictionaryPromise = brainkey_plaintext
                ? null
                : fetch(`${__BASE_URL__}dictionary.json`);
            return Promise.all([dictionaryPromise])
                .then(res => {
                    return brainkey_plaintext
                        ? walletCreateFct(null)
                        : (res[0] as any).json().then(walletCreateFct);
                })
                .catch(err => {
                    console.log("unable to fetch dictionary.json", err);
                });
        }
    }

    generateKeyFromPassword(
        accountName: string,
        role: string,
        password: string
    ) {
        const seed = accountName + role + password;
        const privKey = (PrivateKey as any).fromSeed(seed);
        const pubKey = privKey.toPublicKey().toString();

        return {privKey, pubKey};
    }

    /** This also serves as 'unlock' */
    validatePassword(
        password: string,
        unlock = false,
        account: string | null = null,
        roles: string[] = ["active", "owner", "memo"]
    ): any {
        if (account) {
            let id = 0;
            function setKey(role: string, priv: any, pub: any) {
                if (!_passwordKey) _passwordKey = {};
                _passwordKey[pub] = priv;

                id++;
                (PrivateKeyStore as any).setPasswordLoginKey({
                    pubkey: pub,
                    import_account_names: [account],
                    encrypted_key: null,
                    id,
                    brainkey_sequence: null
                });
            }

            /* Check if the user tried to login with a private key */
            let fromWif: any;
            try {
                fromWif = (PrivateKey as any).fromWif(password);
            } catch (err) {}
            const acc = (ChainStore as any).getAccount(account, false);
            let key: any;
            if (fromWif) {
                key = {
                    privKey: fromWif,
                    pubKey: fromWif.toPublicKey().toString()
                };
            }

            /* Test the pubkey for each role against either the wif key, or the password generated keys */
            roles.forEach(role => {
                if (!fromWif) {
                    key = this.generateKeyFromPassword(account, role, password);
                }

                let foundRole = false;

                if (acc) {
                    if (role === "memo") {
                        if (acc.getIn(["options", "memo_key"]) === key.pubKey) {
                            setKey(role, key.privKey, key.pubKey);
                            foundRole = true;
                        }
                    } else {
                        acc.getIn([role, "key_auths"]).forEach((auth: any) => {
                            if (auth.get(0) === key.pubKey) {
                                setKey(role, key.privKey, key.pubKey);
                                foundRole = true;
                                return false;
                            }
                        });

                        if (!foundRole) {
                            const alsoCheckRole =
                                role === "active" ? "owner" : "active";
                            acc.getIn([alsoCheckRole, "key_auths"]).forEach(
                                (auth: any) => {
                                    if (auth.get(0) === key.pubKey) {
                                        setKey(
                                            alsoCheckRole,
                                            key.privKey,
                                            key.pubKey
                                        );
                                        foundRole = true;
                                        return false;
                                    }
                                }
                            );
                        }
                    }
                }
            });

            /* If the unlock fails and the user has a wallet, check the password against the wallet as well */
            if (!_passwordKey && !!this.state.wallet) {
                const {success, cloudMode} = this.validatePassword(
                    password,
                    true
                );
                if (success && !cloudMode) {
                    Notification.success({
                        message: counterpart.translate("wallet.local_switch")
                    });
                    (SettingsActions as any).changeSetting({
                        setting: "passwordLogin",
                        value: false
                    });
                    return {success: true, cloudMode: false};
                }
            }

            return {success: !!_passwordKey, cloudMode: true};
        } else {
            const wallet = this.state.wallet;
            try {
                const password_private = (PrivateKey as any).fromSeed(password);
                const password_pubkey = password_private
                    .toPublicKey()
                    .toPublicKeyString();
                if (wallet.password_pubkey !== password_pubkey) return false;
                if (unlock) {
                    const password_aes = (Aes as any).fromSeed(password);
                    const encryption_plainbuffer = password_aes.decryptHexToBuffer(
                        wallet.encryption_key
                    );
                    aes_private = (Aes as any).fromSeed(encryption_plainbuffer);
                }
                return {success: true, cloudMode: false};
            } catch (e) {
                console.error(e);
                return {success: false, cloudMode: false};
            }
        }
    }

    /** This may lock the wallet unless <b>unlock</b> is used. */
    changePassword(old_password: string, new_password: string, unlock = false) {
        return new Promise<any>(resolve => {
            const wallet = this.state.wallet;
            const {success} = this.validatePassword(old_password);
            if (!success) throw new Error("wrong password");

            const old_password_aes = (Aes as any).fromSeed(old_password);
            const new_password_aes = (Aes as any).fromSeed(new_password);

            if (!wallet.encryption_key)
                // This change pre-dates the live chain..
                throw new Error(
                    "This wallet does not support the change password feature."
                );
            const encryption_plainbuffer = old_password_aes.decryptHexToBuffer(
                wallet.encryption_key
            );
            wallet.encryption_key = new_password_aes.encryptToHex(
                encryption_plainbuffer
            );

            const new_password_private = (PrivateKey as any).fromSeed(
                new_password
            );
            wallet.password_pubkey = new_password_private
                .toPublicKey()
                .toPublicKeyString();

            if (unlock) {
                aes_private = (Aes as any).fromSeed(encryption_plainbuffer);
            } else {
                // new password, make sure the wallet gets locked
                aes_private = null;
            }
            resolve(this.setWalletModified());
        });
    }

    /** @throws "missing brainkey", "wallet locked"
        @return { private_key, sequence }
    */
    generateNextKey(save = true): any {
        if (this.generatingKey) return;
        this.generatingKey = true;
        const brainkey = this.getBrainKey();
        const wallet = this.state.wallet;
        let sequence = Math.max(wallet.brainkey_sequence, 0);
        let used_sequence: number | null = null;
        // Skip ahead in the sequence if any keys are found in use
        // Slowly look ahead (1 new key per block) to keep the wallet fast after unlocking
        this.brainkey_look_ahead = Math.min(
            10,
            (this.brainkey_look_ahead || 0) + 1
        );
        /* If sequence is 0 this is the first lookup, so check at least the first 10 positions */
        const loopMax = !sequence
            ? Math.max(sequence + this.brainkey_look_ahead, 10)
            : sequence + this.brainkey_look_ahead;
        // console.log("generateNextKey, save:", save, "sequence:", sequence, "loopMax", loopMax, "brainkey_look_ahead:", this.brainkey_look_ahead);

        for (let i = sequence; i < loopMax; i++) {
            const private_key = (key as any).get_brainPrivateKey(brainkey, i);
            const pubkey = this.generateNextKey_pubcache[i]
                ? this.generateNextKey_pubcache[i]
                : (this.generateNextKey_pubcache[
                      i
                  ] = private_key.toPublicKey().toPublicKeyString());

            const next_key = (ChainStore as any).getAccountRefsOfKey(pubkey);
            // TODO if ( next_key === undefined ) return undefined

            /* If next_key exists, it means the generated private key controls an account, so we need to save it */
            if (next_key && next_key.size) {
                used_sequence = i;
                console.log(
                    "WARN: Private key sequence " +
                        used_sequence +
                        " in-use. " +
                        "I am saving the private key and will go onto the next one."
                );
                this.saveKey(private_key, used_sequence);
                // this.brainkey_look_ahead++;
            }
        }
        if (used_sequence !== null) {
            wallet.brainkey_sequence = used_sequence + 1;
            this._updateWallet();
        }
        sequence = Math.max(wallet.brainkey_sequence, 0);
        const private_key = (key as any).get_brainPrivateKey(
            brainkey,
            sequence
        );
        if (save && private_key) {
            // save deterministic private keys ( the user can delete the brainkey )
            // console.log("** saving a key and incrementing brainkey sequence **")
            this.saveKey(private_key, sequence);
            //TODO  .error( error => ErrorStore.onAdd( "wallet", "saveKey", error ))
            this.incrementBrainKeySequence();
        }
        this.generatingKey = false;
        return {private_key, sequence};
    }

    incrementBrainKeySequence(transaction?: any) {
        const wallet = this.state.wallet;
        // increment in RAM so this can't be out-of-sync
        wallet.brainkey_sequence++;
        // update last modified
        return this._updateWallet(transaction);
        //TODO .error( error => ErrorStore.onAdd( "wallet", "incrementBrainKeySequence", error ))
    }

    decrementBrainKeySequence() {
        const wallet = this.state.wallet;
        // increment in RAM so this can't be out-of-sync
        wallet.brainkey_sequence = Math.max(0, wallet.brainkey_sequence - 1);
        return this._updateWallet();
    }

    resetBrainKeySequence() {
        const wallet = this.state.wallet;
        // increment in RAM so this can't be out-of-sync
        wallet.brainkey_sequence = 0;
        console.log("reset sequence", wallet.brainkey_sequence);
        // update last modified
        return this._updateWallet();
    }

    importKeysWorker(private_key_objs: any[]) {
        return new Promise<void>((resolve, reject) => {
            const pubkeys = [];
            for (const private_key_obj of private_key_objs)
                pubkeys.push(private_key_obj.public_key_string);
            const addyIndexPromise = (AddressIndex as any).addAll(pubkeys);

            const private_plainhex_array = [];
            for (const private_key_obj of private_key_objs) {
                private_plainhex_array.push(private_key_obj.private_plainhex);
            }
            if (!__ELECTRON__) {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                AesWorker = require("worker-loader!workers/AesWorker").default;
            }
            const worker = new AesWorker();
            worker.postMessage({
                private_plainhex_array,
                key: aes_private.key,
                iv: aes_private.iv
            });
            // `worker.onmessage` below is an arrow function, so `this`
            // inside it already refers to this store instance - the
            // original's `_this = this` alias was unnecessary even there
            // (arrow functions close over the lexical `this`), so it's
            // dropped here rather than tripping @typescript-eslint/no-this-alias.
            this.setState({saving_keys: true});
            worker.onmessage = (event: any) => {
                try {
                    console.log("Preparing for private keys save");
                    const private_cipherhex_array = event.data;
                    const enc_private_key_objs = [];
                    for (let i = 0; i < private_key_objs.length; i++) {
                        const private_key_obj = private_key_objs[i];
                        /* eslint-disable prefer-const */
                        let {
                            import_account_names,
                            public_key_string,
                            private_plainhex
                        } = private_key_obj;
                        /* eslint-enable prefer-const */
                        const private_cipherhex = private_cipherhex_array[i];
                        if (!public_key_string) {
                            // console.log('WARN: public key was not provided, this will incur slow performance')
                            const private_key = (PrivateKey as any).fromHex(
                                private_plainhex
                            );
                            const public_key = private_key.toPublicKey(); // S L O W
                            public_key_string = public_key.toPublicKeyString();
                        } else if (
                            public_key_string.indexOf(
                                (ChainConfig as any).address_prefix
                            ) != 0
                        )
                            throw new Error(
                                "Public Key should start with " +
                                    (ChainConfig as any).address_prefix
                            );

                        const private_key_object = {
                            import_account_names,
                            encrypted_key: private_cipherhex,
                            pubkey: public_key_string
                            // null brainkey_sequence
                        };
                        enc_private_key_objs.push(private_key_object);
                    }
                    console.log("Saving private keys", new Date().toString());
                    const transaction = this.transaction_update_keys();
                    const insertKeysPromise = (idb_helper as any).on_transaction_end(
                        transaction
                    );
                    try {
                        const duplicate_count = (PrivateKeyStore as any).addPrivateKeys_noindex(
                            enc_private_key_objs,
                            transaction
                        );
                        if (private_key_objs.length != duplicate_count)
                            this.setWalletModified(transaction);
                        this.setState({saving_keys: false});
                        resolve(
                            Promise.all([
                                insertKeysPromise,
                                addyIndexPromise
                            ]).then(() => {
                                console.log(
                                    "Done saving keys",
                                    new Date().toString()
                                );
                                // return { duplicate_count }
                            })
                        );
                    } catch (e) {
                        transaction.abort();
                        console.error(e);
                        reject(e);
                    }
                } catch (e) {
                    console.error("AesWorker.encrypt", e);
                }
            };
        });
    }

    saveKeys(
        private_keys: any[],
        transaction: any,
        public_key_string?: string
    ) {
        const promises = [];
        for (const private_key_record of private_keys) {
            promises.push(
                this.saveKey(
                    private_key_record.private_key,
                    private_key_record.sequence,
                    null, //import_account_names
                    public_key_string,
                    transaction
                )
            );
        }
        return Promise.all(promises);
    }

    saveKey(
        private_key: any,
        brainkey_sequence: number,
        import_account_names?: any,
        public_key_string?: string,
        transaction: any = this.transaction_update_keys()
    ) {
        const private_cipherhex = aes_private.encryptToHex(
            private_key.toBuffer()
        );
        // Original also read `this.state.wallet` into a local `wallet`
        // here - confirmed dead, dropped (never referenced anywhere else
        // in this method).
        if (!public_key_string) {
            //S L O W
            // console.log('WARN: public key was not provided, this may incur slow performance')
            const public_key = private_key.toPublicKey();
            public_key_string = public_key.toPublicKeyString();
        } else if (
            public_key_string.indexOf((ChainConfig as any).address_prefix) != 0
        )
            throw new Error(
                "Public Key should start with " +
                    (ChainConfig as any).address_prefix
            );

        const private_key_object = {
            import_account_names,
            encrypted_key: private_cipherhex,
            pubkey: public_key_string,
            brainkey_sequence
        };
        const p1 = (PrivateKeyActions as any)
            .addKey(private_key_object, transaction)
            .then((ret: any) => {
                if (TRACE)
                    console.log("... WalletDb.saveKey result", ret.result);
                return ret;
            });
        return p1;
    }

    setWalletModified(transaction?: any) {
        return this._updateWallet(transaction);
    }

    setBackupDate() {
        const wallet = this.state.wallet;
        wallet.backup_date = new Date();
        return this._updateWallet();
    }

    setBrainkeyBackupDate() {
        const wallet = this.state.wallet;
        wallet.brainkey_backup_date = new Date();
        return this._updateWallet();
    }

    /** Saves wallet object to disk.  Always updates the last_modified date. */
    _updateWallet(transaction: any = this.transaction_update()) {
        const wallet = this.state.wallet;
        if (!wallet) {
            reject("missing wallet");
            return;
        }
        //DEBUG console.log('... wallet',wallet)
        const wallet_clone = cloneDeep(wallet);
        wallet_clone.last_modified = new Date();

        (WalletTcomb as any)(wallet_clone); // validate

        const wallet_store = transaction.objectStore("wallet");
        const p = (idb_helper as any).on_request_end(
            wallet_store.put(wallet_clone)
        );
        const p2 = (idb_helper as any)
            .on_transaction_end(transaction)
            .then(() => {
                this.state.wallet = wallet_clone;
                this.setState({wallet: wallet_clone});
            });
        return Promise.all([p, p2]);
    }

    /** This method may be called again should the main database change */
    loadDbData() {
        return (idb_helper as any).cursor("wallet", (cursor: any) => {
            if (!cursor) return false;
            const wallet = cursor.value;
            // Convert anything other than a string or number back into its proper type
            wallet.created = new Date(wallet.created);
            wallet.last_modified = new Date(wallet.last_modified);
            wallet.backup_date = wallet.backup_date
                ? new Date(wallet.backup_date)
                : null;
            wallet.brainkey_backup_date = wallet.brainkey_backup_date
                ? new Date(wallet.brainkey_backup_date)
                : null;
            try {
                (WalletTcomb as any)(wallet);
            } catch (e) {
                console.log("WalletDb format error", e);
            }
            this.state.wallet = wallet;
            this.setState({wallet});
            return false; //stop iterating
        });
    }
}

const WalletDbWrapped: any = (alt as any).createStore(WalletDb, "WalletDb");
export default WalletDbWrapped;

function reject(error: string): never {
    console.error("----- WalletDb reject error -----", error);
    throw new Error(error);
}
