// Phase 9 (docs/UI_MIGRATION_PLAN.md): plain singleton replacing the real
// Alt `alt.createActions(HtlcActions)` wrapper - grep-confirmed no store
// ever bound to this class (`bindListeners`), so under real Alt every
// `dispatch(true)`/`dispatch(false)` call below was already a no-op;
// `create`/`redeem`/`extend` returned Alt "thunks" (`dispatch => {...}`)
// purely so they could call `dispatch`, so the thunk wrapper is dropped
// and each method just returns the same `.then()/.catch()` chain
// directly - same dead-dispatch precedent as the `AssetActions`/
// `AccountActions`/`MarketsActions` batches. Preserved as-is, not fixed:
// each method's internal `.catch()` swallows `process_transaction`
// errors without rethrowing (only `console.log`s them), so the Promise
// `HtlcModal.tsx` awaits always resolves - its own `.catch()` there never
// actually fires even when the transaction fails. This was already true
// under real Alt (the dispatch calls don't change the chain's resolution),
// not a behavior change introduced by this port. Also drops 3 already-
// unused imports (`Apis`, `ChainStore`, `FetchChainObjects` - dead since
// before this port, confirmed via `git show` against the pre-port file)
// surfaced by `yarn lint:changed` now that this file is part of a diff.
import WalletApi from "api/WalletApi";
import WalletDb from "stores/WalletDb";
import {hash} from "bitsharesjs";

const calculateHash = (cipher, preimage) => {
    let preimage_hash_calculated = null;
    switch (cipher) {
        case "sha256":
            preimage_hash_calculated = hash.sha256(preimage);
            break;
        case "ripemd160":
            preimage_hash_calculated = hash.ripemd160(preimage);
            break;
        case "sha1":
            throw new Error(
                "sha1 is not considered a secure hashing algorithm, plaase use sha256"
            );
            break;
        default:
            throw new Error("Wrong cipher name provided when creating htlc op");
    }
    return preimage_hash_calculated;
};
const getCipherInt = cipher => {
    let preimage_hash_cipher = null;
    switch (cipher) {
        case "sha256":
            preimage_hash_cipher = 2;
            break;
        case "ripemd160":
            preimage_hash_cipher = 0;
            break;
        case "sha1":
            throw new Error(
                "sha1 is not considered a secure hashing algorithm, plaase use sha256"
            );
            break;
        default:
            throw new Error("Wrong cipher name provided when creating htlc op");
    }
    return preimage_hash_cipher;
};
class HtlcActions {
    create({
        from_account_id,
        to_account_id,
        asset_id,
        amount,
        lock_time,
        preimage_cipher,
        preimage = null,
        preimage_hash = null,
        preimage_size = null,
        fee_asset = null
    }) {
        if (!fee_asset) {
            fee_asset = "1.3.0";
        }
        if (typeof fee_asset !== "string") {
            fee_asset = fee_asset.get("id");
        }
        const tr = WalletApi.new_transaction();

        let preimage_hash_cipher = getCipherInt(preimage_cipher);
        if (preimage && !preimage_hash) {
            preimage_hash = calculateHash(preimage_cipher, preimage);
        }
        if (!preimage_size) {
            if (preimage) {
                preimage_size = preimage.length;
            } else {
                throw Error("Preimage must be given if size is empty");
            }
        }

        tr.add_type_operation("htlc_create", {
            from: from_account_id,
            to: to_account_id,
            fee: {
                amount: 0,
                asset_id: fee_asset
            },
            amount: {
                amount: amount,
                asset_id: asset_id
            },
            preimage_hash: [preimage_hash_cipher, preimage_hash],
            preimage_size: preimage_size,
            claim_period_seconds: lock_time
        });

        return WalletDb.process_transaction(tr, null, true)
            .then(() => {})
            .catch(error => {
                console.log(
                    "[HtlcActions.js:69] ----- htlc create error ----->",
                    error
                );
            });
    }

    redeem({htlc_id, user_id, preimage}) {
        let tr = WalletApi.new_transaction();

        tr.add_type_operation("htlc_redeem", {
            preimage: new Buffer(preimage).toString("hex"),
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            htlc_id: htlc_id,
            redeemer: user_id
        });

        return WalletDb.process_transaction(tr, null, true)
            .then(() => {})
            .catch(error => {
                console.log(
                    "[HtlcActions.js:98] ----- htlc redeem error ----->",
                    error
                );
            });
    }

    extend({htlc_id, user_id, seconds_to_add}) {
        let tr = WalletApi.new_transaction();

        tr.add_type_operation("htlc_extend", {
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            htlc_id: htlc_id,
            update_issuer: user_id,
            seconds_to_add: seconds_to_add
        });

        return WalletDb.process_transaction(tr, null, true)
            .then(() => {})
            .catch(error => {
                console.log(
                    "[HtlcActions.js:127] ----- htlc extend error ----->",
                    error
                );
            });
    }

    calculateHash(preimage, cipher) {
        const preimage_hash_calculated = calculateHash(cipher, preimage);
        const size = preimage_hash_calculated.length;
        let hash = new Buffer(preimage_hash_calculated).toString("hex");
        return {hash, size};
    }
}

export default new HtlcActions();
