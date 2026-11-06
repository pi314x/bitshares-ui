// TypeScript/functional-component port of the legacy
// AccountPermissionsMigrate.jsx (Phase 3, docs/UI_MIGRATION_PLAN.md).
// Wallet-security-sensitive: this file calls `WalletDb.generateKeyFromPassword`
// directly to derive candidate active/owner/memo keys from a user-entered
// password, for migrating an account to a password-derived key model.
// Handled with the same extra care as this migration's wallet-tier
// Settings files - minimal, mechanical, line-for-line translation, no
// logic changes, per AGENTS.md's "prefer minimal, well-tested diffs over
// refactors" for anything touching key derivation. The actual key-
// generation math and the `account_update` submission both stay entirely
// inside `WalletDb`/the caller-supplied `onAddActive`/`onAddOwner`/
// `onSetMemo`/`onRemoveActive`/`onRemoveOwner` props (all in the not-yet-
// ported `AccountPermissions.jsx`) - this file only derives candidate
// keys for display and forwards user actions to those callbacks
// unchanged.
//
// One pre-existing quirk preserved exactly, not "fixed": in the legacy
// `_onUseKey`, the remove-branch handler lookup is
// `role === "active" ? "onRemoveActive" : "onRemoveOwner"` - for
// `role === "memo"` this falls through to `onRemoveOwner`, which looks
// like a bug at a glance. In practice it's unreachable: the memo row's
// "use" button is only ever visible (and thus clickable) when
// `!memoInUse`, i.e. exactly when `_onUseKey("memo", false)` is called
// (the add branch, not remove) - `style={{visibility: memoInUse ?
// "hidden" : ""}}` hides it whenever the remove branch would otherwise
// be reachable. Kept byte-for-byte identical rather than "cleaned up",
// since changing it either way is a judgment call on intent this port
// isn't the place to make. (The empty-string `visibility: ""` fallback
// itself became `visibility: "visible"` here only because React's CSS
// property types reject `""` - a CSS-equivalent, not a behavioral,
// change: an unset `visibility` and an explicit `"visible"` render
// identically.)
import * as React from "react";
import PasswordInput from "./../Forms/PasswordInput";
import WalletDb from "stores/WalletDb";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import {key} from "bitsharesjs";

interface AccountPermissionsMigrateProps {
    active: string | null;
    owner: string | null;
    memo: string | null;
    onSetPasswordKeys: (keys: {
        active: string | null;
        owner: string | null;
        memo: string | null;
    }) => void;
    account: any;
    activeKeys: string[];
    ownerKeys: string[];
    memoKey: string;
    onAddActive: (key: string, weight: any) => void;
    onRemoveActive: (key: string, suffix: string) => void;
    onAddOwner: (key: string, weight: any) => void;
    onRemoveOwner: (key: string, suffix: string) => void;
    onSetMemo: (key: string, weight: any) => void;
}

export default function AccountPermissionsMigrate(
    props: AccountPermissionsMigrateProps
) {
    const {
        active,
        owner,
        memo,
        onSetPasswordKeys,
        account,
        activeKeys,
        ownerKeys,
        memoKey
    } = props;

    const [generatedPassword] = React.useState(
        () =>
            "P" +
            (key as any)
                .get_random_key()
                .toWif()
                .toString()
    );

    // Empty no-op in the original too - form submission (e.g. pressing
    // Enter in the password field) isn't actually prevented. Preserved
    // exactly rather than "fixed" with a preventDefault() this port
    // would be introducing, not replicating.
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    function onSubmit() {}

    function onPasswordChange(e: any) {
        const {valid} = e;
        const name = account.get("name");

        const newActive = !valid
            ? null
            : (WalletDb as any).generateKeyFromPassword(name, "active", e.value)
                  .pubKey;
        const newOwner = !valid
            ? null
            : (WalletDb as any).generateKeyFromPassword(name, "owner", e.value)
                  .pubKey;
        const newMemo = !valid
            ? null
            : (WalletDb as any).generateKeyFromPassword(name, "memo", e.value)
                  .pubKey;
        onSetPasswordKeys({active: newActive, owner: newOwner, memo: newMemo});
    }

    function checkKeyUse(k: any, role: string) {
        if (!k) return false;
        if (role === "memo") {
            return k === memoKey;
        } else {
            const keys = role === "active" ? activeKeys : ownerKeys;
            return keys.reduce((a, b) => {
                return b === k || a;
            }, false as boolean);
        }
    }

    function onUseKey(role: string, remove = false) {
        if (remove) {
            (props as any)[
                role === "active" ? "onRemoveActive" : "onRemoveOwner"
            ]((props as any)[role], "_keys");
        } else if ((props as any)[role]) {
            const weights = {
                active: account.getIn(["active", "weight_threshold"]),
                owner: account.getIn(["owner", "weight_threshold"])
            };
            console.log(
                "key",
                (props as any)[role],
                "weights",
                weights,
                "weight of role:",
                (weights as any)[role]
            );
            (props as any)[
                role === "active"
                    ? "onAddActive"
                    : role === "owner"
                    ? "onAddOwner"
                    : "onSetMemo"
            ]((props as any)[role], (weights as any)[role]);
        }
    }

    const activeInUse = checkKeyUse(active && active, "active");
    const ownerInUse = checkKeyUse(owner && owner, "owner");
    const memoInUse = checkKeyUse(memo && memo, "memo");

    const useText = counterpart.translate("account.perm.use_text");
    const removeText = counterpart.translate("account.perm.remove_text");

    return (
        <div>
            <p style={{maxWidth: "800px"}}>
                <Translate content="account.perm.password_model_1" />
            </p>

            <p style={{maxWidth: "800px"}}>
                <Translate content="wallet.password_model_1" />
            </p>
            <p style={{maxWidth: "800px"}}>
                <Translate unsafe content="wallet.password_model_2" />
            </p>

            <div className="divider" />

            <form style={{maxWidth: "40rem"}} onSubmit={onSubmit} noValidate>
                <label className="left-label">
                    <Translate content="wallet.generated" />
                </label>
                <p>{generatedPassword}</p>

                <p style={{fontWeight: "bold"}}>
                    <Translate content="account.perm.password_model_2" />
                </p>

                <PasswordInput
                    confirmation={true}
                    onChange={onPasswordChange}
                    noLabel
                    passwordLength={12}
                    checkStrength
                />
            </form>

            <table className="table">
                <tbody>
                    <tr className={activeInUse ? "in-use" : ""}>
                        <td>
                            <Translate content="account.perm.new_active" />:
                        </td>
                        <td>{active}</td>
                        <td className="text-right">
                            <div
                                className="button"
                                onClick={() => onUseKey("active", activeInUse)}
                            >
                                {activeInUse ? removeText : useText}
                            </div>
                        </td>
                    </tr>
                    <tr className={ownerInUse ? "in-use" : ""}>
                        <td>
                            <Translate content="account.perm.new_owner" />:
                        </td>
                        <td>{owner}</td>
                        <td className="text-right">
                            <div
                                className="button"
                                onClick={() => onUseKey("owner", ownerInUse)}
                            >
                                {ownerInUse ? removeText : useText}
                            </div>
                        </td>
                    </tr>
                    <tr className={memoInUse ? "in-use" : ""}>
                        <td>
                            <Translate content="account.perm.new_memo" />:
                        </td>
                        <td>{memo}</td>
                        <td className="text-right">
                            <div
                                className="button"
                                style={{
                                    visibility: memoInUse ? "hidden" : "visible"
                                }}
                                onClick={() => onUseKey("memo", memoInUse)}
                            >
                                {useText}
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            {memoInUse ? (
                <p
                    style={{maxWidth: "800px", paddingTop: 10}}
                    className="has-error"
                >
                    <Translate content="account.perm.memo_warning" />
                </p>
            ) : null}
        </div>
    );
}
