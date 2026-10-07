// TypeScript port of the legacy AccountHeaderSelection.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Already a plain functional component -
// mechanical PropTypes->TS conversion only, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import Icon from "../Icon/Icon";
import {Tooltip} from "../../design-system/Tooltip";

interface AccountHeaderSelectionProps {
    active: boolean;
    forSmall?: boolean;
    onChangeActive?: (() => void) | null;
}

export default function AccountHeaderSelection({
    active,
    forSmall = false,
    onChangeActive = null
}: AccountHeaderSelectionProps) {
    return (
        <div
            onClick={onChangeActive as any}
            className={`${
                forSmall ? "hide-block-for-medium inactive-right-block" : ""
            } small-horizontal small-only-block header-block`}
        >
            {!forSmall ? (
                <div>
                    {active ? (
                        <img
                            className="model-img"
                            src="model-type-images/account-active.svg"
                            alt="wallet"
                        />
                    ) : (
                        <img
                            className="model-img inactive-img"
                            src="model-type-images/account-inactive.svg"
                            alt="wallet"
                        />
                    )}
                </div>
            ) : null}
            <div className="small-only-text-left">
                <Translate
                    unsafe
                    content="registration.accountModelTitle"
                    component="p"
                    className={`selection-title ${
                        !active ? "inactive-title inactive-text" : ""
                    }`}
                />
                <Translate
                    content="wallet.password_model"
                    component="p"
                    className={`choice-model choice-account ${
                        !active ? "inactive-text" : ""
                    }`}
                />
                {!forSmall ? (
                    <Tooltip
                        title={
                            active
                                ? counterpart.translate(
                                      "tooltip.registration.accountModel"
                                  )
                                : ""
                        }
                    >
                        <span>
                            <Icon
                                name="question-in-circle"
                                className="icon-14px question-icon"
                            />
                        </span>
                    </Tooltip>
                ) : null}
            </div>
        </div>
    );
}
