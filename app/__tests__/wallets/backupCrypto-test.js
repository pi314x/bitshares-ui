// Characterization tests for the wallet-backup crypto path
// (app/actions/BackupActions.js, app/lib/common/backupUtils.js), written
// against the pre-port .js implementation per docs/UI_MIGRATION_PLAN.md's
// Phase 5 methodology ("signing/transaction-building covered by tests
// against fixed test vectors") before that code is ported to TypeScript.
// AGENTS.md: this is the real AES encrypt/decrypt path used for wallet
// backups - these tests exist so a TS port can be checked against this
// exact pre-port behavior, not just "looks equivalent".
//
// The fixed vector below (BACKUP_WIF / BACKUP_BUFFER_B64) was generated
// once against the current .js implementation with a fixed entropy input
// and a test-only seed-derived key (PrivateKey.fromSeed(FIXTURE_SEED) -
// never a real wallet key), encrypting the real wallet-object fixture
// already checked in at ./wallet_bts0-9_password.json. `createWalletBackup`
// itself is not byte-reproducible (bitsharesjs's key.get_random_key always
// mixes real OS randomness via secure-random on top of any supplied
// entropy - see KeyUtils.js's random32ByteBuffer), so the fixed vector
// exercises decryptWalletBackup's decompression/decryption path (which
// *is* deterministic for fixed ciphertext), and a separate round-trip
// test exercises createWalletBackup end-to-end via decryptWalletBackup.
import fs from "fs";
import path from "path";
import {createWalletBackup, decryptWalletBackup} from "actions/BackupActions";
import {backupName} from "common/backupUtils";
import {PrivateKey} from "bitsharesjs";

const walletObjectFixture = JSON.parse(
    fs.readFileSync(path.join(__dirname, "wallet_bts0-9_password.json"), "utf8")
);

const FIXTURE_SEED = "backup-fixture-seed-for-tests";
const BACKUP_WIF = "5HpLBxeAPV9JVk62TxhNVGHHjGT1UZaPTuNG6LprfQMNhSbYujU";
const BACKUP_BUFFER_B64 =
    "Az1A6tjftPVFLtCrIcouIPnABMK4sCD1dWq7ReyYktkr1274C+qB7CtG82Frb+knXG3M/OPiEG0gOXd3GmQP2SAfjyOb73BRz9/Uf9QZmY08uUol1GCNtZruLHqV55dIBmw9WZbQgo3cseL+I/pqukS7EVY3hGo6PXx40AxdPOoFWBwZRPDq8IZUfVZs51wsiZzvtsHAsJqL4fGqQIAt7uquyuoJgGAOKefrbxOFsVq6HzdvmXy6kbZZklVr3DFEdWBVVoikYueS1Le35TzcolcRiTNJ8D6vTQyj0zbwTLgZnNnYWddt/i7eqb+SYClclh5bC/0z3bRsVLJA1so0tSsTSbD29G3bgXsCb55mIjaB4i2y6YIjaiDIpbW18L0nbAJYj+lRnAEc+BsaHWWSLegXIIeZvdv8v11UVKn5KxM+ixmQKVtwBy7icMAwqAasWZjfKSV3YjgkJB052MPZLPqqasttXLGo9TSU4I+agqOi/yyOM6v0DyvHHUX9ylId15ur7eEUGaKXapJxacuQWUCh5a4gDknxKR/jpzSmrTT/omVrtvnPMlDb7zv0/4f209ulIlhNHEdW0IMGvZJa6eTvp7+HHsxjzV0vjxLCwvD5r8xWhJC13v7Kq20rgiUSVPfS0vyL7E3vXvdnludbkSQP0sYnK6IqV8V6r64TSNdN+I8nt+vHKPfdeYWHrobs9KA4CqpMrCMakw+Em0Lw4h7gi13J5HsrqrGtPiaQpvIvlXUR+wAmkUo1fZh9cgAXYXWNhQvElVw5fDAdKFfxhnCNBuyKl0Dfr6naAHZRuCOmaydCjDwrIpsgR4fZv+e9iwqNd0MBG1IersvPPRz3ped3XtmKV/J8q5QeCHZ5qLy4B12HC2mLV+WAbTX5HeorbpvB/WJQa4WQlW3K/6M1ORtQaRp2gyxh8IPi7SfVot0jIc/mVjYLE435xxPhn00LZIwvBtt+L5X43KvvagWnkq695KKs+Ot5G+Vwb44g8NxFsVAhx/iVM5+7/wZdVH4f1I6XJAmyOSOouzA82VfTFx11mTUqtjlk9h0z1bAgxvHHKoR6u9Wu80xA4ecIpJjIpaa2u3pU+ndX+6f45glNVxM7Y477GtOSkSCfDi5jxPL1GZyBoZ8BSfTCpJ5mW9sTAznTQwVBszZl8EurohcSoxd6mKKuDNDf0lcU4h5BL4IN6yWHzhth4HfVswyJuTVY4288Xzu7XT7opZ3EYFPzs17kjDbHfBhYr4yeGdHrISjUuvZQ6Hmkp3poYSBpcybrp0oUEoFsPFX7gWup9aedDRO4Hfh8LBn1RseqqmA/W/Uqgrg6xaRnSsOW+iQb7sm3FA==";

describe("BackupActions crypto (characterization, pre-port .js behavior)", () => {
    it("decrypts a fixed backup buffer back to the exact original wallet object", async () => {
        const buffer = Buffer.from(BACKUP_BUFFER_B64, "base64");
        const decrypted = await decryptWalletBackup(BACKUP_WIF, buffer);
        expect(decrypted).toEqual(walletObjectFixture);
    });

    it("round-trips a fresh key pair through createWalletBackup -> decryptWalletBackup", async () => {
        const backupPrivate = PrivateKey.fromSeed(FIXTURE_SEED + "-roundtrip");
        const backupPublicString = backupPrivate
            .toPublicKey()
            .toPublicKeyString();

        const buffer = await createWalletBackup(
            backupPublicString,
            walletObjectFixture,
            1,
            "fixed-entropy-for-roundtrip-test-000"
        );
        const decrypted = await decryptWalletBackup(
            backupPrivate.toWif(),
            buffer
        );
        expect(decrypted).toEqual(walletObjectFixture);
    });

    it("rejects with the string 'invalid_decryption_key' when the wrong key decrypts a validly-shaped backup", async () => {
        const buffer = Buffer.from(BACKUP_BUFFER_B64, "base64");
        const wrongKey = PrivateKey.fromSeed(FIXTURE_SEED + "-wrong");
        await expect(
            decryptWalletBackup(wrongKey.toWif(), buffer)
        ).rejects.toBe("invalid_decryption_key");
    });

    // Note: a buffer whose leading 33 bytes aren't a valid EC point (e.g.
    // all-zero garbage) is NOT exercised here - PublicKey.fromBuffer
    // doesn't validate the point is actually on-curve, so the failure
    // surfaces later, asynchronously, inside elliptic's point math in a
    // way the original's synchronous try/catch around
    // Aes.decrypt_with_checksum can't catch either - an uncaught
    // exception, not a rejection. That's a pre-existing crash-prone edge
    // in the original code, not something introduced by porting it, and
    // it isn't reachable via the app's own UI path: Backup.jsx's
    // `getBackupPublicKey` already gates on `PublicKey.fromBuffer`
    // succeeding before any backup file reaches `decryptWalletBackup`.
});

describe("backupUtils.backupName (characterization)", () => {
    const addressPrefix = require("bitsharesjs-ws").ChainConfig.address_prefix.toLowerCase();

    it("prefixes the wallet name with the chain's address prefix and a YYYYMMDD date stamp", () => {
        const name = backupName("myWallet", new Date(2024, 2, 5)); // March 5, 2024
        expect(name).toBe(`${addressPrefix}_myWallet_20240305.bin`);
    });

    it("does not double-prefix a wallet name that already starts with the address prefix", () => {
        const prefixedName = `${addressPrefix}_myWallet`;
        const name = backupName(prefixedName, new Date(2024, 10, 30)); // Nov 30, 2024
        expect(name).toBe(`${prefixedName}_20241130.bin`);
    });
});
