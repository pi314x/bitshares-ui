// TypeScript/functional-component port of the legacy ImportKeys.jsx
// (Phase 5, docs/UI_MIGRATION_PLAN.md), the largest file in Wallet/.
// Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: this is the private-key import flow
// (BTS 1.0 `wallet_export_keys` JSON, hosted-wallet backup JSON, and raw
// WIF paste), decrypting keys with `Aes.fromSeed(password)` and handing
// them to `WalletDb.importKeysWorker` exactly as before. Decrypted key
// material lives only in this component's own state (mirrored via
// `stateRef` below, never logged beyond the original's own
// `console.error`/`console.log` calls it already had.
//
// The original directly mutates `this.state.imported_keys_public` and
// `this.state.keys_to_account` in several places (`_decryptPrivateKeys`,
// `addByPattern`, `_saveImport`) *without* an immediate `setState` call,
// relying on a *later* `setState`/prop-driven re-render to pick up the
// accumulated mutations - the same "live mutable state bag" pattern
// already established for `WalletCreate.tsx`'s `CreateNewWallet`.
// Replicated the same way here: a `useRef`-held mutable state object plus
// a render-triggering counter, so direct mutations followed by any later
// state update (or, here, the `ImportKeysStore`-driven re-render from
// `useAltStore`) are visible exactly when the original would show them.
//
// PRESERVED BUG (not fixed - flagged for the human second-reviewer):
// `_passwordCheck` reads `this.refs.password.value` where `password` is a
// ref to an antd `Input` *component instance*, not a DOM node. antd 3.x's
// `Input` keeps the typed value in `this.state.value` internally (see
// node_modules/antd/lib/input/Input.js) and never exposes a plain
// `.value` property on the instance - so this read is always `undefined`,
// meaning a real (non-empty) password typed into the "BTS 1.0 wallet
// backup password" field is *never actually read* here; only the
// automatic empty-password attempt (called before this field has even
// mounted, when the ref is still null and the `: ""` fallback applies)
// behaves as intended. This is almost certainly a real, pre-existing bug
// in this legacy/rare import path - not introduced by this port. Compare
// `onWif`, a few lines away, which correctly reads
// `this.refs.wifInput.state.value` (the `.state.value` this same file
// otherwise knows is the right way to read an antd `Input`'s value).
// Replicated exactly: `passwordInputRef.current.value` (not `.state
// .value`), so this port has the identical (non-)behavior.
//
// PRESERVED BUG #2 (not fixed - also flagged for the human
// second-reviewer): `_parseWalletJson` (the "hosted BTS 1.0 wallet
// backup" JSON parser) references `file.name` (three call sites) and,
// after its main loop, a bare `enckeys.length` - neither `file` nor that
// `enckeys` binding is ever actually in scope in the original method
// (`enckeys` is declared with `let` *inside* an `if` block earlier,
// block-scoping it away from the later reference; `file` isn't declared
// anywhere in this method at all). In the original .js, evaluating either
// throws a real `ReferenceError` before the intended descriptive message
// is even built, which the method's own `catch (e) { throw e.message ||
// e; }` re-throws as the string "file is not defined" or "enckeys is not
// defined" - a confusing, unintended error message, not the "wallet
// backup is missing X" message the code was clearly trying to produce.
// Net effect: this parser can only ever succeed if the uploaded JSON is
// missing `encrypted_brainkey` (the one check that throws *before* any
// out-of-scope reference), in which case it correctly reports "Please use
// a BTS 1.0 wallet_export_keys file instead" - every other input hits one
// of the ReferenceErrors. TypeScript can't compile an actual reference to
// a genuinely undeclared identifier, so `referenceErrorLikeOriginal()`
// below reproduces the identical *observable* effect (the same thrown
// message text) without changing when/whether the method throws.
import * as React from "react";
import cname from "classnames";
import {PrivateKey, Aes, PublicKey, FetchChain, hash} from "bitsharesjs";
import AccountApi from "api/accountApi";
import {ChainConfig} from "bitsharesjs-ws";
import PrivateKeyStore from "stores/PrivateKeyStore";
import WalletUnlockActions from "actions/WalletUnlockActions";
import {WalletCreate} from "components/Wallet/WalletCreate";
import LoadingIndicator from "components/LoadingIndicator";
import Translate from "react-translate-component";
import counterpart from "counterpart";

import BalanceClaimActive from "../Wallet/BalanceClaimActive";
import BalanceClaimActiveActions from "actions/BalanceClaimActiveActions";
import BalanceClaimAssetTotal from "components/Wallet/BalanceClaimAssetTotal";
import WalletDb from "stores/WalletDb";
import ImportKeysStore from "stores/ImportKeysStore";

import {Notification} from "bitshares-ui-style-guide";

import GenesisFilter from "chain/GenesisFilter";

import {Button, Input} from "bitshares-ui-style-guide";
import {useAltStore} from "../../next/hooks/useAltStore";

require("./ImportKeys.scss");

const import_keys_assert_checking = false;

const KeyCount = ({key_count}: {key_count: number}) => {
    if (!key_count) return <span />;
    return <span>Found {key_count} private keys</span>;
};

const WIF_KEY_LENGTH = 51;

interface ImportKeysState {
    keys_to_account: {
        [hex: string]: {account_names: string[]; public_key_string: string};
    };
    no_file: boolean;
    account_keys: any[];
    reset_file_name: number;
    reset_password: number;
    password_checksum: string | null;
    import_file_message: any;
    import_password_message: any;
    imported_keys_public: {[pubkey: string]: boolean};
    key_text_message: string | null;
    associatedAccount: string[] | null;
    errorTextMessage: string | null;
    genesis_filtering: boolean;
    genesis_filter_status: any[];
    genesis_filter_finished: boolean | undefined;
    genesis_filter_initalizing?: boolean;
    importSuccess: boolean;
}

function getInitialState(
    prevState: ImportKeysState | null,
    keep_file_name = false
): ImportKeysState {
    return {
        keys_to_account: {},
        no_file: true,
        account_keys: [],
        //brainkey: null,
        //encrypted_brainkey: null,
        reset_file_name:
            keep_file_name && prevState
                ? prevState.reset_file_name
                : Date.now(),
        reset_password: Date.now(),
        password_checksum: null,
        import_file_message: null,
        import_password_message: null,
        imported_keys_public: {},
        key_text_message: null,
        associatedAccount: null,
        errorTextMessage: null,
        genesis_filtering: false,
        genesis_filter_status: [],
        genesis_filter_finished: undefined,
        importSuccess: false
    };
}

// PRESERVED BUG (not fixed - see the file header and
// docs/UI_MIGRATION_PLAN.md): `_parseWalletJson`'s original referenced
// `file.name` and a post-loop `enckeys.length` that are never actually in
// scope in that method - both are genuine ReferenceErrors in the original
// .js (TypeScript won't compile a real undeclared-identifier reference,
// so this helper reproduces the identical *observable* effect: a thrown
// Error whose `.message` is exactly what `(new ReferenceError(name + "
// is not defined")).message` would be, which is what the original's own
// `catch (e) { throw e.message || e; }` re-throws in practice).
function referenceErrorLikeOriginal(name: string): Error {
    return new ReferenceError(`${name} is not defined`);
}

function ImportKeys({privateKey = true}: {privateKey?: boolean}) {
    const {importing} = useAltStore<any>(ImportKeysStore as any);

    const stateRef = React.useRef<ImportKeysState>(
        getInitialState(null, false)
    );
    const [, forceRenderTick] = React.useState(0);
    const rerender = () => forceRenderTick(n => n + 1);
    const setState = (
        patch: Partial<ImportKeysState>,
        callback?: () => void
    ) => {
        Object.assign(stateRef.current, patch);
        rerender();
        if (callback) callback();
    };

    const wifInputRef = React.useRef<any>(null);
    const passwordInputRef = React.useRef<any>(null);

    const updateOnChange = () => {
        (BalanceClaimActiveActions as any).setPubkeys(
            Object.keys(stateRef.current.imported_keys_public)
        );
    };

    const reset = (e?: any, keep_file_name?: boolean) => {
        if (e) e.preventDefault();
        const newState = getInitialState(stateRef.current, keep_file_name);
        setState(newState, updateOnChange);
    };

    const onCancel = (e?: any) => {
        if (e) e.preventDefault();
        setState(getInitialState(stateRef.current, false));
    };

    const getImportAccountKeyCount = (
        keys_to_account: ImportKeysState["keys_to_account"]
    ) => {
        const account_keycount: {[name: string]: number} = {};
        let found = false;
        for (const key in keys_to_account)
            for (const account_name of keys_to_account[key].account_names) {
                account_keycount[account_name] =
                    (account_keycount[account_name] || 0) + 1;
                found = true;
            }
        return found ? account_keycount : null;
    };

    /** BTS 1.0 client wallet_export_keys format. */
    const _parseImportKeyUpload = (
        json_contents: any,
        file_name: string,
        update_state: (patch: any) => void
    ) => {
        let password_checksum, unfiltered_account_keys;
        try {
            password_checksum = json_contents.password_checksum;
            if (!password_checksum)
                throw file_name + " is an unrecognized format";

            if (!Array.isArray(json_contents.account_keys))
                throw file_name + " is an unrecognized format";

            unfiltered_account_keys = json_contents.account_keys;
        } catch (e: any) {
            throw e.message || e;
        }

        // BTS 1.0 wallets may have a lot of generated but unused keys or spent TITAN addresses making
        // wallets so large it is was not possible to use the JavaScript wallets with them.

        const genesis_filter = new (GenesisFilter as any)();
        if (!genesis_filter.isAvailable()) {
            update_state({
                password_checksum,
                account_keys: unfiltered_account_keys,
                genesis_filter_finished: true,
                genesis_filtering: false
            });
            return;
        }
        setState(
            {genesis_filter_initalizing: true} as any,
            () =>
                // setTimeout(()=>
                genesis_filter.init(() => {
                    const filter_status =
                        stateRef.current.genesis_filter_status;

                    // FF < version 41 does not support worker threads internals (like blob urls)
                    // let GenesisFilterWorker = require("worker-loader!workers/GenesisFilterWorker")
                    // let worker = new GenesisFilterWorker
                    // worker.postMessage({
                    //     account_keys: unfiltered_account_keys,
                    //     bloom_filter: genesis_filter.bloom_filter
                    // })
                    // worker.onmessage = event => { try {
                    //     let { status, account_keys } = event.data
                    //     // ...
                    // } catch( e ) { console.error('GenesisFilterWorker', e) }}

                    const account_keys = unfiltered_account_keys;
                    genesis_filter.filter(account_keys, (status: any) => {
                        //console.log("import filter", status)
                        if (status.error === "missing_public_keys") {
                            console.error(
                                "un-released format, just for testing"
                            );
                            update_state({
                                password_checksum,
                                account_keys: unfiltered_account_keys,
                                genesis_filter_finished: true,
                                genesis_filtering: false
                            });
                            return;
                        }
                        if (status.success) {
                            // let { account_keys } = event.data // if using worker thread
                            update_state({
                                password_checksum,
                                account_keys,
                                genesis_filter_finished: true,
                                genesis_filtering: false
                            });
                            return;
                        }
                        if (status.initalizing !== undefined) {
                            update_state({
                                genesis_filter_initalizing: status.initalizing,
                                genesis_filtering: true
                            });
                            return;
                        }
                        if (status.importing === undefined) {
                            // programmer error
                            console.error("unknown status", status);
                            return;
                        }
                        if (!filter_status.length)
                            // first account
                            filter_status.push(status);
                        else {
                            const last_account_name =
                                filter_status[filter_status.length - 1]
                                    .account_name;
                            if (last_account_name === status.account_name)
                                // update same account
                                filter_status[
                                    filter_status.length - 1
                                ] = status;
                            // new account
                            else filter_status.push(status);
                        }
                        update_state({genesis_filter_status: filter_status});
                    });
                })
            //, 100)
        );
    };

    /**
    BTS 1.0 hosted wallet backup (wallet.bitshares.org) is supported.

    BTS 1.0 native wallets should use wallet_export_keys instead of a wallet backup.

    Note,  Native wallet backups will be rejected.  The logic below does not
    capture assigned account names (for unregisted accounts) and does not capture
    signing keys.  The hosted wallet has only registered accounts and no signing
    keys.

    */
    const _parseWalletJson = (json_contents: any) => {
        let password_checksum;
        let encrypted_brainkey;
        const address_to_enckeys: any = {};
        const account_addresses: any = {};

        const savePubkeyAccount = function(
            pubkey: string,
            account_name: string
        ) {
            //replace BTS with GPH
            pubkey = (ChainConfig as any).address_prefix + pubkey.substring(3);
            let address = (PublicKey as any)
                .fromPublicKeyString(pubkey)
                .toAddressString();
            const addresses = account_addresses[account_name] || [];
            address = "BTS" + address.substring(3);
            //DEBUG console.log("... address",address,account_name)
            addresses.push(address);
            account_addresses[account_name] = addresses;
        };

        try {
            if (!Array.isArray(json_contents)) {
                //DEBUG console.log('... json_contents',json_contents)
                throw new Error("Invalid wallet format");
            }
            for (const element of json_contents) {
                if (
                    "key_record_type" == element.type &&
                    element.data.account_address &&
                    element.data.encrypted_private_key
                ) {
                    const address = element.data.account_address;
                    // `enckeys` here is block-scoped to this `if` (`let`,
                    // not hoisted) - it is NOT the same binding the
                    // post-loop `enckeys.length` check below refers to.
                    const enckeys = address_to_enckeys[address] || [];
                    enckeys.push(element.data.encrypted_private_key);
                    //DEBUG console.log("... address",address,enckeys)
                    address_to_enckeys[address] = enckeys;
                    continue;
                }

                if ("account_record_type" == element.type) {
                    const account_name = element.data.name;
                    savePubkeyAccount(element.data.owner_key, account_name);
                    for (const history of element.data.active_key_history) {
                        savePubkeyAccount(history[1], account_name);
                    }
                    continue;
                }

                if (
                    "property_record_type" == element.type &&
                    "encrypted_brainkey" == element.data.key
                ) {
                    encrypted_brainkey = element.data.value;
                    continue;
                }

                if ("master_key_record_type" == element.type) {
                    if (!element.data) throw referenceErrorLikeOriginal("file");

                    if (!element.data.checksum)
                        throw referenceErrorLikeOriginal("file");

                    password_checksum = element.data.checksum;
                }
            }
            if (!encrypted_brainkey)
                throw "Please use a BTS 1.0 wallet_export_keys file instead";

            if (!password_checksum) throw referenceErrorLikeOriginal("file");

            // Original: `if (!enckeys.length) throw file.name + "...";` -
            // `enckeys` here refers to the *outer* scope, where (per the
            // note above) no such binding exists, so evaluating
            // `enckeys.length` itself always threw a ReferenceError
            // before the `if` could even be evaluated - this line was
            // unconditionally unreachable-without-throwing. Preserved
            // exactly: reaching this point always throws.
            throw referenceErrorLikeOriginal("enckeys");
        } catch (e: any) {
            throw e.message || e;
        }

        const account_keys = [];
        for (const account_name in account_addresses) {
            const encrypted_private_keys = [];
            for (const address of account_addresses[account_name]) {
                const keys = address_to_enckeys[address];
                if (!keys) continue;
                for (const enckey of keys) encrypted_private_keys.push(enckey);
            }
            account_keys.push({
                account_name,
                encrypted_private_keys
            });
        }
        // We could prompt for this brain key instead on first use.  The user
        // may already have a brainkey at this point so with a single brainkey
        // wallet we can't use it now.
        setState({
            password_checksum,
            account_keys
            //encrypted_brainkey
        } as any);
    };

    const _decryptPrivateKeys = (password: string) => {
        const password_aes = (Aes as any).fromSeed(password);
        let format_error1_once = true;
        for (const account of stateRef.current.account_keys) {
            if (!account.encrypted_private_keys) {
                const error = `Account ${account.account_name} missing encrypted_private_keys`;
                console.error(error);
                if (format_error1_once) {
                    Notification.error({
                        message: error
                    });
                    format_error1_once = false;
                }
                continue;
            }
            const account_name = account.account_name.trim();
            const same_prefix_regex = new RegExp(
                "^" + (ChainConfig as any).address_prefix
            );
            for (let i = 0; i < account.encrypted_private_keys.length; i++) {
                const encrypted_private = account.encrypted_private_keys[i];
                let public_key_string = account.public_keys
                    ? account.public_keys[i]
                    : null; // performance gain

                try {
                    const private_plainhex = password_aes.decryptHex(
                        encrypted_private
                    );
                    if (import_keys_assert_checking && public_key_string) {
                        const private_key = (PrivateKey as any).fromHex(
                            private_plainhex
                        );
                        const pub = private_key.toPublicKey(); // S L O W
                        const addy = pub.toAddressString();
                        const pubby = pub.toPublicKeyString();
                        let error = "";

                        const address_string = account.addresses
                            ? account.addresses[i]
                            : null; // assert checking

                        if (
                            address_string &&
                            addy.substring(3) != address_string.substring(3)
                        )
                            error =
                                "address imported " +
                                address_string +
                                " but calculated " +
                                addy +
                                ". ";

                        if (
                            pubby.substring(3) != public_key_string.substring(3)
                        )
                            error +=
                                "public key imported " +
                                public_key_string +
                                " but calculated " +
                                pubby;

                        if (error != "")
                            console.log("ERROR Miss-match key", error);
                    }

                    if (!public_key_string) {
                        const private_key = (PrivateKey as any).fromHex(
                            private_plainhex
                        );
                        const public_key = private_key.toPublicKey(); // S L O W
                        public_key_string = public_key.toPublicKeyString();
                    } else {
                        if (!same_prefix_regex.test(public_key_string))
                            // This was creating a unresponsive chrome browser
                            // but after the results were shown.  It was probably
                            // caused by garbage collection.
                            public_key_string =
                                (ChainConfig as any).address_prefix +
                                public_key_string.substring(3);
                    }
                    stateRef.current.imported_keys_public[
                        public_key_string
                    ] = true;
                    const {account_names} = stateRef.current.keys_to_account[
                        private_plainhex
                    ] || {account_names: []};
                    let dup = false;
                    for (const _name of account_names)
                        if (_name == account_name) dup = true;
                    if (dup) continue;
                    account_names.push(account_name);
                    stateRef.current.keys_to_account[private_plainhex] = {
                        account_names,
                        public_key_string
                    };
                } catch (e: any) {
                    console.log(e, e.stack);
                    const message = e.message || e;
                    Notification.error({
                        message: counterpart.translate(
                            "notifications.import_keys_error",
                            {
                                account_name: account_name,
                                error_msg: message
                            }
                        )
                    });
                }
            }
        }
        //let enc_brainkey = this.state.encrypted_brainkey
        //if(enc_brainkey){
        //    this.setState({
        //        brainkey: password_aes.decryptHexToText(enc_brainkey)
        //    })
        //}
        setState(
            {
                import_file_message: null,
                import_password_message: null,
                password_checksum: null
            },
            () => updateOnChange()
        );
    };

    const _passwordCheck = (evt?: any) => {
        if (evt && "preventDefault" in evt) {
            evt.preventDefault();
        }
        const pwNode = passwordInputRef.current;
        // if(pwNode) pwNode.focus()
        const password = pwNode ? pwNode.value : "";
        const checksum = stateRef.current.password_checksum;
        const new_checksum = (hash as any)
            .sha512((hash as any).sha512(password))
            .toString("hex");
        if (checksum != new_checksum) {
            return setState({
                no_file: false,
                import_password_message:
                    password && password.length ? "Incorrect password" : null
            });
        }
        setState(
            {
                no_file: false,
                reset_password: Date.now(),
                import_password_message: counterpart.translate(
                    "wallet.import_pass_match"
                )
            },
            () => _decryptPrivateKeys(password)
        );
        // setTimeout(, 250)
    };

    const upload = (evt: any) => {
        reset(null, true);
        const file = evt.target.files[0];
        const reader = new FileReader();
        reader.onload = evt => {
            const contents = (evt.target as any).result;
            let json_contents: any;
            try {
                try {
                    json_contents = JSON.parse(contents);
                    // This is the only chance to encounter a large file,
                    // try this format first.
                    _parseImportKeyUpload(
                        json_contents,
                        file.name,
                        (update_state: any) => {
                            // console.log("update_state", update_state)
                            setState(update_state, () => {
                                if (update_state.genesis_filter_finished) {
                                    // try empty password, also display "Enter import file password"
                                    _passwordCheck();
                                }
                            });
                        }
                    );
                } catch (e) {
                    //DEBUG console.log("... _parseImportKeyUpload",e)
                    try {
                        if (!json_contents)
                            file.name + " is an unrecognized format";
                        _parseWalletJson(json_contents);
                    } catch (ee) {
                        if (!addByPattern(contents)) throw ee;
                    }
                    // try empty password, also display "Enter import file password"
                    _passwordCheck();
                }
            } catch (message) {
                console.error("... ImportKeys upload error", message);
                setState({import_file_message: message});
            }
        };
        reader.readAsText(file);
    };

    const onWif = (event: any) => {
        event.preventDefault();
        const value = wifInputRef.current.state.value;
        addByPattern(value);
    };

    const _saveImport = (e: any) => {
        e.preventDefault();
        const keys = (PrivateKeyStore as any).getState().keys;
        const dups: any = {};
        for (const public_key_string in stateRef.current.imported_keys_public) {
            if (!keys.has(public_key_string)) continue;
            delete stateRef.current.imported_keys_public[public_key_string];
            dups[public_key_string] = true;
        }
        if (Object.keys(stateRef.current.imported_keys_public).length === 0) {
            Notification.error({
                message: counterpart.translate(
                    "notifications.import_keys_already_imported"
                )
            });
            return;
        }
        const keys_to_account = stateRef.current.keys_to_account;
        for (const private_plainhex of Object.keys(keys_to_account)) {
            const {public_key_string} = keys_to_account[private_plainhex];
            if (dups[public_key_string])
                delete keys_to_account[private_plainhex];
        }
        (WalletUnlockActions as any)
            .unlock()
            .then(() => {
                (ImportKeysStore as any).importing(true);
                // show the loading indicator
                setTimeout(() => saveImport(), 200);
            })
            .catch(() => {});
    };

    const saveImport = () => {
        const keys_to_account = stateRef.current.keys_to_account;
        const private_key_objs = [];
        for (const private_plainhex of Object.keys(keys_to_account)) {
            const {account_names, public_key_string} = keys_to_account[
                private_plainhex
            ];
            private_key_objs.push({
                private_plainhex,
                import_account_names: account_names,
                public_key_string
            });
        }
        reset();
        (WalletDb as any)
            .importKeysWorker(private_key_objs)
            .then(() => {
                (ImportKeysStore as any).importing(false);
                const import_count = private_key_objs.length;

                Notification.success({
                    message: counterpart.translate(
                        "wallet.import_key_success",
                        {
                            count: import_count
                        }
                    )
                });

                setState({
                    importSuccess: true
                });
                // this.onCancel() // back to claim balances
            })
            .catch((error: any) => {
                console.log("error:", error);
                (ImportKeysStore as any).importing(false);
                let message = error;
                try {
                    message = error.target.error.message;
                } catch (e) {}

                Notification.error({
                    message: counterpart.translate(
                        "notifications.import_keys_error_unknown",
                        {
                            error_msg: message
                        }
                    )
                });
            });
    };

    const addByPattern = (contents: string): number | false => {
        if (!contents) {
            setState({
                errorTextMessage: counterpart.translate(
                    "wallet.wif_import_error"
                )
            });
            return false;
        }
        if (contents.length !== WIF_KEY_LENGTH) {
            setState({
                errorTextMessage: counterpart.translate(
                    "wallet.wif_length_error"
                )
            });
            return false;
        }
        let count = 0,
            invalid_count = 0;
        const wif_regex = /5[HJK][1-9A-Za-z]{49}/g;
        for (const wif of contents.match(wif_regex) || []) {
            try {
                const private_key = (PrivateKey as any).fromWif(wif); //could throw and error
                const private_plainhex = private_key.toBuffer().toString("hex");
                const public_key = private_key.toPublicKey(); // S L O W
                const public_key_string = public_key.toPublicKeyString();
                stateRef.current.imported_keys_public[public_key_string] = true;
                stateRef.current.keys_to_account[private_plainhex] = {
                    account_names: [],
                    public_key_string
                };

                const accountName: string[] = [];
                (AccountApi as any)
                    .lookupAccountByPublicKey(public_key_string)
                    .then(async (result: any) => {
                        const batch = result[0].map((value: any) => {
                            return (FetchChain as any)("getAccount", value);
                        });
                        const accountNames = await Promise.all(batch);
                        accountNames.map((value: any) => {
                            const name = value.get("name");
                            if (accountName.indexOf(name) === -1) {
                                accountName.push(name);
                            }
                        });
                        setState({associatedAccount: accountName});
                    });

                count++;
            } catch (e) {
                invalid_count++;
            }
        }
        setState(
            {
                key_text_message:
                    "Found " +
                    (!count ? "" : count + " valid") +
                    (!invalid_count
                        ? ""
                        : " and " + invalid_count + " invalid") +
                    " key" +
                    (count > 1 || invalid_count > 1 ? "s" : "") +
                    "."
            },
            () => updateOnChange()
        );
        // removes the message on the next render
        setState({
            key_text_message: null,
            errorTextMessage: null
        });
        return count;
    };

    // toggleImportType(type) {
    //     if (!type) {
    //         return;
    //     }
    //     console.log("toggleImportType", type);
    //     this.setState({
    //         privateKey: type === "privateKey"
    //     });
    // }

    const _renderBalanceClaims = () => {
        return (
            <div>
                <BalanceClaimActive />

                <div style={{paddingTop: 15}}>
                    <Button type="primary" onClick={onCancel}>
                        <Translate content="wallet.done" />
                    </Button>
                </div>
            </div>
        );
    };

    const state = stateRef.current;
    const {keys_to_account} = state;
    const key_count = Object.keys(keys_to_account).length;
    const account_keycount = getImportAccountKeyCount(keys_to_account);

    // Create wallet prior to the import keys (keeps layout clean).
    // Original passed `importKeys={true} hideTitle={true}` to
    // WalletCreate - both confirmed dead there too (never read by
    // CreateNewWallet), so dropped.
    if (!(WalletDb as any).getWallet()) return <WalletCreate />;
    if (importing) {
        return (
            <div>
                <div className="center-content">
                    <LoadingIndicator type="circle" />
                </div>
            </div>
        );
    }

    const filtering = state.genesis_filtering;
    let account_rows: any = null;

    if (state.genesis_filter_status.length) {
        account_rows = [];
        for (const status of state.genesis_filter_status) {
            if (status.count && status.total) {
                account_rows.push(
                    <tr key={status.account_name}>
                        <td>{status.account_name}</td>
                        <td>
                            {filtering ? (
                                <span>
                                    Filtering{" "}
                                    {Math.round(
                                        (status.count / status.total) * 100
                                    )}{" "}
                                    %{" "}
                                </span>
                            ) : (
                                <span>{status.count}</span>
                            )}
                        </td>
                    </tr>
                );
            }
        }
    }

    const import_ready = key_count !== 0;
    let password_placeholder = counterpart.translate("wallet.import_password");

    if (import_ready) password_placeholder = "";

    if (!account_rows && account_keycount) {
        account_rows = [];
        for (const account_name in account_keycount) {
            account_rows.push(
                <tr key={account_name}>
                    <td>{account_name}</td>
                    <td>{account_keycount[account_name]}</td>
                </tr>
            );
        }
    }

    const cancelButton = (
        <Button onClick={onCancel}>
            <Translate content="wallet.cancel" />
        </Button>
    );

    let tabIndex = 1;

    if (state.importSuccess) {
        return _renderBalanceClaims();
    }

    return (
        <div>
            {/* Key file upload */}
            <div style={{padding: "10px 0"}}>
                <span>
                    {state.key_text_message ? (
                        state.key_text_message
                    ) : (
                        <KeyCount key_count={key_count} />
                    )}
                </span>
                {!import_ready ? null : (
                    <span>
                        {" "}
                        (
                        <a onClick={reset}>
                            <Translate content="wallet.reset" />
                        </a>
                        )
                    </span>
                )}
                <span>
                    <br />
                    {state.associatedAccount && (
                        <div>
                            <Translate content="wallet.wif_associated_accounts" />
                            {state.associatedAccount.map((value, key) => {
                                return <p key={key}>{value}</p>;
                            })}
                        </div>
                    )}
                </span>
            </div>

            {account_rows ? (
                <div>
                    {!account_rows.length ? (
                        counterpart.translate("wallet.no_accounts")
                    ) : (
                        <div>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>
                                            <Translate content="explorer.account.title" />
                                        </th>
                                        <th>
                                            <Translate content="settings.restore_key_count" />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>{account_rows}</tbody>
                            </table>
                            <br />
                        </div>
                    )}
                </div>
            ) : null}
            <br />

            {!import_ready && !state.genesis_filter_initalizing ? (
                <div>
                    <div>
                        <div>
                            {privateKey ? (
                                <form onSubmit={onWif}>
                                    <Translate
                                        component="label"
                                        content="wallet.paste_private"
                                    />
                                    <Input
                                        ref={wifInputRef}
                                        type="password"
                                        id="wif"
                                        tabIndex={tabIndex++}
                                        style={{marginBottom: "16px"}}
                                    />
                                    <div className="importError">
                                        <span className="red">
                                            {state.errorTextMessage}
                                        </span>
                                    </div>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        style={{marginRight: "16px"}}
                                    >
                                        <Translate content="wallet.submit" />
                                    </Button>
                                    {cancelButton}
                                </form>
                            ) : (
                                <form onSubmit={_passwordCheck}>
                                    <label>
                                        <Translate content="wallet.bts_09_export" />
                                        {state.no_file ? null : (
                                            <span>
                                                &nbsp; (
                                                <a onClick={reset}>Reset</a>)
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="file"
                                        id="file_input"
                                        accept=".json"
                                        style={{
                                            border: "solid",
                                            marginBottom: 15
                                        }}
                                        key={state.reset_file_name}
                                        onChange={upload}
                                    />
                                    <div>{state.import_file_message}</div>
                                    {!state.no_file ? (
                                        <div>
                                            <Input
                                                type="password"
                                                ref={passwordInputRef}
                                                key={state.reset_password}
                                                placeholder={
                                                    password_placeholder
                                                }
                                                onChange={() => {
                                                    if (
                                                        state.import_password_message &&
                                                        state
                                                            .import_password_message
                                                            .length
                                                    ) {
                                                        setState({
                                                            import_password_message: null
                                                        });
                                                    }
                                                }}
                                            />
                                            <p className="facolor-error">
                                                {state.import_password_message}
                                            </p>
                                        </div>
                                    ) : null}
                                    <div className="button-group">
                                        <Button
                                            type="primary"
                                            disabled={!!state.no_file}
                                            htmlType="submit"
                                            style={{marginRight: "16px"}}
                                        >
                                            <Translate content="wallet.submit" />
                                        </Button>
                                        {cancelButton}
                                    </div>
                                </form>
                            )}
                        </div>
                        <br />

                        <br />
                    </div>
                </div>
            ) : null}

            {state.genesis_filter_initalizing ? (
                <div>
                    <div className="center-content">
                        <LoadingIndicator type="circle" />
                    </div>
                </div>
            ) : null}

            {import_ready ? (
                <div>
                    <div>
                        <div className="button-group">
                            <div
                                className={cname("button success", {
                                    disabled: !import_ready
                                })}
                                onClick={_saveImport}
                            >
                                <Translate content="wallet.import_keys" />
                            </div>
                            <div className="button secondary" onClick={reset}>
                                <Translate content="wallet.cancel" />
                            </div>
                        </div>
                    </div>

                    <h4>
                        <Translate content="wallet.unclaimed" />
                    </h4>
                    <Translate component="p" content="wallet.claim_later" />
                    <div className="grid-block">
                        <div className="grid-content no-overflow">
                            <Translate
                                component="label"
                                content="wallet.totals"
                            />
                            <BalanceClaimAssetTotal />
                        </div>
                    </div>
                    <br />
                </div>
            ) : null}
        </div>
    );
}

export default ImportKeys;
