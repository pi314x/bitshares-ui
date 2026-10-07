// TypeScript/functional-component port of the legacy
// WalletRegistrationConfirm.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `ApplicationApi`, `.add_type_operation`, `process_transaction`
// - none appear. This screen only shows three "did you back up your
// wallet" confirmation checkboxes and delegates the actual backup-file
// download to the already-ported `Wallet/Backup.tsx`'s `Download`
// component.
import * as React from "react";
import Translate from "react-translate-component";
import ReactTooltip from "react-tooltip";
import Icon from "../Icon/Icon";
import {Download} from "../Wallet/Backup";

interface WalletRegistrationConfirmProps {
    toggleConfirmed: (checkbox: string) => void;
    checkboxUploaded: boolean;
    checkboxRecover: boolean;
    checkboxRemember: boolean;
    history: any;
}

function renderWarning() {
    return (
        <div className="attention-note">
            <Icon name="attention" size="1x" />
            <Translate
                content="registration.attention"
                className="attention-text"
            />
            <Translate component="p" content="registration.walletNote" />
        </div>
    );
}

export default function WalletRegistrationConfirm({
    toggleConfirmed,
    checkboxUploaded,
    checkboxRecover,
    checkboxRemember,
    history
}: WalletRegistrationConfirmProps) {
    const onBackupDownload = () => {
        history.push("/");
    };

    const renderTooltip = () => (
        <ReactTooltip
            id="wallet-confirm"
            className="custom-tooltip text-left"
            globalEventOff="click"
        >
            <div className="tooltip-text" onClick={e => e.stopPropagation()}>
                <Translate content="tooltip.registration.whyBinFile" />
                <span
                    onClick={() => (ReactTooltip as any).hide()}
                    className="close-button cursor-pointer"
                >
                    ×
                </span>
            </div>
        </ReactTooltip>
    );

    return (
        <div className="text-left">
            <div className="confirm-checks">
                <Translate
                    component="h3"
                    content="registration.createAccountTitle"
                />
                {renderWarning()}
            </div>
            <div
                className="checkbox-block"
                onClick={() => toggleConfirmed("checkboxRemember")}
            >
                <span>
                    <Icon
                        className={`${
                            checkboxRemember ? "checkbox-active" : ""
                        } checkbox`}
                        name="checkmark"
                    />
                </span>
                <Translate
                    className="checkbox-text"
                    content="registration.checkboxRemember"
                />
            </div>
            <div
                className="checkbox-block"
                onClick={() => toggleConfirmed("checkboxUploaded")}
            >
                <span>
                    <Icon
                        className={`${
                            checkboxUploaded ? "checkbox-active" : ""
                        } checkbox`}
                        name="checkmark"
                    />
                </span>
                <Translate
                    className="checkbox-text"
                    content="registration.checkboxUploaded"
                />
            </div>
            <div
                className="checkbox-block"
                onClick={() => toggleConfirmed("checkboxRecover")}
            >
                <span>
                    <Icon
                        className={`${
                            checkboxRecover ? "checkbox-active" : ""
                        } checkbox`}
                        name="checkmark"
                    />
                </span>
                <Translate
                    className="checkbox-text"
                    content="registration.checkboxRecover"
                />
            </div>
            <Download
                confirmation
                checkboxActive={
                    checkboxUploaded && checkboxRemember && checkboxRecover
                }
                downloadCb={onBackupDownload}
            />
            <Translate
                component="p"
                className="cursor-pointer why-bin-file checkbox-text"
                content="registration.whyBinFile"
                data-for="wallet-confirm"
                data-tip
                data-event="click"
                data-place="bottom"
                data-effect="solid"
            />
            {renderTooltip()}
        </div>
    );
}
