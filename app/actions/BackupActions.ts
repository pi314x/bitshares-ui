// TypeScript port of the legacy BackupActions.js (Phase 5,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: this is the real AES encrypt/decrypt
// path for wallet backups (Aes.encrypt_with_checksum/decrypt_with_checksum
// via bitsharesjs). Characterized against the pre-port .js implementation
// in app/__tests__/wallets/backupCrypto-test.js (fixed vectors +
// round-trip) before this port, per the Phase 5 methodology note in the
// migration plan; re-run unchanged (and green) against this port.
//
// Phase 9 update (docs/UI_MIGRATION_PLAN.md, batch 7): the Alt-actions
// class below (`incommingWebFile`/`incommingBuffer`/`reset`, the only 3
// methods `BackupStore` ever bound a listener to) is replaced by a
// Redux-dispatching facade, same pattern as every other migrated
// store/actions pair - see `../store/reduxStore.ts`'s header. The 5
// plain exported crypto functions below this class
// (`backup`/`restore`/`createWalletObject`/`createWalletBackup`/
// `decryptWalletBackup`) were NEVER part of the Alt actions class or
// wired through Alt's dispatcher at all - completely untouched here,
// same module, same exports, same implementation, same characterization
// test coverage.
import iDB from "idb-instance";
import {compress, decompress} from "lzma";
import {PrivateKey, PublicKey, Aes, key, hash} from "bitsharesjs";
import WalletActions from "actions/WalletActions";
import {reduxStore} from "../store/reduxStore";
import {
    resetBackup,
    setIncomingFile,
    setIncomingBuffer
} from "../store/slices/backupSlice";

function getBackupPublicKey(contents: any) {
    try {
        return (PublicKey as any).fromBuffer(contents.slice(0, 33));
    } catch (e) {
        console.error(e, (e as any).stack);
    }
}

class BackupActionsFacade {
    incommingWebFile(file: any) {
        const reader = new FileReader();
        reader.onload = evt => {
            const contents = new Buffer((evt.target as any).result, "binary");
            const name = file.name;
            const last_modified = new Date(file.lastModified).toString();

            const sha1 = (hash as any).sha1(contents).toString("hex");
            const size = contents.length;
            const public_key = getBackupPublicKey(contents);
            reduxStore.dispatch(
                setIncomingFile({name, contents, sha1, size, last_modified, public_key})
            );
        };
        reader.readAsBinaryString(file);
    }

    incommingBuffer(params: any) {
        const {name, contents} = params;
        let {public_key} = params;
        reduxStore.dispatch(resetBackup());
        const sha1 = (hash as any).sha1(contents).toString("hex");
        const size = contents.length;
        if (!public_key) public_key = getBackupPublicKey(contents);
        reduxStore.dispatch(
            setIncomingBuffer({name, contents, sha1, size, public_key})
        );
        return params;
    }

    reset() {
        reduxStore.dispatch(resetBackup());
        return true;
    }
}

const BackupActionsWrapped = new BackupActionsFacade();
export default BackupActionsWrapped;

export function backup(backup_pubkey: string): Promise<Buffer> {
    return new Promise(resolve => {
        resolve(
            createWalletObject().then((wallet_object: any) => {
                const compression = 1;
                return createWalletBackup(
                    backup_pubkey,
                    wallet_object,
                    compression
                );
            })
        );
    });
}

/** No click backup.. Works great, but not used (yet?) */
// export function backupToBin(
//     backup_pubkey = WalletDb.getWallet().password_pubkey,
//     saveAsCallback = saveAs
// ) {
//     backup(backup_pubkey).then( contents => {
//         let name = iDB.getCurrentWalletName() + ".bin"
//         let blob = new Blob([ contents ], {
//             type: "application/octet-stream; charset=us-ascii"})
//
//         if(blob.size !== contents.length)
//             throw new Error("Invalid backup to download conversion")
//
//         saveAsCallback(blob, name);
//         WalletActions.setBackupDate()
//     })
// }

export function restore(
    backup_wif: string,
    backup: Buffer | any,
    wallet_name: string
): Promise<any> {
    return new Promise(resolve => {
        resolve(
            decryptWalletBackup(backup_wif, backup).then(
                (wallet_object: any) => {
                    return (WalletActions as any).restore(
                        wallet_name,
                        wallet_object
                    );
                }
            )
        );
    });
}

export function createWalletObject(): Promise<any> {
    return (iDB as any).backup();
}

/**
 compression_mode can be 1-9 (1 is fast and pretty good; 9 is slower and probably much better)
*/
export function createWalletBackup(
    backup_pubkey: string,
    wallet_object: any,
    compression_mode: number,
    entropy?: string
): Promise<Buffer> {
    return new Promise(resolve => {
        const public_key = (PublicKey as any).fromPublicKeyString(
            backup_pubkey
        );
        const onetime_private_key = (key as any).get_random_key(entropy);
        const walletString = JSON.stringify(wallet_object, null, 0);
        (compress as any)(
            walletString,
            compression_mode,
            (compressedWalletBytes: any) => {
                const backup_buffer = (Aes as any).encrypt_with_checksum(
                    onetime_private_key,
                    public_key,
                    null /*nonce*/,
                    compressedWalletBytes
                );

                const onetime_public_key = onetime_private_key.toPublicKey();
                const backup = Buffer.concat([
                    onetime_public_key.toBuffer(),
                    backup_buffer
                ]);
                resolve(backup);
            }
        );
    });
}

export function decryptWalletBackup(
    backup_wif: string,
    backup_buffer: Buffer | any
): Promise<any> {
    return new Promise((resolve, reject) => {
        if (!Buffer.isBuffer(backup_buffer))
            backup_buffer = new Buffer(backup_buffer, "binary");

        const private_key = (PrivateKey as any).fromWif(backup_wif);
        let public_key;
        try {
            public_key = (PublicKey as any).fromBuffer(
                backup_buffer.slice(0, 33)
            );
        } catch (e) {
            console.error(e, (e as any).stack);
            throw new Error("Invalid backup file");
        }

        backup_buffer = backup_buffer.slice(33);
        try {
            backup_buffer = (Aes as any).decrypt_with_checksum(
                private_key,
                public_key,
                null /*nonce*/,
                backup_buffer
            );
        } catch (error) {
            console.error(
                "Error decrypting wallet",
                error,
                (error as any).stack
            );
            reject("invalid_decryption_key");
            return;
        }

        try {
            (decompress as any)(backup_buffer, (wallet_string: string) => {
                try {
                    const wallet_object = JSON.parse(wallet_string);
                    resolve(wallet_object);
                } catch (error) {
                    if (!wallet_string) wallet_string = "";
                    console.error(
                        "Error parsing wallet json",
                        wallet_string.substring(0, 10) + "..."
                    );
                    reject("Error parsing wallet json");
                }
            });
        } catch (error) {
            console.error(
                "Error decompressing wallet",
                error,
                (error as any).stack
            );
            reject("Error decompressing wallet");
            return;
        }
    });
}
