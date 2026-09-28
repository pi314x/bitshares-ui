// TypeScript/functional-component port of the legacy
// WalletUnlockModalLib.jsx (Phase 5, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// `CustomPasswordInput`, `LoginButtons`, `CustomError`, and
// `RestoreBackupOnly` are exported here but - grepped across the whole
// codebase - imported nowhere, including by `WalletUnlockModal.tsx`
// itself. Kept anyway (not dropped) since they're plain, side-effect-free
// presentational exports from a shared "lib" file, unlike the
// confirmed-dead *internal* state/refs dropped elsewhere in this
// migration. `CustomPasswordInput`'s legacy string ref
// (`ref="password_input"`) is dropped since nothing reads
// `this.refs.password_input` anywhere (the class itself has no other
// consumers) and string refs aren't supported by function components
// anyway.
import * as React from "react";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import {getWalletName} from "branding";
import {Alert, Checkbox, Tooltip} from "bitshares-ui-style-guide";

/* Dummy input to trick Chrome into disabling auto-complete */
export const DisableChromeAutocomplete = () => (
    <input
        type="text"
        className="no-padding no-margin"
        style={{visibility: "hidden", height: 0}}
    />
);

const stopPropagation = (e: any) => e.stopPropagation();

export const KeyFileLabel = ({
    showUseOtherWalletLink,
    onUseOtherWallet
}: {
    showUseOtherWalletLink?: boolean;
    onUseOtherWallet: (e: any) => void;
}) => (
    <div className="label-container">
        <label className="left-label login-label">
            <Translate content="wallet.key_file_bin" />{" "}
        </label>{" "}
        {showUseOtherWalletLink && (
            <a onClick={onUseOtherWallet}>
                (<Translate content="wallet.use_different" />)
            </a>
        )}
    </div>
);

export function StyledUpload({onFileChosen}: {onFileChosen: (e: any) => void}) {
    return (
        <label className="upload-button themed-input">
            <Translate content="wallet.restore_key_file" />
            <UploadButtonLogo />
            <input
                type="file"
                onClick={stopPropagation}
                onChange={onFileChosen}
                accept=".bin"
            />
        </label>
    );
}

export const CustomError = ({message}: {message?: any}) => (
    <div className="has-error">{message || ""}</div>
);

export const BackupFileSelector = ({
    onFileChosen,
    onRestoreOther
}: {
    onFileChosen: (e: any) => void;
    onRestoreOther: (e: any) => void;
}) => (
    <div>
        <StyledUpload onFileChosen={onFileChosen} />
        <div className="login-hint">
            <Translate content="wallet.different_file_type" />{" "}
            <a onClick={onRestoreOther}>
                <Translate content="wallet.restore_it_here" />
            </a>
        </div>
    </div>
);

export const RestoreBackupOnly = ({
    onFileChosen,
    onRestoreOther
}: {
    onFileChosen: (e: any) => void;
    onRestoreOther: (e: any) => void;
}) => (
    <BackupFileSelector
        onFileChosen={onFileChosen}
        onRestoreOther={onRestoreOther}
    />
);

export const BackupWarning = ({
    onChange,
    checked
}: {
    onChange: (e: any) => void;
    checked: boolean;
}) => (
    <div className="backup-warning">
        <Alert
            type="warning"
            message={counterpart.translate("alert.warning")}
            description={counterpart.translate("wallet.backup_warning")}
        />
        <div className="checkbox">
            <Checkbox
                key={`checkbox_${checked}`} // This is needed to prevent slow checkbox reaction
                onChange={onChange}
                checked={checked}
            >
                <Translate content="wallet.dont_ask_for_backup" />
            </Checkbox>
        </div>
    </div>
);

export const LoginButtons = ({
    onLogin,
    backupLogin
}: {
    onLogin: (e: any) => void;
    backupLogin?: boolean;
}) => (
    <Tooltip
        placement="bottom"
        title={counterpart.translate("tooltip.login", {
            wallet_name: getWalletName()
        })}
    >
        <button className="button" onClick={onLogin}>
            <Translate
                content={
                    backupLogin ? "wallet.backup_login" : "header.unlock_short"
                }
            />
        </button>
    </Tooltip>
);

export function CustomPasswordInput() {
    return (
        <div className="content-block account-selector input-area">
            <label className="left-label login-label">
                <Translate content="settings.password" />
            </label>
            <input
                name="password"
                id="password"
                type="password"
                autoComplete="current-password"
            />
        </div>
    );
}

const UploadButtonLogo = () => (
    <svg
        viewBox="0 0 6.349999 7.5313201"
        version="1.1"
        className="upload-button-logo"
    >
        <g transform="translate(-86.783338,-137.44666)">
            <path d="m 89.958337,144.97798 h -3.174999 v -1.18208 -1.18208 l 0.387288,-1.11098 0.387288,-1.11097 h 0.847434 0.847434 v 0.31163 0.31163 l -0.65212,0.17054 -0.652119,0.17053 -0.196798,0.75256 -0.196798,0.75255 h 2.40339 2.403391 l -0.196798,-0.75255 -0.196798,-0.75256 -0.652119,-0.17053 -0.65212,-0.17054 v -0.31163 -0.31163 h 0.847434 0.847434 l 0.387288,1.11097 0.387288,1.11098 v 1.18208 1.18208 z m 0,-3.175 H 89.60556 v -1.2017 -1.20169 l -0.705556,0.1845 -0.705555,0.18451 v -0.33243 -0.33243 l 0.881944,-0.82854 0.881944,-0.82854 0.881945,0.82854 0.881944,0.82854 v 0.33243 0.33243 l -0.705555,-0.18451 -0.705556,-0.1845 v 1.20169 1.2017 z" />
        </g>
    </svg>
);

export const WalletDisplay = ({
    name,
    onUseOtherWallet
}: {
    name: any;
    onUseOtherWallet: (e: any) => void;
}) => (
    <div className="content-box">
        <b>
            <Translate content="wallet.using" />
        </b>{" "}
        {name}{" "}
        <a onClick={onUseOtherWallet}>
            (<Translate content="wallet.use_different" />)
        </a>
    </div>
);

export const CreateLocalWalletLink = ({
    onCreate
}: {
    onCreate: (e: any) => void;
}) => (
    <div className="login-hint">
        <Translate content="wallet.no_wallet" component="span" />{" "}
        <span className="button" onClick={onCreate}>
            <Translate content="wallet.create_wallet" />
        </span>
    </div>
);

export const WalletSelector = ({
    restoringBackup,
    walletNames,
    onWalletChange
}: {
    restoringBackup?: boolean;
    walletNames: any;
    onWalletChange: (e: any) => void;
}) => (
    <select
        value={restoringBackup ? "upload." : ""}
        onChange={onWalletChange}
        className="login-select"
    >
        <option value="" hidden>
            {counterpart.translate("wallet.select_wallet")}
        </option>
        {walletNames.map((walletName: string) => (
            <option
                className="login-option"
                key={walletName}
                value={`wallet.${walletName}`}
            >
                {walletName}
            </option>
        ))}
        <option value="upload.">
            {counterpart.translate("settings.backup_backup_short")}
        </option>
    </select>
);
