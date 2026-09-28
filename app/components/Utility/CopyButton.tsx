// TypeScript/functional-component port of the legacy CopyButton.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes -
// already a function component, so this just adds types.
import * as React from "react";
import counterpart from "counterpart";
import ClipboardButton from "react-clipboard.js";
import Icon from "../Icon/Icon";
import {Tooltip} from "bitshares-ui-style-guide";

interface CopyButtonProps {
    className?: string;
    text?: string;
    tip?: string;
    dataPlace?: string;
    buttonIcon?: string;
    buttonText?: string;
    useDiv?: boolean;
}

const CopyButton = ({
    className = "button",
    text = "",
    tip = "tooltip.copy_tip",
    dataPlace = "right",
    buttonIcon = "clippy",
    buttonText = "",
    useDiv = true
}: CopyButtonProps) => {
    const button = (
        <ClipboardButton data-clipboard-text={text} className={className}>
            {!buttonText ? (
                <Icon name={buttonIcon} title={"icons.clippy.copy"} />
            ) : (
                buttonText
            )}
        </ClipboardButton>
    );
    return (
        <Tooltip
            placement={dataPlace as any}
            title={counterpart.translate(tip)}
        >
            {useDiv ? <div>{button}</div> : <span>{button}</span>}
        </Tooltip>
    );
};

export default CopyButton;
