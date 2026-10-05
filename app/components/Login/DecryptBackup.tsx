// TypeScript/functional-component port of the legacy DecryptBackup.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md), part of the `Login/` directory
// (4 files, directory complete). Mechanical class-to-hooks translation,
// no logic changes to the wallet-backup-decryption flow itself.
//
// SECURITY (AGENTS.md): this file handles the raw wallet-backup password
// directly. `onRestore()`'s `WalletDb.validatePassword(backupPassword ||
// "", true)` (unlock) followed by `WalletUnlockActions.change()`, and
// `onPassword()`'s `PrivateKey.fromSeed(this.state.backupPassword ||
// "")`, are preserved byte-for-byte: same arguments, same call order,
// same surrounding `restore(...).then(...).catch(...)` control flow.
// Nothing new logs, persists, or caches this password - it still lives
// only in component state (`backupPassword`, now via `useState` instead
// of `this.state`) for exactly as long as the original kept it there;
// that's the same pre-existing, expected persistence, not a new one.
//
// Grepped every `console.*` call in this file: exactly one,
// `console.error(\`Error verifying wallet ${name}\`, error, error.stack)`
// in `onPassword`'s `.catch()`. It logs only the wallet's *name* and the
// thrown error/stack - never the password, brainkey, or any private key
// material - so it's kept verbatim. No password-logging `console.*` call
// was found anywhere in this file.
//
// `connect(DecryptBackup, {listenTo: [WalletManagerStore, BackupStore,
// AccountStore], getProps})` becomes an outer `DecryptBackup` wrapper
// calling `useAltStore` once per store and passing the store-derived
// values down to a `DecryptBackupCore` function - this migration's
// established Container+Core split (see `Account/
// AccountPortfolioList.tsx`'s header comment for the general pattern and
// a worked prop-precedence example). Precedence preserved exactly:
// alt-react's `connect` renders `<Component {...this.props}
// {...this.getNextProps()} />`, so store-derived `wallet`/`backup`/
// `currentAccount` always win over any same-named prop the caller passed
// directly - replicated by spreading `{...props}` first, then the three
// store-derived props, in the wrapper below.
//
// `wallet` (from `WalletManagerStore`) is declared via `propTypes`/
// `defaultProps` but never actually referenced anywhere in `render()` or
// any handler in the original (grep-confirmed: no `this.props.wallet`
// read anywhere besides its own declaration) - `useAltStore
// (WalletManagerStore)` is still called and its value is still passed
// down as the (here, unused) `wallet` prop, purely to preserve the
// original's subscribe-for-re-render-only side effect, matching this
// migration's established "connect wrap with an otherwise-unused store"
// treatment (e.g. `Account/CreditRightsList.tsx`/`CreateModal.tsx`'s
// `useAltStore(AccountStore)`).
//
// `componentDidUpdate(prevProps)` becomes a dependency-free `useEffect`
// (fires after every render, matching `componentDidUpdate`'s "runs after
// every update" semantics exactly, since this component has no
// `shouldComponentUpdate`), skipped on the first (mount) run via an
// `isMountRef` guard - `componentDidUpdate` never fires on mount either.
// Both of its effects are preserved: focusing the password input ref
// when `active` is true (now a plain `useRef` instead of the legacy
// string ref `this.refs.passwordInput`, guarded exactly as the original
// guarded it: `if (ref.current && ref.current.focus)`), and navigating
// to `/` via `history.push("/")` the first time `currentAccount` becomes
// truthy (tracked with a small `prevCurrentAccountRef` mirror of the
// previous render's `currentAccount`, since a hooks effect has no
// built-in access to "previous props"). Note this also means the
// password-input `.focus()` call re-fires on every keystroke while
// `active` stays true (calling `.focus()` on an already-focused element
// is a no-op) - that's not a new quirk, it's exactly what the original
// class's unconditional `componentDidUpdate` already did on every
// `backupPassword` state change too.
//
// The legacy string ref (`ref="passwordInput"`) is otherwise plain
// internal UI state - grepped app-wide for `Login/DecryptBackup` and for
// any external ref into this component: none found, so no
// `forwardRef`/`useImperativeHandle` is needed.
//
// `formChange`'s dynamic computed-property assignment
// (`state[event.target.id] = event.target.value`) is preserved as a
// generic `mergeState({[event.target.id]: event.target.value, formError:
// ""})`, cast through `any` only because TypeScript can't structurally
// type an arbitrary string-keyed assignment against a concrete state
// interface - the single real call site always uses
// `id="backupPassword"`, same as the original.
//
// TS-forced adjustment: the `Notification` import from
// `bitshares-ui-style-guide` (grep-confirmed: never referenced anywhere
// in the original file body, only imported alongside `Button`/`Form`/
// `Input`) is dropped - ESLint's `no-unused-vars` would otherwise fail
// on it, and it was already dead weight in the original.
//
// Old `.jsx` original removed in this commit (see the batch commit
// covering all 4 `Login/` files together).
import * as React from "react";
import {PrivateKey} from "bitsharesjs/es";
import WalletManagerStore from "stores/WalletManagerStore";
import BackupStore from "stores/BackupStore";
import AccountStore from "stores/AccountStore";
import WalletActions from "actions/WalletActions";
import WalletDb from "stores/WalletDb";
import WalletUnlockActions from "actions/WalletUnlockActions";
import BackupActions, {restore} from "actions/BackupActions";
import SettingsActions from "actions/SettingsActions";
import Icon from "../Icon/Icon";
import {Button, Form, Input} from "bitshares-ui-style-guide";
import counterpart from "counterpart";
import {useAltStore} from "../../next/hooks/useAltStore";

interface DecryptBackupState {
    backupPassword: string;
    formError: any;
    passwordError?: boolean;
    passwordVisible?: boolean;
}

interface DecryptBackupCoreProps {
    active?: boolean;
    currentAccount?: string;
    backup?: any;
    wallet?: any;
    history: any;
}

function DecryptBackupCore({
    active = false,
    currentAccount = "",
    backup = {},
    history
}: DecryptBackupCoreProps) {
    const [state, setState] = React.useState<DecryptBackupState>({
        backupPassword: "",
        formError: ""
    });
    const mergeState = (patch: Partial<DecryptBackupState>) =>
        setState(prev => ({...prev, ...patch}));
    const stateRef = React.useRef(state);
    stateRef.current = state;

    const passwordInputRef = React.useRef<any>(null);

    const isMountRef = React.useRef(true);
    const prevCurrentAccountRef = React.useRef(currentAccount);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            prevCurrentAccountRef.current = currentAccount;
            return;
        }
        if (active) {
            if (passwordInputRef.current && passwordInputRef.current.focus) {
                passwordInputRef.current.focus();
            }
        }
        if (!prevCurrentAccountRef.current && currentAccount) {
            history.push("/");
        }
        prevCurrentAccountRef.current = currentAccount;
    });

    const onRestore = () => {
        const {backupPassword} = stateRef.current;
        WalletDb.validatePassword(backupPassword || "", true);
        (WalletUnlockActions as any).change();
        SettingsActions.changeSetting({
            setting: "passwordLogin",
            value: false
        });
        BackupActions.reset();
    };

    const onPassword = (e?: any) => {
        if (e) e.preventDefault();
        const privateKey = (PrivateKey as any).fromSeed(
            stateRef.current.backupPassword || ""
        );
        const {contents, name} = backup;
        const walletName = name.split(".")[0];
        restore(privateKey.toWif(), contents, walletName)
            .then(() => {
                return (WalletActions as any).setWallet(walletName).then(() => {
                    onRestore();
                });
            })
            .catch((error: any) => {
                console.error(
                    `Error verifying wallet ${backup.name}`,
                    error,
                    error.stack
                );
                if (error === "invalid_decryption_key") {
                    mergeState({
                        formError: counterpart.translate(
                            "notifications.invalid_password"
                        )
                    });
                } else {
                    mergeState({
                        formError: error
                    });
                }
                mergeState({passwordError: true});
            });
    };

    const formChange = (event: any) => {
        mergeState({
            [event.target.id]: event.target.value,
            formError: ""
        } as any);
    };

    const renderButtons = () => {
        return (
            <div className="button-group">
                {active ? (
                    <Button onClick={onPassword} type="primary">
                        {counterpart.translate("login.loginButton")}
                    </Button>
                ) : (
                    <Button>
                        {counterpart.translate("registration.select")}
                    </Button>
                )}
            </div>
        );
    };

    const getPasswordInputValidateStatus = () => {
        return state.formError ? "error" : "";
    };

    const getPasswordInputHelp = () => {
        return state.formError ? state.formError : "";
    };

    return (
        <div>
            <div className={`${!active ? "display-none" : ""} password-block`}>
                <Form
                    layout="vertical"
                    style={{textAlign: "left"}}
                    onSubmit={onPassword}
                >
                    <Form.Item
                        label={counterpart.translate("settings.password")}
                        validateStatus={getPasswordInputValidateStatus()}
                        help={getPasswordInputHelp()}
                    >
                        <Input
                            className={`${
                                state.passwordError
                                    ? "input-warning"
                                    : state.backupPassword
                                    ? "input-success"
                                    : ""
                            } input create-account-input`}
                            type={!state.passwordVisible ? "password" : "text"}
                            placeholder={counterpart.translate(
                                "wallet.enter_password"
                            )}
                            id="backupPassword"
                            onChange={formChange}
                            value={state.backupPassword}
                            ref={passwordInputRef}
                            autoFocus={true}
                        />
                    </Form.Item>
                </Form>
                {!state.passwordVisible ? (
                    <span
                        className="no-width eye-block"
                        onClick={() => mergeState({passwordVisible: true})}
                    >
                        <Icon
                            name="eye-visible"
                            className="eye-icon icon-opacity"
                        />
                    </span>
                ) : (
                    <span
                        className="no-width eye-block"
                        onClick={() => mergeState({passwordVisible: false})}
                    >
                        <Icon
                            name="eye-invisible"
                            className="eye-icon icon-opacity"
                        />
                    </span>
                )}
            </div>
            {renderButtons()}
        </div>
    );
}

interface DecryptBackupProps {
    active?: boolean;
    history: any;
}

function DecryptBackup(props: DecryptBackupProps) {
    const wallet = useAltStore<any>(WalletManagerStore);
    const backup = useAltStore<any>(BackupStore);
    const accountState = useAltStore<any>(AccountStore);
    const currentAccount =
        accountState.currentAccount || accountState.passwordAccount;

    return (
        <DecryptBackupCore
            {...props}
            wallet={wallet}
            backup={backup}
            currentAccount={currentAccount}
        />
    );
}

export default DecryptBackup;
