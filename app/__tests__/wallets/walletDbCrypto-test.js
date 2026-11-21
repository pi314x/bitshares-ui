// Characterization tests for the security-critical crypto paths in
// app/stores/WalletDb.js, written against the pre-port .js implementation
// per docs/UI_MIGRATION_PLAN.md's Phase 5 methodology ("wrap it behind a
// typed interface and add characterization tests first, then refactor
// internals with the safety net in place") before that file is ported to
// TypeScript. AGENTS.md: this is the file that handles wallet unlock, key
// decryption and transaction signing - these tests exist so the TS port
// can be checked against this exact pre-port behavior, not just "looks
// equivalent".
//
// Scope note: WalletDb.js mixes pure in-memory crypto (validatePassword,
// changePassword, getBrainKey(Private), generateKeyFromPassword,
// getPrivateKey/decryptTcomb_PrivateKey) with real IndexedDB I/O
// (onCreateWallet, saveKey, importKeysWorker, loadDbData, _updateWallet)
// and a Web Worker (importKeysWorker's AesWorker). The tests below cover
// the former - the in-memory encrypt/decrypt/derive invariants that
// matter most for "can the user always get their real keys back" - by
// driving the real exported WalletDb singleton and stubbing only
// `_updateWallet` (itself just an IndexedDB write - the wallet's
// in-memory `state.wallet` is what these tests actually verify). The
// IndexedDB/Worker-dependent methods are NOT characterized here (mocking
// a full IndexedDB + Worker round trip was judged not worth the added
// test fragility for a mechanical, no-logic-change port); the port of
// those methods instead got an extra careful line-by-line diff review
// against the original, and is called out explicitly for the required
// human second-reviewer in docs/UI_MIGRATION_PLAN.md.
//
// Each test calls `freshWalletDb()`, which resets the module registry and
// re-requires the store - WalletDb.js keeps its unlock state
// (`aes_private`/`_passwordKey`) in module-private `let` variables shared
// by every consumer of that module instance, so tests must not leak
// unlock state into each other.
import {PrivateKey, Aes, key} from "bitsharesjs";

// _updateWallet (used by changePassword/setBackupDate/etc.) writes the
// wallet record through a real IndexedDB transaction - this fake mimics
// just enough of that surface (objectStore().put() -> a request that
// fires onsuccess, a transaction that fires oncomplete) for
// idb_helper.on_request_end/on_transaction_end to resolve, without
// pulling in a real IndexedDB implementation.
function fakeIdbTransaction() {
    const request = {};
    const transaction = {
        objectStore: () => ({
            put: () => {
                Promise.resolve().then(() => {
                    if (request.onsuccess)
                        request.onsuccess({target: {result: undefined}});
                });
                return request;
            }
        })
    };
    Promise.resolve()
        .then(() => Promise.resolve())
        .then(() => {
            if (transaction.oncomplete) transaction.oncomplete({target: {}});
        });
    return transaction;
}

function freshWalletDb() {
    jest.resetModules();
    jest.doMock("idb-instance", () => ({
        __esModule: true,
        default: {
            instance: () => ({
                db: () => ({
                    transaction: () => fakeIdbTransaction()
                })
            })
        }
    }));
    const WalletDb = require("stores/WalletDb").default;
    return WalletDb;
}

describe("WalletDb.validatePassword / changePassword (characterization, pre-port .js behavior)", () => {
    it("unlocks with the correct wallet password and locks again on WalletDb.onLock", () => {
        const WalletDb = freshWalletDb();
        const password = "correct horse battery staple";
        const password_pubkey = PrivateKey.fromSeed(password)
            .toPublicKey()
            .toPublicKeyString();
        const encryption_buffer = key.get_random_key().toBuffer();
        const encryption_key = Aes.fromSeed(password).encryptToHex(
            encryption_buffer
        );

        WalletDb.state.wallet = {password_pubkey, encryption_key};

        expect(WalletDb.isLocked()).toBe(true);
        const result = WalletDb.validatePassword(password, true);
        expect(result).toEqual({success: true, cloudMode: false});
        expect(WalletDb.isLocked()).toBe(false);

        WalletDb.onLock();
        expect(WalletDb.isLocked()).toBe(true);
    });

    it("returns bare `false` (not an object) for a wrong wallet password", () => {
        const WalletDb = freshWalletDb();
        const password_pubkey = PrivateKey.fromSeed("the-real-password")
            .toPublicKey()
            .toPublicKeyString();
        WalletDb.state.wallet = {password_pubkey, encryption_key: "dead"};

        const result = WalletDb.validatePassword("wrong-password", true);
        expect(result).toBe(false);
        expect(WalletDb.isLocked()).toBe(true);
    });

    it("changePassword re-wraps the same master encryption key so previously-encrypted keys stay decryptable", () => {
        const WalletDb = freshWalletDb();
        const oldPassword = "old-password-123";
        const newPassword = "new-password-456";
        const password_pubkey = PrivateKey.fromSeed(oldPassword)
            .toPublicKey()
            .toPublicKeyString();
        const encryption_buffer = key.get_random_key().toBuffer();
        const encryption_key = Aes.fromSeed(oldPassword).encryptToHex(
            encryption_buffer
        );

        WalletDb.state.wallet = {
            public_name: "default",
            created: new Date(),
            last_modified: new Date(),
            backup_date: null,
            password_pubkey,
            encryption_key,
            encrypted_brainkey: null,
            brainkey_pubkey: PrivateKey.fromSeed("brainkey-seed")
                .toPublicKey()
                .toPublicKeyString(),
            brainkey_sequence: 0,
            brainkey_backup_date: null,
            chain_id: "0".repeat(64)
        };

        // Encrypt a private key under the pre-change aes_private, the way
        // WalletDb.saveKey does internally.
        WalletDb.validatePassword(oldPassword, true);
        const testPrivateKey = PrivateKey.fromSeed("some-account-active-key");
        const preChangeAesPrivate = Aes.fromSeed(encryption_buffer);
        const encrypted_key = preChangeAesPrivate.encryptToHex(
            testPrivateKey.toBuffer()
        );
        WalletDb.onLock();

        return WalletDb.changePassword(oldPassword, newPassword, true).then(
            () => {
                const wallet = WalletDb.getWallet();
                const expectedNewPubkey = PrivateKey.fromSeed(newPassword)
                    .toPublicKey()
                    .toPublicKeyString();
                expect(wallet.password_pubkey).toBe(expectedNewPubkey);
                expect(WalletDb.isLocked()).toBe(false);

                // The master encryption key must be unchanged - a key
                // encrypted before the password change must still decrypt
                // correctly after it.
                const decrypted = WalletDb.decryptTcomb_PrivateKey({
                    pubkey: testPrivateKey.toPublicKey().toPublicKeyString(),
                    encrypted_key
                });
                expect(decrypted.toWif()).toBe(testPrivateKey.toWif());

                // And the new password on its own now unlocks to the same
                // underlying key.
                WalletDb.onLock();
                const reUnlocked = WalletDb.validatePassword(newPassword, true);
                expect(reUnlocked).toEqual({success: true, cloudMode: false});
                const decryptedAgain = WalletDb.decryptTcomb_PrivateKey({
                    pubkey: testPrivateKey.toPublicKey().toPublicKeyString(),
                    encrypted_key
                });
                expect(decryptedAgain.toWif()).toBe(testPrivateKey.toWif());
            }
        );
    });
});

describe("WalletDb.getBrainKey / getBrainKeyPrivate (characterization)", () => {
    it("decrypts the stored brainkey and derives the same deterministic private key bitsharesjs would", () => {
        const WalletDb = freshWalletDb();
        const password = "brainkey-owner-password";
        const password_pubkey = PrivateKey.fromSeed(password)
            .toPublicKey()
            .toPublicKeyString();
        const encryption_buffer = key.get_random_key().toBuffer();
        const encryption_key = Aes.fromSeed(password).encryptToHex(
            encryption_buffer
        );
        const brainkeyPlaintext = key.normalize_brainKey(
            "hello there this is a test brain key with plenty of words in it"
        );
        const encrypted_brainkey = Aes.fromSeed(encryption_buffer).encryptToHex(
            brainkeyPlaintext
        );

        WalletDb.state.wallet = {
            password_pubkey,
            encryption_key,
            encrypted_brainkey
        };
        WalletDb.validatePassword(password, true);

        expect(WalletDb.getBrainKey()).toBe(brainkeyPlaintext);
        expect(WalletDb.getBrainKeyPrivate().toWif()).toBe(
            PrivateKey.fromSeed(brainkeyPlaintext).toWif()
        );
    });

    it("throws 'wallet locked' when reading the brainkey before unlocking", () => {
        const WalletDb = freshWalletDb();
        WalletDb.state.wallet = {encrypted_brainkey: "anything"};
        expect(() => WalletDb.getBrainKey()).toThrow("wallet locked");
    });
});

describe("WalletDb.generateKeyFromPassword (characterization)", () => {
    it("deterministically derives the same key bitsharesjs's PrivateKey.fromSeed would for accountName+role+password", () => {
        const WalletDb = freshWalletDb();
        const {privKey, pubKey} = WalletDb.generateKeyFromPassword(
            "nathan",
            "active",
            "password123"
        );
        const expected = PrivateKey.fromSeed("nathanactivepassword123");
        expect(privKey.toWif()).toBe(expected.toWif());
        expect(pubKey).toBe(expected.toPublicKey().toString());
    });
});

describe("WalletDb.getPrivateKey / decryptTcomb_PrivateKey (characterization)", () => {
    it("throws 'wallet locked' when decrypting before unlock", () => {
        const WalletDb = freshWalletDb();
        expect(() =>
            WalletDb.decryptTcomb_PrivateKey({
                pubkey: "anything",
                encrypted_key: "anything"
            })
        ).toThrow("wallet locked");
    });

    it("round-trips a private key through aes_private exactly as saveKey/getPrivateKey would", () => {
        const WalletDb = freshWalletDb();
        const password = "round-trip-password";
        const password_pubkey = PrivateKey.fromSeed(password)
            .toPublicKey()
            .toPublicKeyString();
        const encryption_buffer = key.get_random_key().toBuffer();
        const encryption_key = Aes.fromSeed(password).encryptToHex(
            encryption_buffer
        );
        WalletDb.state.wallet = {password_pubkey, encryption_key};
        WalletDb.validatePassword(password, true);

        const testPrivateKey = PrivateKey.fromSeed("account-owner-key-seed");
        const aesPrivateForEncrypting = Aes.fromSeed(encryption_buffer);
        const encrypted_key = aesPrivateForEncrypting.encryptToHex(
            testPrivateKey.toBuffer()
        );

        const decrypted = WalletDb.decryptTcomb_PrivateKey({
            pubkey: testPrivateKey.toPublicKey().toPublicKeyString(),
            encrypted_key
        });
        expect(decrypted.toWif()).toBe(testPrivateKey.toWif());
    });
});
