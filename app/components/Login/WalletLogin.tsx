// TypeScript/functional-component port of the legacy WalletLogin.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md), part of the `Login/` directory
// (4 files, directory complete). Mechanical class-to-hooks translation,
// no logic changes.
//
// Not itself security-sensitive per AGENTS.md (grepped for `WalletDb`/
// `WalletApi`/`.add_type_operation`/`process_transaction` - none appear
// in this file): it only drives the ".bin" backup-file upload UI and
// renders `DecryptBackup` (ported in this same commit - see that file's
// header comment for the actual backup-password handling and its own
// security notes).
//
// `connect(WalletLogin, {listenTo: [BackupStore], getProps})` becomes
// `useAltStore(BackupStore)` in an outer `WalletLogin` wrapper, passed
// down to a `WalletLoginCore` function - this migration's established
// Container+Core split.
//
// `history` is read (and forwarded to `<DecryptBackup history={...}>`)
// but was never declared in the original's `propTypes` - added as a
// real, required `history: any` field on the new props interface
// (matching the sibling `Registration/WalletRegistration.tsx`/
// `AccountRegistration.tsx` convention for the same situation), since
// it's always supplied in practice: this component is only ever
// rendered by `Login.jsx` (ported in this same commit), which always
// passes its own route-injected `history` prop straight through.
//
// `componentDidMount` (`BackupActions.reset()`) becomes a mount-only
// `useEffect(() => {...}, [])`.
//
// `onFileUpload`'s trailing `this.forceUpdate()` is preserved via a
// dummy `forceRenderTick` counter bumped in its place. This is close to
// a no-op either way, in the original as much as here: the
// `BackupActions.incommingWebFile(file)` dispatch it follows only kicks
// off an async `FileReader` whose `onload` resolves (and updates
// `BackupStore`) later - the existing `useAltStore(BackupStore)`
// subscription already re-renders this component once that actually
// happens, so forcing an extra, immediate re-render here, before that
// async update lands, can't itself change what's rendered. Kept anyway,
// per AGENTS.md's "prefer minimal diffs, don't restructure this logic"
// directive for this whole directory, rather than silently dropped.
//
// The legacy string ref (`ref="file_input"`, duplicated verbatim on
// *two* separate `<input>` elements, both also sharing the id
// "backupFile" - a pre-existing duplicate-id/duplicate-ref bug, not
// introduced here and not "fixed" here either) is dropped: grepped this
// file and the whole app for `refs.file_input` / any ref into
// `WalletLogin` or its inputs - never read anywhere, confirmed dead.
//
// Grepped app-wide for `Login/WalletLogin` and for any external ref
// into this component: only `Login.jsx`/`.tsx` (ported in this same
// commit) renders it, with no ref - no `forwardRef`/
// `useImperativeHandle` needed.
//
// TS-forced adjustments (behaviorally inert, both cast through `any`
// purely to satisfy the compiler):
// - `react-router-dom`'s `Link` triggers a `@types/react-router-dom` vs.
//   `@types/react` version-mismatch error (TS2786) already worked around
//   the same way elsewhere in this migration (`LoginSelector.tsx`'s
//   `LinkAny`) - used as `LinkAny` here too.
// - `new FileReader().readAsBinaryString || !active` (a feature-detect:
//   referencing the method, not calling it) now trips TS2774 ("this
//   condition will always return true since this function is always
//   defined") under this project's modern TypeScript - cast through
//   `any` to keep the exact original feature-detection logic rather
//   than rewriting it.
import * as React from "react";
import {Link} from "react-router-dom";
import Translate from "react-translate-component";
import ReactTooltip from "react-tooltip";
import BackupStore from "stores/BackupStore";
import BackupActions from "actions/BackupActions";
import DecryptBackup from "./DecryptBackup";
import Icon from "../Icon/Icon";
import {useAltStore} from "../../next/hooks/useAltStore";

// `Link` triggers a `@types/react-router-dom` vs. `@types/react` version
// mismatch error (TS2786) already worked around the same way elsewhere
// in this migration (e.g. `LoginSelector.tsx`'s `LinkAny`).
const LinkAny = Link as any;

interface WalletLoginCoreProps {
    active?: boolean;
    backup?: any;
    onChangeActive: () => void;
    goToAccountModel: () => void;
    history: any;
}

function WalletLoginCore({
    active = false,
    backup = {},
    onChangeActive,
    goToAccountModel,
    history
}: WalletLoginCoreProps) {
    const [isDrop, setIsDrop] = React.useState(false);
    // See header comment: replicates the original's `this.forceUpdate()`.
    const [, setForceRenderTick] = React.useState(0);

    React.useEffect(() => {
        (BackupActions as any).reset();
    }, []);

    const onFileUpload = (evt: any, droppedFile?: any) => {
        const file = droppedFile || evt.target.files[0];
        (BackupActions as any).incommingWebFile(file);
        setForceRenderTick(tick => tick + 1);
    };

    const onDropBinFile = (e: any) => {
        e.preventDefault();
        onFileUpload(e, e.dataTransfer.files[0]);
    };

    const onPlaceFile = (isOpen: boolean) => {
        setIsDrop(isOpen);
    };

    const renderTooltip = () => {
        return (
            <ReactTooltip
                id="without-bin"
                className="custom-tooltip text-left"
                globalEventOff="click"
            >
                <div
                    className="tooltip-text"
                    onClick={e => e.stopPropagation()}
                >
                    <Translate content="tooltip.login-tooltip.withoutBinFileBlock.begin" />
                    <LinkAny to="/create-wallet-brainkey">
                        <Translate
                            component="u"
                            className="active-upload-text cursor-pointer"
                            content="tooltip.login-tooltip.withoutBinFileBlock.brainkey"
                        />
                    </LinkAny>
                    <Translate content="tooltip.login-tooltip.withoutBinFileBlock.middle" />
                    <Translate
                        onClick={goToAccountModel}
                        className="without-bin cursor-pointer"
                        content="tooltip.login-tooltip.withoutBinFileBlock.model"
                    />
                    <Translate content="tooltip.login-tooltip.withoutBinFileBlock.end" />
                    <span
                        onClick={() => ReactTooltip.hide()}
                        className="close-button"
                    >
                        ×
                    </span>
                </div>
            </ReactTooltip>
        );
    };

    const renderUploadInputForSmall = () => {
        const isDownloaded = backup.contents && backup.public_key;

        return (
            <div>
                <span className="text-left left-label show-for-small-only">
                    <Translate
                        content={
                            backup.contents
                                ? "login.selectDifferent"
                                : "login.browseFileLabel"
                        }
                    />
                </span>
                <div
                    onDragOver={e => e.preventDefault()}
                    onDragEnter={e => e.preventDefault()}
                    onDrop={e => onDropBinFile(e)}
                    className="small-container"
                >
                    {isDownloaded ? (
                        <span className="bin-name">{backup.name}</span>
                    ) : (
                        <span>&nbsp;</span>
                    )}
                    <span className="upload-text">
                        <u className="active-upload-text">
                            <input
                                accept=".bin"
                                type="file"
                                id="backupFile"
                                className="upload-bin-input"
                                onChange={e => onFileUpload(e)}
                            />
                            <Icon name="paperclip" className="attach-bin" />
                        </u>
                    </span>
                </div>
            </div>
        );
    };

    const renderUploadInput = () => {
        const isInvalid = backup.contents && !backup.public_key;
        const isDownloaded = backup.contents && backup.public_key;

        return (
            <label
                onDragOver={() => {
                    onPlaceFile(true);
                }}
                onDragLeave={() => {
                    onPlaceFile(false);
                }}
                className="cursor-pointer"
                htmlFor="backupFile"
            >
                <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => onDropBinFile(e)}
                    className={`file-input-container ${
                        isInvalid ? "invalid" : ""
                    } ${isDrop ? "dropHover" : ""} ${
                        isDownloaded ? "downloaded" : ""
                    }`}
                >
                    <img
                        className="rounded-arrow"
                        src="bin-file/rounded-arrow.svg"
                        alt="arrow"
                    />
                    {isDownloaded ? (
                        <img
                            className="bin-file"
                            src="bin-file/downloaded.svg"
                            alt="bin-file"
                        />
                    ) : isInvalid ? (
                        <img
                            className="bin-file"
                            src="bin-file/error.svg"
                            alt="bin-file"
                        />
                    ) : (
                        <span>
                            <img
                                className="bin-file initial-bin"
                                src="bin-file/hover.svg"
                                alt="bin-file"
                            />
                        </span>
                    )}
                    <span className="upload-text text-left no-overflow">
                        {isDownloaded ? (
                            <p className="bin-name">
                                {backup.name} ({backup.size} bytes)
                            </p>
                        ) : isInvalid ? (
                            <Translate
                                className="facolor-error"
                                content="login.invalidFormat"
                            />
                        ) : (
                            <Translate content="login.dropFile" />
                        )}
                        <u className="active-upload-text">
                            <input
                                accept=".bin"
                                type="file"
                                id="backupFile"
                                className="upload-bin-input"
                                onChange={e => onFileUpload(e)}
                            />
                            <Translate
                                content={
                                    backup.contents
                                        ? "login.selectDifferent"
                                        : "login.browseFile"
                                }
                            />
                        </u>
                    </span>
                </div>
            </label>
        );
    };

    return (
        <div onClick={onChangeActive} className="wallet-block">
            <div className="overflow-bg-block show-for-small-only">
                <span className="content" />
            </div>
            {(new FileReader() as any).readAsBinaryString || !active ? null : (
                <Translate
                    component="p"
                    className="error"
                    content="login.supportWarning"
                />
            )}
            <div className={!active ? "display-none" : ""}>
                {renderUploadInput()}
                {renderUploadInputForSmall()}
                <Translate
                    component="p"
                    className="text-left without-bin cursor-pointer hide-for-small-only"
                    content="login.withoutBinFile"
                    data-for="without-bin"
                    data-tip
                    data-event="click"
                    data-place="right"
                    data-effect="solid"
                />
                <Translate
                    component="p"
                    className="text-left without-bin cursor-pointer show-for-small-only"
                    content="login.withoutBinFile"
                    data-for="without-bin"
                    data-tip
                    data-event="click"
                    data-place="bottom"
                    data-effect="solid"
                />
                {renderTooltip()}
            </div>
            <DecryptBackup active={active} history={history} />
        </div>
    );
}

interface WalletLoginProps {
    active?: boolean;
    onChangeActive: () => void;
    goToAccountModel: () => void;
    history: any;
}

function WalletLogin(props: WalletLoginProps) {
    const backup = useAltStore<any>(BackupStore);

    return <WalletLoginCore {...props} backup={backup} />;
}

export default WalletLogin;
