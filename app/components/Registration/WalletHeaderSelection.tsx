// TypeScript port of the legacy WalletHeaderSelection.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Already a plain functional component -
// mechanical PropTypes->TS conversion only, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import Icon from "../Icon/Icon";
import {Tooltip} from "bitshares-ui-style-guide";

interface WalletHeaderSelectionProps {
    active: boolean;
    forSmall?: boolean;
    onChangeActive?: (() => void) | null;
}

export default function WalletHeaderSelection({
    active,
    forSmall = false,
    onChangeActive = null
}: WalletHeaderSelectionProps) {
    return (
        <div
            onClick={onChangeActive as any}
            className={`${
                forSmall ? "hide-block-for-medium inactive-left-block" : ""
            } small-horizontal small-only-block header-block`}
        >
            {!forSmall ? (
                <div>
                    {active ? (
                        <img
                            className="model-img"
                            src="model-type-images/flesh-active.svg"
                            alt="wallet"
                        />
                    ) : (
                        <img
                            className="model-img inactive-img"
                            src="model-type-images/flesh-inactive.svg"
                            alt="wallet"
                        />
                    )}
                </div>
            ) : null}
            <div className="small-only-text-left">
                <Translate
                    content="registration.walletModelTitle"
                    component="p"
                    className={`selection-title ${
                        !active ? "inactive-title inactive-text" : ""
                    }`}
                />
                <Translate
                    content="wallet.wallet_model"
                    className={`choice-model ${
                        !active ? "inactive-text" : ""
                    }`}
                />
                {!forSmall ? (
                    <Tooltip
                        title={
                            active
                                ? counterpart.translate(
                                      "tooltip.registration.walletModel"
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
                <Translate
                    content="registration.recommended"
                    component="p"
                    className={`recommended ${
                        !active && !forSmall ? "inactive-text" : ""
                    }`}
                />
            </div>
        </div>
    );
}
