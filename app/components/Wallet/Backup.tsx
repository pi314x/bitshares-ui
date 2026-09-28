// TypeScript/functional-component port of the legacy Backup.jsx (Phase 5,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes. All 11
// `connect(..., connectObject)`-wrapped class components (all listening to
// the same [WalletManagerStore, BackupStore] pair) become function
// components sharing the `useWalletBackup()` hook below in place of the
// shared `connectObject`.
//
// Security-sensitive per AGENTS.md: calls the real
// `backup()`/`decryptWalletBackup()` (app/actions/BackupActions.ts, ported
// alongside this file and characterized against fixed vectors in
// app/__tests__/wallets/backupCrypto-test.js) and
// `WalletActions.restore(...)` exactly as before. Backup file contents and
// the decrypted wallet object live only in `BackupStore`'s existing
// in-memory state, never logged beyond the original's own
// `console.error` calls.
//
// Lifecycle timing notes (translated per-component, not uniformly):
// - `UNSAFE_componentWillMount` runs once, synchronously, *before* the
//   first paint - translated with either a `useState` lazy initializer
//   (when it produces this component's own initial state, as in
//   `NewWalletName`) or a `useRef` mount-guard checked directly in the
//   render body (when it's a side effect only, as in `BackupRestore`'s
//   `BackupActions.reset()`) - NOT a `useEffect`, which would run *after*
//   first paint and introduce a one-frame flash the original never had.
// - `componentDidMount` (no first-paint timing constraint, since nothing
//   it sets is read by that same initial `render()`) is a plain
//   mount-only `useEffect(() => {...}, [])`.
//
// Dropped as confirmed dead, not ported: `Upload`'s legacy string ref
// (`ref="file_input"`) - `this.refs.file_input` is referenced only inside
// a commented-out line in the original, never actually read.
import * as React from "react";
import {Link, LinkProps} from "react-router-dom";
import {FormattedDate} from "react-intl";
import WalletActions from "actions/WalletActions";
import WalletManagerStore from "stores/WalletManagerStore";
import BackupStore from "stores/BackupStore";
import WalletDb from "stores/WalletDb";
import BackupActions, {
    backup,
    decryptWalletBackup
} from "actions/BackupActions";
import {saveAs} from "file-saver";
import Translate from "react-translate-component";
import {PrivateKey} from "bitsharesjs";
import SettingsActions from "actions/SettingsActions";
import {backupName} from "common/backupUtils";
import {getWalletName} from "branding";
import {Button, Input, Notification} from "bitshares-ui-style-guide";
import counterpart from "counterpart";
import {useAltStore} from "../../next/hooks/useAltStore";

// See Explorer/Blocks.tsx's comment on `TypedLink` for why this cast is
// needed - `Link`'s inferred return type isn't a valid JSX element type
// under this project's React/TS version combination.
const TypedLink = Link as React.ComponentType<LinkProps>;

function useWalletBackup() {
    const wallet = useAltStore<any>(WalletManagerStore as any);
    const backupState = useAltStore<any>(BackupStore as any);
    return {wallet, backup: backupState};
}

//The default component is WalletManager.jsx
export function BackupCreate({
    noText,
    location,
    downloadCb
}: {
    noText?: boolean;
    location?: any;
    downloadCb?: () => void;
}) {
    return (
        <div style={{maxWidth: "40rem"}}>
            <Create
                noText={noText}
                newAccount={
                    location && location.query
                        ? location.query.newAccount
                        : null
                }
            >
                <NameSizeModified />
                {noText ? null : <Sha1 />}
                <Download downloadCb={downloadCb} />
            </Create>
        </div>
    );
}

// layout is a small project
// class WalletObjectInspector extends Component {
//     static propTypes={ walletObject: PropTypes.object }
//     render() {
//         return <div style={{overflowY:'auto'}}>
//             <Inspector
//                 data={ this.props.walletObject || {} }
//                 search={false}/>
//         </div>
//     }
// }

export function BackupRestore() {
    // The original's render() also computed `new_wallet`/`has_new_wallet`/
    // `restored` from `this.props.wallet` here, but never actually used
    // them in its returned JSX - confirmed dead (re-read the whole
    // original method), so dropped along with the otherwise-unused
    // `useWalletBackup()` subscription that fed them. This component's
    // children (Upload, DecryptBackup, NewWalletName, Restore, ...) each
    // independently subscribe to WalletManagerStore/BackupStore
    // themselves, so dropping this component's own unused subscription
    // doesn't change their reactivity - it only removes renders of this
    // component that never changed its own output.
    const resetOnceRef = React.useRef(false);
    if (!resetOnceRef.current) {
        resetOnceRef.current = true;
        (BackupActions as any).reset();
    }

    const wallet_types = (
        <TypedLink to="/help/introduction/wallets">
            {counterpart.translate("wallet.wallet_types")}
        </TypedLink>
    );
    const backup_types = (
        <TypedLink to="/help/introduction/backups">
            {counterpart.translate("wallet.backup_types")}
        </TypedLink>
    );

    return (
        <div>
            <Translate
                style={{textAlign: "left", maxWidth: "30rem"}}
                component="p"
                content="wallet.import_backup_choose"
            />
            <Translate
                className="text-left"
                component="p"
                wallet={wallet_types}
                backup={backup_types}
                content="wallet.read_more"
            />
            {/* `as any`: real runtime feature-detection (some browsers lack
                readAsBinaryString) - TS's lib.dom.d.ts always declares the
                method present, so without the cast it flags this as an
                always-true condition. */}
            {(new FileReader() as any).readAsBinaryString ? null : (
                <p className="error">
                    Warning! You browser doesn&apos;t support some some file
                    operations required to restore backup, we recommend you to
                    use Chrome or Firefox browsers to restore your backup.
                </p>
            )}
            <Upload>
                <NameSizeModified />
                <DecryptBackup saveWalletObject={true}>
                    <NewWalletName>
                        <Restore />
                    </NewWalletName>
                </DecryptBackup>
            </Upload>
            <br />
            <TypedLink to="/">
                <Button>
                    <Translate content="wallet.back" />
                </Button>
            </TypedLink>
        </div>
    );
}

export function Restore({children}: {children?: any}) {
    const {wallet, backup: backupState} = useWalletBackup();
    const new_wallet = wallet.new_wallet;
    const has_new_wallet = wallet.wallet_names.has(new_wallet);

    const onRestore = () => {
        (WalletActions as any).restore(
            wallet.new_wallet,
            backupState.wallet_object
        );
        (SettingsActions as any).changeSetting({
            setting: "passwordLogin",
            value: false
        });
    };

    if (has_new_wallet)
        return (
            <span>
                <h5>
                    <Translate
                        content="wallet.restore_success"
                        name={new_wallet.toUpperCase()}
                    />
                </h5>
                <TypedLink to="/">
                    <Button type="primary">
                        <Translate
                            component="span"
                            content="header.dashboard"
                        />
                    </Button>
                </TypedLink>
                <div>{children}</div>
            </span>
        );

    return (
        <span>
            <h3>
                <Translate content="wallet.ready_to_restore" />
            </h3>
            <Button type="primary" onClick={onRestore}>
                <Translate
                    content="wallet.restore_wallet_of"
                    name={new_wallet}
                />
            </Button>
        </span>
    );
}

export function NewWalletName({children}: {children?: any}) {
    const {wallet, backup: backupState} = useWalletBackup();

    // Lazy initializer: runs once, synchronously, before the first paint -
    // mirrors the original's UNSAFE_componentWillMount timing exactly.
    // Both useState calls share the same computation via a memoized ref so
    // it only actually runs once, not once per useState call.
    const initialRef = React.useRef<{
        new_wallet: string | null;
        accept: boolean;
    } | null>(null);
    if (initialRef.current === null) {
        const has_current_wallet = !!wallet.current_wallet;
        if (!has_current_wallet) {
            let walletName = "default";
            if (backupState.name) {
                walletName = backupState.name.match(/[a-z0-9_-]*/)[0];
            }
            (WalletManagerStore as any).setNewWallet(walletName);
            initialRef.current = {new_wallet: null, accept: true};
        } else if (backupState.name) {
            // begning of the file name might make a good wallet name
            const new_wallet = backupState.name
                .toLowerCase()
                .match(/[a-z0-9_-]*/)[0];
            initialRef.current = new_wallet
                ? {new_wallet, accept: false}
                : {new_wallet: null, accept: false};
        } else {
            initialRef.current = {new_wallet: null, accept: false};
        }
    }

    const [newWallet, setNewWallet] = React.useState<string | null>(
        initialRef.current.new_wallet
    );
    const [accept, setAccept] = React.useState(initialRef.current.accept);

    if (accept) return <span>{children}</span>;

    const has_wallet_name = !!newWallet;
    const has_wallet_name_conflict = has_wallet_name
        ? wallet.wallet_names.has(newWallet)
        : false;
    const name_ready = !has_wallet_name_conflict && has_wallet_name;

    const onAccept = (e?: any) => {
        if (e) e.preventDefault();
        setAccept(true);
        (WalletManagerStore as any).setNewWallet(newWallet);
    };

    const formChange = (event: any) => {
        const key_id = event.target.id;
        let value = event.target.value;
        if (key_id === "new_wallet") {
            //case in-sensitive
            value = value.toLowerCase();
            // Allow only valid file name characters
            if (/[^a-z0-9_-]/.test(value)) return;
        }
        if (key_id === "new_wallet") setNewWallet(value);
    };

    return (
        <form onSubmit={onAccept}>
            <h5>
                <Translate content="wallet.new_wallet_name" />
            </h5>
            <Input
                type="text"
                id="new_wallet"
                onChange={formChange}
                value={newWallet || ""}
            />
            <p>
                {has_wallet_name_conflict ? (
                    <Translate content="wallet.wallet_exist" />
                ) : null}
            </p>
            <Button onClick={onAccept} type="primary" disabled={!name_ready}>
                <Translate content="wallet.accept" />
            </Button>
        </form>
    );
}

export function Download({
    confirmation,
    checkboxActive,
    downloadCb
}: {
    confirmation?: boolean;
    checkboxActive?: boolean;
    downloadCb?: () => void;
}) {
    const {wallet, backup: backupState} = useWalletBackup();

    const getBackupName = () => backupName(wallet.current_wallet);

    const createBackup = () => {
        const backupPubkey = (WalletDb as any).getWallet().password_pubkey;
        backup(backupPubkey).then((contents: any) => {
            const name = getBackupName();
            (BackupActions as any).incommingBuffer({name, contents});
        });
    };

    React.useEffect(() => {
        let isFileSaverSupported = false;
        try {
            isFileSaverSupported = !!new Blob();
        } catch (e) {}

        if (!isFileSaverSupported) {
            Notification.error({
                message: counterpart.translate(
                    "notifications.backup_file_save_unsupported"
                )
            });
        }

        if (confirmation) {
            createBackup();
        }
        // eslint-disable-next-line
    }, []);

    const onDownload = () => {
        const blob = new Blob([backupState.contents], {
            type: "application/octet-stream; charset=us-ascii"
        });

        if (blob.size !== backupState.size) {
            throw new Error("Invalid backup to download conversion");
        }
        saveAs(blob, backupState.name);
        (WalletActions as any).setBackupDate();

        if (downloadCb) {
            downloadCb();
        }
    };

    let isReady = true;
    if (confirmation) {
        isReady = !!checkboxActive;
    }
    return (
        <Button
            type={"primary"}
            disabled={!isReady}
            onClick={() => {
                onDownload();
            }}
            style={confirmation ? {height: "initial", padding: 0} : {}}
        >
            {confirmation ? (
                <div className="download-block" style={{padding: "1.25rem"}}>
                    <img
                        className="bin-img"
                        src="/bin-file/default.svg"
                        alt="bin"
                    />
                    <span className="text-left">
                        <Translate
                            className="download-text"
                            content="registration.downloadFile"
                        />
                        <p className="file-name" style={{marginBottom: 0}}>
                            {backupState.name}
                        </p>
                    </span>
                </div>
            ) : (
                <Translate content="wallet.download" />
            )}
        </Button>
    );
}

export function Create({
    noText,
    newAccount,
    children
}: {
    noText?: boolean;
    newAccount?: any;
    children?: any;
}) {
    const {wallet, backup: backupState} = useWalletBackup();

    const getBackupName = () => backupName(wallet.current_wallet);

    const onCreateBackup = () => {
        const backup_pubkey = (WalletDb as any).getWallet().password_pubkey;
        backup(backup_pubkey).then((contents: any) => {
            const name = getBackupName();
            (BackupActions as any).incommingBuffer({name, contents});
        });
    };

    const has_backup = !!backupState.contents;
    if (has_backup) return <div>{children}</div>;

    const ready = (WalletDb as any).getWallet() != null;

    return (
        <div>
            {noText ? null : (
                <div style={{textAlign: "left"}}>
                    {newAccount ? (
                        <Translate
                            component="p"
                            content="wallet.backup_new_account"
                            wallet_name={getWalletName()}
                        />
                    ) : null}
                    <Translate component="p" content="wallet.backup_explain" />
                </div>
            )}
            <Button
                type="primary"
                onClick={onCreateBackup}
                style={{marginBottom: 10}}
                disabled={!ready}
            >
                <Translate
                    content="wallet.create_backup_of"
                    name={wallet.current_wallet}
                />
            </Button>
            <LastBackupDate />
        </div>
    );
}

export function LastBackupDate() {
    if (!(WalletDb as any).getWallet()) {
        return null;
    }
    const backup_date = (WalletDb as any).getWallet().backup_date;
    const last_modified = (WalletDb as any).getWallet().last_modified;
    const backup_time = backup_date ? (
        <h4>
            <Translate content="wallet.last_backup" />{" "}
            <FormattedDate value={backup_date} />
        </h4>
    ) : (
        <Translate
            style={{paddingTop: 20}}
            className="facolor-error"
            component="p"
            content="wallet.never_backed_up"
        />
    );
    let needs_backup = null;
    if (backup_date) {
        needs_backup =
            last_modified.getTime() > backup_date.getTime() ? (
                <h4 className="facolor-error">
                    <Translate content="wallet.need_backup" />
                </h4>
            ) : (
                <h4 className="success">
                    <Translate content="wallet.noneed_backup" />
                </h4>
            );
    }
    return (
        <span>
            {backup_time}
            {needs_backup}
        </span>
    );
}

export function Upload({children}: {children?: any}) {
    const {backup: backupState} = useWalletBackup();

    const reset = () => {
        (BackupActions as any).reset();
    };

    const resetButton = (
        <div style={{paddingTop: 20}}>
            <Button disabled={!backupState.contents} onClick={reset}>
                <Translate content="wallet.reset" />
            </Button>
        </div>
    );

    if (backupState.contents && backupState.public_key)
        return (
            <span>
                {children}
                {resetButton}
            </span>
        );

    const is_invalid = backupState.contents && !backupState.public_key;

    const onFileUpload = (evt: any) => {
        const file = evt.target.files[0];
        (BackupActions as any).incommingWebFile(file);
        // Original also called `this.forceUpdate()` here. Dropped as
        // confirmed inert: `incommingWebFile` reads the file
        // asynchronously (FileReader.onload), so a forced re-render at
        // this point can't yet reflect the new BackupStore state anyway -
        // the real re-render already happens via useAltStore's store
        // subscription once the async read actually dispatches.
    };

    return (
        <div>
            <input
                accept=".bin"
                type="file"
                id="backup_input_file"
                style={{border: "solid"}}
                onChange={onFileUpload}
            />
            {is_invalid ? (
                <h5>
                    <Translate content="wallet.invalid_format" />
                </h5>
            ) : null}
            {resetButton}
        </div>
    );
}

export function NameSizeModified() {
    const {backup: backupState} = useWalletBackup();
    return (
        <span>
            <h5>
                <b>{backupState.name}</b> ({backupState.size} bytes)
            </h5>
            {backupState.last_modified ? (
                <div>{backupState.last_modified}</div>
            ) : null}
            <br />
        </span>
    );
}

export function DecryptBackup({
    saveWalletObject,
    children
}: {
    saveWalletObject?: boolean;
    children?: any;
}) {
    const {backup: backupState} = useWalletBackup();

    const [backup_password, setBackupPassword] = React.useState("");
    const [verified, setVerified] = React.useState(false);

    const onPassword = (e?: any) => {
        if (e) e.preventDefault();
        const private_key = (PrivateKey as any).fromSeed(backup_password || "");
        const contents = backupState.contents;
        decryptWalletBackup(private_key.toWif(), contents)
            .then((wallet_object: any) => {
                setVerified(true);
                if (saveWalletObject)
                    (BackupStore as any).setWalletObjct(wallet_object);
            })
            .catch((error: any) => {
                console.error(
                    "Error verifying wallet " + backupState.name,
                    error,
                    error.stack
                );
                if (error === "invalid_decryption_key") {
                    Notification.error({
                        message: counterpart.translate(
                            "notifications.invalid_password"
                        )
                    });
                } else {
                    Notification.error({
                        message: error
                    });
                }
            });
    };

    const formChange = (event: any) => {
        if (event.target.id === "backup_password")
            setBackupPassword(event.target.value);
    };

    if (verified) return <span>{children}</span>;
    return (
        <form onSubmit={onPassword}>
            <label>
                <Translate content="wallet.enter_password" />
            </label>
            <Input
                type="password"
                id="backup_password"
                onChange={formChange}
                value={backup_password}
            />
            <Sha1 />
            <Button type="primary" htmlType="submit" onClick={onPassword}>
                <Translate content="wallet.submit" />
            </Button>
        </form>
    );
}

export function Sha1() {
    const {backup: backupState} = useWalletBackup();
    return (
        <div className="padding no-overflow">
            <pre className="no-overflow" style={{lineHeight: "1.2"}}>
                {backupState.sha1} * SHA1
            </pre>
            <br />
        </div>
    );
}
