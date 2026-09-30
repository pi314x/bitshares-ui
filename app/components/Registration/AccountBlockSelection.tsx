// TypeScript port of the legacy AccountBlockSelection.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Already a plain functional component -
// mechanical PropTypes->TS conversion only, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import {Button} from "bitshares-ui-style-guide";
import counterpart from "counterpart";

interface AccountBlockSelectionProps {
    active: boolean;
    onSelect: () => void;
    onChangeActive: () => void;
}

export default function AccountBlockSelection(
    props: AccountBlockSelectionProps
) {
    return (
        <div
            className="account-block-registration"
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
                content="registration.securityAccountModel"
                component="p"
                className={`model-option-value account-security option-border ${
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
                content="registration.accountLoginByValue"
                component="p"
                className={`model-option-value account-option-value option-border ${
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
                content="settings.no"
                component="p"
                className={`model-option-value account-option-value ${
                    !props.active ? "inactive-text" : ""
                }`}
            />

            {props.active ? (
                <Button onClick={props.onSelect} type="primary">
                    {counterpart.translate("registration.continue")}
                </Button>
            ) : (
                <Button>{counterpart.translate("registration.select")}</Button>
            )}
        </div>
    );
}
