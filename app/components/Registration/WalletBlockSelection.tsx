// TypeScript port of the legacy WalletBlockSelection.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Already a plain functional component -
// mechanical PropTypes->TS conversion only, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import {Button} from "../../design-system/Button";
import counterpart from "counterpart";

interface WalletBlockSelectionProps {
    active: boolean;
    onSelect: () => void;
    onChangeActive: () => void;
}

export default function WalletBlockSelection(props: WalletBlockSelectionProps) {
    return (
        <div
            className="wallet-block-registration"
            onClick={props.onChangeActive}
        >
            <div className="overflow-bg-block show-for-small-only">
                <span className="content" />
            </div>
            <Translate
                content="registration.securityKey"
                component="p"
                className={`model-option security-key ${
                    !props.active ? "inactive-text" : ""
                }`}
            />
            <Translate
                content="registration.securityWalletModel"
                component="p"
                className={`model-option-value option-border ${
                    !props.active ? "inactive-text" : ""
                }`}
            />
            <Translate
                content="registration.loginByKey"
                component="p"
                className={`model-option ${
                    !props.active ? "inactive-text" : ""
                }`}
            />
            <Translate
                content="registration.walletLoginByValue"
                component="p"
                className={`model-option-value option-border ${
                    !props.active ? "inactive-text" : ""
                }`}
            />
            <Translate
                content="registration.backUpRestoreKey"
                component="p"
                className={`model-option ${
                    !props.active ? "inactive-text" : ""
                }`}
            />
            <Translate
                content="settings.yes"
                component="p"
                className={`model-option-value ${
                    !props.active ? "inactive-text" : ""
                }`}
            />

            {props.active ? (
                <Button onClick={props.onSelect} variant="accent">
                    {counterpart.translate("registration.continue")}
                </Button>
            ) : (
                <Button>{counterpart.translate("registration.select")}</Button>
            )}
        </div>
    );
}
