// TypeScript/functional-component port of the legacy LoadingButton.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `shouldComponentUpdate` is a pure shallow-equality performance guard
// with no other side effects (just `isLoading` prop / `loading` state
// comparison) - not replicated, per this migration's established
// treatment of pure perf guards (hooks re-render naturally on every
// dependency change).
//
// The original measures the button's rendered width via `findDOMNode
// (this.loadingButton).getBoundingClientRect().width` right before
// switching into the loading state (so the button doesn't visibly
// shrink once its content is replaced by a spinner) - replicated with a
// ref to the underlying `Button`'s DOM node instead of `findDOMNode`.
import * as React from "react";
import LoadingIndicator from "../LoadingIndicator";
import counterpart from "counterpart";
import {Button} from "../../design-system/Button";

interface LoadingButtonProps {
    id?: string;
    className?: string;
    type?: string;
    style?: React.CSSProperties;
    caption?: string;
    text?: string;
    onClick: (
        event: any,
        feedback: (done?: any, message?: any) => void
    ) => void;
    loadingType?: string;
    loadingMessage?: string | null;
    isLoading?: boolean | null;
}

function LoadingButton({
    id,
    className = "button",
    type = "button",
    style = {},
    caption: captionProp,
    text,
    onClick,
    loadingType = "inside-feedback",
    loadingMessage: loadingMessageProp = null,
    isLoading = null
}: LoadingButtonProps) {
    const [loading, setLoading] = React.useState(
        isLoading == null ? false : isLoading
    );
    const [overrideMessage, setOverrideMessage] = React.useState<string | null>(
        null
    );
    const [loadingButtonWidth, setLoadingButtonWidth] = React.useState<
        number | null
    >(null);

    const processingOnClickRef = React.useRef(false);
    const loadingButtonRef = React.useRef<HTMLElement | null>(null);

    const _feedback = (done: any = null, message: any = null) => {
        if (done == null) {
            setOverrideMessage(null);
            setLoading(false);
            processingOnClickRef.current = false;
        } else if (typeof done === "string") {
            setOverrideMessage(done);
        } else if (typeof done === "boolean") {
            if (!done) {
                setOverrideMessage(message);
            } else {
                setLoading(false);
                processingOnClickRef.current = false;
            }
        }
    };

    const _isLoading = () => {
        return processingOnClickRef.current
            ? loading
            : isLoading == null
            ? false
            : isLoading;
    };

    const _onClick = (event: any) => {
        processingOnClickRef.current = true;
        if (loading) {
            return true;
        }
        if (onClick != null) {
            // persist button width
            if (loadingButtonRef.current) {
                setLoadingButtonWidth(
                    loadingButtonRef.current.getBoundingClientRect().width
                );
            }
            setLoading(true);
            event.persist();
            onClick(event, _feedback);
            return true;
        }
    };

    let caption: any = captionProp || text || null;
    if (typeof caption === "string" && caption.indexOf(".") > 0) {
        caption = counterpart.translate(caption);
    }
    if (caption != null && caption.trim() == "") {
        caption = null;
    }

    let loadingMessage: any = loadingMessageProp || null;
    if (overrideMessage != null && overrideMessage.trim() != "") {
        loadingMessage = overrideMessage;
    }
    if (typeof loadingMessage === "string" && loadingMessage.indexOf(".") > 0) {
        loadingMessage = counterpart.translate(loadingMessage);
    }
    if (loadingMessage != null && loadingMessage.trim() == "") {
        loadingMessage = null;
    }
    let leftElement = null;
    let rightElement = null;
    let fixButtonWidth = false;
    let buttonInner: React.ReactNode = <span>{caption}</span>;

    const loadingState = _isLoading();

    switch (loadingType) {
        case "inside":
            if (loadingState) {
                fixButtonWidth = true;
                buttonInner = (
                    <span style={{margin: "auto", display: "inline-block"}}>
                        <LoadingIndicator type={"circle-small"} />
                    </span>
                );
            }
            break;
        case "inside-feedback":
            if (loadingState) {
                fixButtonWidth = true;
                buttonInner = (
                    <span style={{float: "left"}}>
                        <span
                            style={{
                                position: "absolute",
                                whiteSpace: "nowrap",
                                marginLeft: "12px"
                            }}
                        >
                            {loadingMessage}
                        </span>
                        <span>
                            <LoadingIndicator type={"circle-small"} />
                        </span>
                    </span>
                );
            }
            break;
        case "overlay":
            if (loadingState) {
                fixButtonWidth = true;
                rightElement = <LoadingIndicator type="loading-overlay" />;
            }
            break;
        case "overlay-feedback":
            if (loadingState) {
                fixButtonWidth = true;
                rightElement = (
                    <LoadingIndicator
                        loadingText={loadingMessage}
                        type="loading-overlay"
                    />
                );
            }
            break;
        case "inside-feedback-resize":
            if (loadingState) {
                buttonInner = (
                    <span>
                        <span>{loadingMessage}</span>
                        <span style={{float: "left"}}>
                            <LoadingIndicator type={"circle-small"} />
                        </span>
                    </span>
                );
            }
            break;
        case "right-feedback":
            if (loadingState) {
                rightElement = (
                    <div
                        style={{
                            float: "left",
                            marginLeft: "-9px",
                            position: "relative"
                        }}
                        className="disabled"
                    >
                        <span>
                            <span
                                style={{
                                    float: "left",
                                    marginTop: "7px"
                                }}
                            >
                                <LoadingIndicator type={"circle"} />
                            </span>
                            <span
                                style={{
                                    float: "left",
                                    marginLeft: "6px",
                                    marginTop: "11px"
                                }}
                            >
                                {loadingMessage}
                            </span>
                        </span>
                    </div>
                );
            }
            break;
        case "left-feedback":
            if (loadingState) {
                leftElement = (
                    <div
                        style={{
                            float: "left",
                            marginRight: "6px",
                            position: "relative"
                        }}
                        className="disabled"
                    >
                        <span>
                            <span
                                style={{
                                    float: "right",
                                    marginTop: "7px"
                                }}
                            >
                                <LoadingIndicator type={"circle"} />
                            </span>
                            <span
                                style={{
                                    float: "right",
                                    marginRight: "6px",
                                    marginTop: "11px"
                                }}
                            >
                                {loadingMessage}
                            </span>
                        </span>
                    </div>
                );
            }
            break;
    }

    const buttonStyle: React.CSSProperties = {
        overflow: "hidden",
        position: "relative"
    };
    if (fixButtonWidth && loadingButtonWidth != null) {
        buttonStyle.width = loadingButtonWidth;
    }
    return (
        <div style={style}>
            {leftElement != null && leftElement}
            <span style={{float: "left"}}>
                <Button
                    ref={loadingButtonRef as any}
                    disabled={loadingState}
                    type={type as any}
                    className={className}
                    id={id}
                    onClick={_onClick}
                    style={buttonStyle}
                >
                    {buttonInner}
                </Button>
            </span>
            {rightElement != null && rightElement}
            <div style={{clear: "both"}} />
        </div>
    );
}

export default LoadingButton;
