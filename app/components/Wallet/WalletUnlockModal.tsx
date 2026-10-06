// TypeScript/functional-component port of the legacy WalletUnlockModal.jsx
// (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes to
// the actual unlock/restore/backup flow. `AltContainer`'s `inject` map
// (6 stores, several derived-value functions) becomes several
// `useAltStore()` calls plus the same derivations computed inline.
//
// Security-sensitive per AGENTS.md: this is the modal that collects the
// wallet/account password and calls the now-ported, characterization-
// tested `WalletDb.validatePassword`/`isLocked` (app/stores/WalletDb.ts) -
// this file itself performs no cryptography, it only calls into that
// already-verified boundary exactly as before. The typed password lives
// only in local component state, never logged.
//
// Two DELIBERATE, DOCUMENTED simplifications - flagged for the human
// second-reviewer this phase's exit criteria require to specifically
// sanity-check in manual QA (open/close the unlock modal, both login
// modes, watch for any visual glitch):
//
// 1. The original's `shouldComponentUpdate` shallow-compared incoming
//    props/state against current props/state and skipped the render
//    (but NOT the state/props commit itself) when nothing had actually
//    changed - a pure performance guard against `AltContainer` re-running
//    `inject`'s functions on every one of the 6 listened stores' updates.
//    Hooks re-render whenever any `useAltStore`/`useState` dependency
//    changes, which is standard, correct hooks behavior; this port does
//    not attempt to replicate the exact shallow-equality skip, since
//    doing so would need to skip *this component's own* state-triggered
//    re-renders (something `React.memo` cannot do - memo only guards
//    against a parent re-rendering with unchanged props, not a
//    component's own internal state changes) via manual "return the
//    previous render's output" trickery, which risks introducing new,
//    harder-to-spot bugs for a purely cosmetic optimization.
// 2. `shouldComponentUpdate` had one more specific rule: `if
//    (this.state.isOpen && !ns.isOpen) return false;` - skip exactly one
//    render when `isOpen` is about to flip from true to false (letting
//    the `Modal`'s own `visible={isModalVisible}`-driven close transition
//    play out without an immediate extra re-render). Not replicated for
//    the same reason as (1). Worst case this changes is one extra render
//    during the modal's closing transition - not a functional or
//    security difference.
//
// Also dropped as confirmed dead, not ported: `passwordInput()` - defined
// in the original but never called anywhere in the class (grepped), and
// it referenced a `this.refs.custom_password_input` ref that doesn't
// exist anywhere in `render()` either (leftover from an earlier refactor).
// Likewise the original's `AltContainer` also injected `reject` (from
// `WalletUnlockStore.getState().reject`) and `locked` (from
// `WalletUnlockStore.getState().locked`) as props - neither is read
// anywhere in the class body either (grepped both), so this port doesn't
// carry them through.
//
// `isLocked` (`WalletDb.isLocked()`) reads module-private state that
// `WalletDb`'s own store never emits a change for directly (`onLock()`
// and `validatePassword()` never call `this.setState(...)`) - in the
// original, this value only ever refreshes when *some other* listened
// store re-renders `AltContainer` (in practice, `WalletUnlockStore` via
// `WalletUnlockActions.change()` inside `validate()`). This port computes
// `isLocked` fresh on every render the same way, and the
// `useAltStore(WalletUnlockStore)` subscription below provides the same
// triggering re-render, so the reactivity timing matches.
import * as React from "react";
import ZfApi from "common/zfApi";
import WalletDb from "stores/WalletDb";
import WalletUnlockStore from "stores/WalletUnlockStore";
import WalletManagerStore from "stores/WalletManagerStore";
import BackupStore from "stores/BackupStore";
import AccountStore from "stores/AccountStore";
import SettingsStore from "stores/SettingsStore";
import WalletUnlockActions from "actions/WalletUnlockActions";
import WalletActions from "actions/WalletActions";
import BackupActions, {
    restore,
    backup as backupWallet
} from "actions/BackupActions";
import AccountActions from "actions/AccountActions";
import SettingsActions from "actions/SettingsActions";
import {Apis} from "bitsharesjs-ws";
import {
    Modal,
    Button,
    Form,
    Input,
    Switch,
    InputNumber,
    Tooltip,
    Notification
} from "bitshares-ui-style-guide";
import AccountSelector from "../Account/AccountSelectorAnt";
import {PrivateKey} from "bitsharesjs";
import {saveAs} from "file-saver";
import LoginTypeSelector from "./LoginTypeSelector";
import counterpart from "counterpart";
import {
    WalletSelector,
    CreateLocalWalletLink,
    WalletDisplay,
    BackupWarning,
    BackupFileSelector,
    DisableChromeAutocomplete,
    KeyFileLabel
} from "./WalletUnlockModalLib";
import {backupName} from "common/backupUtils";
import {withRouter} from "react-router-dom";
import {setLocalStorageType, isPersistantType} from "lib/common/localStorage";
import Translate from "react-translate-component";
import Icon from "../Icon/Icon";
import {useAltStore} from "../../next/hooks/useAltStore";

function WalletUnlockModal({
    modalId = "unlock_wallet_modal2",
    history
}: {
    modalId?: string;
    history: any;
}) {
    const walletUnlockState = useAltStore<any>(WalletUnlockStore as any);
    const accountState = useAltStore<any>(AccountStore as any);
    const walletManagerState = useAltStore<any>(WalletManagerStore as any);
    // Subscribing (not just reading getWallet() once) matters:
    // WalletDb.setState({wallet}) (from onCreateWallet/_updateWallet/etc.)
    // is what makes `dbWallet` refresh reactively here, exactly like the
    // original AltContainer's `stores={[..., WalletDb, ...]}` did.
    useAltStore<any>(WalletDb as any);
    const dbWallet = (WalletDb as any).getWallet();
    const backupState = useAltStore<any>(BackupStore as any);
    const settingsState = useAltStore<any>(SettingsStore as any);

    const currentWallet = walletManagerState.current_wallet;
    const walletNames = walletManagerState.wallet_names;
    const isLocked = (WalletDb as any).isLocked();
    const resolve = walletUnlockState.resolve;
    const passwordLogin = walletUnlockState.passwordLogin;
    const passwordAccount = accountState.passwordAccount || "";
    const walletLockTimeout = settingsState.settings.get("walletLockTimeout");

    const accountInputRef = React.useRef<any>(null);
    const passwordInputRef = React.useRef<any>(null);
    const passwordInput2Ref = React.useRef<any>(null);

    const [isModalVisible, setIsModalVisible] = React.useState(false);
    const [passwordError, setPasswordError] = React.useState<any>(null);
    const [accountName, setAccountName] = React.useState(passwordAccount);
    const [walletSelected, setWalletSelected] = React.useState(!!currentWallet);
    const [customError, setCustomError] = React.useState<any>(null);
    const [isOpen, setIsOpen] = React.useState(false);
    const [restoringBackup, setRestoringBackup] = React.useState(false);
    const [stopAskingForBackup, setStopAskingForBackup] = React.useState(false);
    const [rememberMe, setRememberMe] = React.useState(
        walletUnlockState.rememberMe
    );
    const [focusedOnce, setFocusedOnce] = React.useState(false);
    const [isAutoLockVisible, setIsAutoLockVisible] = React.useState(false);
    const [password, setPassword] = React.useState("");

    const resetToInitialState = () => {
        setIsModalVisible(false);
        setPasswordError(null);
        setAccountName(passwordAccount);
        setWalletSelected(!!currentWallet);
        setCustomError(null);
        setIsOpen(false);
        setRestoringBackup(false);
        setStopAskingForBackup(false);
        setRememberMe((WalletUnlockStore as any).getState().rememberMe);
        setFocusedOnce(false);
        setIsAutoLockVisible(false);
        setPassword("");
    };

    // Mirrors UNSAFE_componentWillReceiveProps: updates local state from
    // freshly-injected values on every render where they've actually
    // changed, tracked via refs holding the previous render's values
    // (since this port has no separate "props" object to diff against).
    const prevCurrentWalletRef = React.useRef(currentWallet);
    const prevPasswordLoginRef = React.useRef(passwordLogin);
    if (prevCurrentWalletRef.current !== currentWallet) {
        // Updating the accountname through the listener breaks UX (#2335)
        if (walletSelected && !restoringBackup && !currentWallet)
            setWalletSelected(false);
        prevCurrentWalletRef.current = currentWallet;
    }
    if (prevPasswordLoginRef.current !== passwordLogin) {
        setPasswordError(false);
        setCustomError(null);
        prevPasswordLoginRef.current = passwordLogin;
    }

    const handlePasswordChange = (event: any) => {
        setPassword(event.target.value);
    };

    const handleModalClose = () => {
        (WalletUnlockActions as any).cancel();
        (BackupActions as any).reset();
        resetToInitialState();
    };

    const shouldShowBackupWarning = () =>
        !passwordLogin &&
        walletSelected &&
        !restoringBackup &&
        !(!!dbWallet && !!dbWallet.backup_date);

    const shouldUseBackupLogin = () =>
        shouldShowBackupWarning() && !stopAskingForBackup;

    const doBackup = () =>
        backupWallet(dbWallet.password_pubkey).then((contents: any) => {
            const name = backupName(currentWallet);
            (BackupActions as any).incommingBuffer({name, contents});

            const blob = new Blob([backupState.contents], {
                type: "application/octet-stream; charset=us-ascii"
            });
            if (blob.size !== backupState.size)
                throw new Error("Invalid backup to download conversion");
            saveAs(blob, name);
            (WalletActions as any).setBackupDate();
            (BackupActions as any).reset();
        });

    const validate = (validatePassword: string, account?: string | null) => {
        const {cloudMode} = (WalletDb as any).validatePassword(
            validatePassword || "",
            true, //unlock
            account
        );

        if ((WalletDb as any).isLocked()) {
            setPasswordError(true);
        } else {
            setPassword("");
            if (passwordLogin && cloudMode)
                (AccountActions as any).setPasswordAccount(account);
            (WalletUnlockActions as any).change();
            if (stopAskingForBackup) (WalletActions as any).setBackupDate();
            else if (shouldUseBackupLogin()) doBackup();
            resolve();
            (WalletUnlockActions as any).cancel();
        }
    };

    const restoreBackup = (restorePassword: string, callback: () => void) => {
        const privateKey = (PrivateKey as any).fromSeed(restorePassword || "");
        const walletName = backupState.name.split(".")[0];
        restore(privateKey.toWif(), backupState.contents, walletName)
            .then(() => {
                return (WalletActions as any)
                    .setWallet(walletName)
                    .then(() => {
                        (BackupActions as any).reset();
                        callback();
                    })
                    .catch((e: any) => setCustomError(e.message));
            })
            .catch((e: any) => {
                const message = typeof e === "string" ? e : e.message;
                const invalidBackupPassword =
                    message === "invalid_decryption_key";
                setCustomError(invalidBackupPassword ? null : message);
                setPasswordError(invalidBackupPassword);
            });
    };

    const handleLogin = (e?: any) => {
        if (e) e.preventDefault();

        if (!passwordLogin && !walletSelected) {
            setCustomError(
                counterpart.translate("wallet.ask_to_select_wallet")
            );
        } else {
            setPasswordError(null);
            // The original's setState({passwordError: null}, callback)
            // ran the rest of handleLogin in the setState callback (after
            // the passwordError update was applied) - since nothing in
            // the body below reads passwordError, running it synchronously
            // here is equivalent.
            if (!passwordLogin && backupState.name) {
                restoreBackup(password, () => validate(password));
            } else {
                if (!rememberMe) {
                    if (isPersistantType()) {
                        setLocalStorageType("inram");
                    }
                } else {
                    if (!isPersistantType()) {
                        setLocalStorageType("persistant");
                    }
                }
                const account = passwordLogin ? accountName : null;
                validate(password, account);
            }
        }
    };

    const closeRedirect = (path: string) => {
        (WalletUnlockActions as any).cancel();
        history.push(path);
    };

    const handleCreateWallet = () => closeRedirect("/create-account/wallet");
    const handleRestoreOther = () => closeRedirect("/settings/restore");

    const loadBackup = (e: any) => {
        const file = e.target.files[0];

        // Original also derived a `filename` from `e.target.value` here
        // (stripping the directory portion) - confirmed dead, dropped:
        // the computed `filename` was never actually used for anything
        // (BackupActions.incommingWebFile takes the File object itself).
        setRestoringBackup(true);
        (BackupActions as any).incommingWebFile(file);
        setWalletSelected(true);
    };

    const handleSelectedWalletChange = (e: any) => {
        const {value} = e.target;
        const selectionType = value.split(".")[0];
        const walletNameSelected = value.substring(value.indexOf(".") + 1);

        (BackupActions as any).reset();
        if (selectionType === "upload") {
            setRestoringBackup(true);
            setCustomError(null);
        } else
            (WalletActions as any).setWallet(walletNameSelected).then(() => {
                setWalletSelected(true);
                setCustomError(null);
                setRestoringBackup(false);
            });
    };

    const handleAskForBackupChange = (e: any) =>
        setStopAskingForBackup(e.target.checked);

    const handleUseOtherWallet = () => {
        setWalletSelected(false);
        setRestoringBackup(false);
        setPasswordError(null);
        setCustomError(null);
    };

    const handleAccountNameChange = (newAccountName: string) => {
        setAccountName(newAccountName);
    };

    const handleRememberMe = () => {
        const newRememberMe = !rememberMe;
        setRememberMe(newRememberMe);
        (SettingsActions as any).changeSetting({
            setting: "rememberMe",
            value: newRememberMe
        });
    };

    const handleWalletAutoLock = (val: any) => {
        let newValue = parseInt(val, 10);
        if (isNaN(newValue)) newValue = 0;
        if (!isNaN(newValue) && typeof newValue === "number") {
            (SettingsActions as any).changeSetting({
                setting: "walletLockTimeout",
                value: newValue
            });
        }
    };

    // Mirrors componentDidMount's ZfApi.subscribe: subscribes once, but
    // the callback always reads the *current* isOpen/handlers via refs
    // kept fresh every render (a plain [] effect would otherwise close
    // over the first render's stale values).
    const isOpenRef = React.useRef(isOpen);
    isOpenRef.current = isOpen;
    const handleModalCloseRef = React.useRef(handleModalClose);
    handleModalCloseRef.current = handleModalClose;
    const handleModalOpenTriggerRef = React.useRef<() => void>(() => {});

    React.useEffect(() => {
        ZfApi.subscribe(modalId, (name: string, msg: string) => {
            if (name !== modalId) return;
            if (msg === "close" && isOpenRef.current) {
                handleModalCloseRef.current();
            } else if (msg === "open" && !isOpenRef.current) {
                handleModalOpenTriggerRef.current();
            }
        });
        // eslint-disable-next-line
    }, [modalId]);

    const handleModalOpen = () => {
        (BackupActions as any).reset();
        setIsOpen(true);
    };
    handleModalOpenTriggerRef.current = handleModalOpen;

    // Mirrors handleModalOpen's setState(..., callback): the callback ran
    // after `isOpen` was applied, reading props current at that point.
    // This effect fires whenever `isOpen` changes and only acts when it
    // became true, which is the same "just opened" timing.
    const isFirstOpenEffectRef = React.useRef(true);
    React.useEffect(() => {
        if (isFirstOpenEffectRef.current) {
            isFirstOpenEffectRef.current = false;
            return;
        }
        if (!isOpen) return;
        if (!passwordLogin) {
            if (passwordInput2Ref.current) {
                passwordInput2Ref.current.clear();
                passwordInput2Ref.current.focus();
            }

            if (
                dbWallet &&
                (Apis as any).instance().chain_id !== dbWallet.chain_id
            ) {
                Notification.error({
                    message: counterpart.translate(
                        "notifications.wallet_unlock_different_block_chain",
                        {
                            expectedWalletId: dbWallet.chain_id
                                .substring(0, 4)
                                .toUpperCase(),
                            actualWalletId: (Apis as any)
                                .instance()
                                .chain_id.substring(0, 4)
                                .toUpperCase()
                        }
                    )
                });
                (WalletUnlockActions as any).cancel();
            }
        }
        // eslint-disable-next-line
    }, [isOpen]);

    // Mirrors componentDidUpdate's focus-management + forceUpdate retry,
    // and its resolve()/isModalVisible sync - runs after every render,
    // same as componentDidUpdate (harmless on the very first render too,
    // since focusedOnce/isModalVisible start false).
    const [, forceRenderTick] = React.useState(0);
    React.useEffect(() => {
        if (!focusedOnce && isModalVisible && passwordLogin) {
            const account_input = accountInputRef.current;
            const password_input = passwordInputRef.current;

            if (!account_input || !password_input) {
                forceRenderTick(n => n + 1);
            }
            if (accountName && password_input) {
                password_input.input.focus();
                setFocusedOnce(true);
            } else if (
                account_input &&
                account_input.input &&
                typeof account_input.focus === "function"
            ) {
                account_input.focus();
                setFocusedOnce(true);
            }
        } else if (!focusedOnce && isModalVisible && !passwordLogin) {
            const password_input = passwordInput2Ref.current;
            if (!password_input) {
                forceRenderTick(n => n + 1);
            }
            if (password_input) {
                password_input.input.focus();
                setFocusedOnce(true);
            }
        }

        if (resolve) {
            if (isLocked) {
                setIsModalVisible(true);
            } else {
                resolve();
            }
        } else {
            setIsModalVisible(false);
            setPassword("");
        }
    });

    const noWalletNames = !(walletNames.size > 0);
    const noLocalWallet = noWalletNames && !walletSelected;
    const walletDisplayName = backupState.name || currentWallet;
    const errorMessage = passwordError
        ? counterpart.translate("wallet.pass_incorrect")
        : customError;
    // Modal overlayClose must be false pending a fix that allows us to detect
    // this event and clear the password (via this.refs.password_input.clear())
    // https://github.com/akiran/react-foundation-apps/issues/34

    const footer: any[] = [];
    if (passwordLogin) {
        footer.push(
            <Tooltip
                key="wallet.remember_me_explanation"
                title={counterpart.translate("wallet.remember_me_explanation")}
            >
                <div
                    style={{
                        float: "left",
                        cursor: "pointer",
                        marginTop: "6px"
                    }}
                    onClick={handleRememberMe}
                >
                    <Translate content="wallet.remember_me" />
                    <Switch checked={rememberMe} onChange={handleRememberMe} />
                </div>
            </Tooltip>
        );
        footer.push(
            <div
                style={{float: "left"}}
                key="settings.walletLockTimeoutTooltip"
            >
                <span>
                    <Tooltip
                        title={counterpart.translate(
                            "settings.walletLockTimeoutTooltip"
                        )}
                    >
                        <span>
                            <Icon
                                onClick={() => {
                                    setIsAutoLockVisible(!isAutoLockVisible);
                                }}
                                name={"autolock"}
                                size={"1_5x"}
                                style={{
                                    cursor: "pointer",
                                    top: "5px",
                                    position: "relative",
                                    marginLeft: "12px"
                                }}
                            />
                        </span>
                    </Tooltip>
                    {isAutoLockVisible && (
                        <Tooltip
                            title={counterpart.translate(
                                "settings.walletLockTimeout"
                            )}
                        >
                            <InputNumber
                                value={walletLockTimeout}
                                onChange={handleWalletAutoLock}
                                placeholder="Auto-lock after..."
                                style={{
                                    marginLeft: "7px",
                                    width: "65px"
                                }}
                            />
                        </Tooltip>
                    )}
                </span>
            </div>
        );
    }
    footer.push(
        <span className="auto-lock-wrapper" key="wallet.backup_login">
            <Button onClick={handleLogin} key="login-btn">
                {counterpart.translate(
                    shouldUseBackupLogin()
                        ? "wallet.backup_login"
                        : "header.unlock_short"
                )}
            </Button>
        </span>
    );

    return (
        // U N L O C K
        <Modal
            title="Login"
            visible={isModalVisible}
            wrapClassName={"unlock_wallet_modal2"}
            id={modalId}
            closeable={false}
            overlay={true}
            overlayClose={false}
            modalHeader="header.unlock_short"
            onCancel={handleModalClose}
            leftHeader
            footer={footer}
            zIndex={1001} // always on top
        >
            <Form className="full-width" layout="vertical">
                <LoginTypeSelector />
                {passwordLogin ? (
                    <div>
                        <DisableChromeAutocomplete />
                        <AccountSelector
                            label="account.name"
                            inputRef={accountInputRef} // needed for ref forwarding to Input
                            accountName={accountName}
                            account={accountName}
                            onChange={handleAccountNameChange}
                            onAccountChanged={() => {}}
                            size={60}
                            hideImage
                            placeholder=" "
                            useHR
                            labelClass="login-label"
                            reserveErrorSpace
                        />

                        <Form.Item
                            label={counterpart.translate("settings.password")}
                            validateStatus={passwordError ? "error" : ""}
                            help={passwordError || ""}
                        >
                            <Input
                                type="password"
                                value={password}
                                onChange={handlePasswordChange}
                                onPressEnter={handleLogin}
                                ref={(input: any) => {
                                    passwordInputRef.current = input;
                                }}
                            />
                        </Form.Item>
                    </div>
                ) : (
                    <div>
                        <div
                            className={
                                "key-file-selector " +
                                (restoringBackup && !walletSelected
                                    ? "restoring"
                                    : "")
                            }
                        >
                            <KeyFileLabel
                                showUseOtherWalletLink={
                                    restoringBackup && !backupState.name
                                }
                                onUseOtherWallet={handleUseOtherWallet}
                            />
                            <hr />
                            {walletSelected ? (
                                <WalletDisplay
                                    name={walletDisplayName}
                                    onUseOtherWallet={handleUseOtherWallet}
                                />
                            ) : (
                                <div>
                                    {restoringBackup || noWalletNames ? (
                                        <BackupFileSelector
                                            onFileChosen={loadBackup}
                                            onRestoreOther={handleRestoreOther}
                                        />
                                    ) : (
                                        <WalletSelector
                                            restoringBackup={restoringBackup}
                                            walletNames={walletNames}
                                            onWalletChange={
                                                handleSelectedWalletChange
                                            }
                                        />
                                    )}
                                    {noLocalWallet && (
                                        <CreateLocalWalletLink
                                            onCreate={handleCreateWallet}
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        <Form.Item
                            label={counterpart.translate(
                                "wallet.enter_password"
                            )}
                            validateStatus={errorMessage ? "error" : "success"}
                            help={errorMessage}
                        >
                            <Input
                                type="password"
                                value={password}
                                placeholder={counterpart.translate(
                                    "wallet.enter_password"
                                )}
                                onChange={handlePasswordChange}
                                onPressEnter={handleLogin}
                                ref={(input: any) => {
                                    passwordInput2Ref.current = input;
                                }}
                            />
                        </Form.Item>
                    </div>
                )}

                {shouldShowBackupWarning() && (
                    <BackupWarning
                        onChange={handleAskForBackupChange}
                        checked={stopAskingForBackup}
                    />
                )}
            </Form>
        </Modal>
    );
}

const WalletUnlockModalWithRouter: any = withRouter(WalletUnlockModal as any);

export default function WalletUnlockModalContainer(props: any) {
    return <WalletUnlockModalWithRouter {...props} />;
}
