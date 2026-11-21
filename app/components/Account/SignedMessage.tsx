// TypeScript/functional-component port of the legacy SignedMessage.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `UNSAFE_componentWillMount` (always verifies the initial message,
// unconditionally) and `UNSAFE_componentWillReceiveProps` (re-verifies
// whenever the `message` prop changes, skipping only when the new value
// is defined, non-null, *and* already matches the currently-stored
// message) both run *before* the render that shows their result - a
// `useEffect` would run *after* that render instead, and this
// component's own JSX already has an "error" fallback branch
// (`messageGiven && messageParsed == null`) that would flash visibly for
// one frame in between. Replicated with a render-phase conditional
// `setState` (React's documented-safe "adjust state during render"
// pattern - the same class of update `getDerivedStateFromProps` uses),
// guarded by a `useRef` so it only actually fires when the original's
// exact guard condition would have. `noVerification` state (frozen at
// mount from the initial prop, never updated by `componentWillReceiveProps`
// either) is replicated with a `useRef` whose initial value is only ever
// read on the first render.
//
//  This component allows to display and verify a signed message
//
//  See SignedMessageAction for details on message format.
//
//    @author Stefan Schiessl <stefan.schiessl@blockchainprojectsbv.com>
import * as React from "react";
import counterpart from "counterpart";
import SignedMessageAction from "../../actions/SignedMessageAction";

interface SignedMessageProps {
    message?: string;
    noVerification?: boolean;
}

interface SignedMessageState {
    message: any;
    messageParsed: any;
    showRawMessage: boolean;
    verified: boolean | null;
    notification: string | null;
}

function SignedMessage({
    message: messageProp,
    noVerification: noVerificationProp = false
}: SignedMessageProps) {
    const [state, setState] = React.useState<SignedMessageState>(() => ({
        message: messageProp,
        messageParsed: null,
        showRawMessage: false,
        verified: null,
        notification: null
    }));

    const noVerificationRef = React.useRef(noVerificationProp);

    const mergeState = (partial: Partial<SignedMessageState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const warning = (message: string) => {
        mergeState({notification: message});
    };

    const verifyMessage = (signedMessage: any) => {
        mergeState({
            message: signedMessage,
            messageParsed: null,
            verified: null
        });
        let messageParsed: any = null;
        try {
            messageParsed = SignedMessageAction.parseMessage(signedMessage);
            mergeState({
                verified: null,
                messageParsed: messageParsed
            });

            if (!noVerificationRef.current) {
                mergeState({
                    verified: null,
                    notification: counterpart.translate(
                        "account.signedmessages.verifying"
                    )
                });
                setTimeout(() => {
                    // do not block gui
                    try {
                        SignedMessageAction.verifyMemo(messageParsed);
                        mergeState({
                            verified: true,
                            notification: "" // clear popup
                        });
                    } catch (err) {
                        warning((err as any).message);
                        mergeState({
                            verified: false
                        });
                    }
                }, 0);
            }
        } catch (err) {
            warning((err as any).message);
        }
    };

    const hasMountedRef = React.useRef(false);
    const lastVerifiedMessageRef = React.useRef<any>(undefined);

    if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        lastVerifiedMessageRef.current = messageProp;
        verifyMessage(messageProp);
    } else if (
        messageProp != undefined &&
        messageProp != null &&
        messageProp == lastVerifiedMessageRef.current
    ) {
        // already done
    } else {
        lastVerifiedMessageRef.current = messageProp;
        verifyMessage(messageProp);
    }

    const toggleRawMessage = () => {
        mergeState({showRawMessage: !state.showRawMessage});
    };

    let legendMessage;
    let borderColor;
    if (state.messageParsed != null) {
        if (state.verified == null) {
            borderColor = "#FFF";
            legendMessage =
                "Unverified message from " + state.messageParsed.meta.account;
        } else if (state.verified) {
            borderColor = "#FFF";
            legendMessage =
                "Verified message from " + state.messageParsed.meta.account;
        } else {
            borderColor = "#F00";
            legendMessage =
                "Refuted message, indicated sender " +
                state.messageParsed.meta.account;
        }
    }
    const messageGiven = messageProp != null && (messageProp as any) != "";
    const notificationGiven = state.notification && state.notification != "";
    return (
        <div style={{color: "gray", margin: "10px 10px"}}>
            {state.messageParsed != null && (
                <fieldset style={{borderColor: borderColor}}>
                    <legend style={{color: "white", weight: "bold"} as any}>
                        {legendMessage}
                    </legend>
                    <pre
                        style={{
                            position: "relative",
                            width: "100%",
                            display: "table"
                        }}
                    >
                        {state.messageParsed.content}
                        {notificationGiven && (
                            <div
                                style={{
                                    textAlign: "center",
                                    display: "table-cell",
                                    verticalAlign: "middle",
                                    position: "absolute",
                                    width: "calc(100% - 30px)",
                                    height: "calc(100% + 15px)",
                                    top: "0px",
                                    right: "30px",
                                    backgroundColor: "rgba(50,50,50,0.5)"
                                }}
                                id="overlay"
                            >
                                {state.notification}
                            </div>
                        )}
                    </pre>
                    <span
                        style={{
                            fontSize: "small",
                            float: "right"
                        }}
                    >
                        Signed on {state.messageParsed.meta.timestamp} &nbsp;
                        <button
                            className="button"
                            type="button"
                            style={{
                                fontSize: "small",
                                float: "right",
                                padding: "0px 0px",
                                background: "#777"
                            }}
                            onClick={toggleRawMessage}
                        >
                            &#x1f50d;
                        </button>
                    </span>
                    {state.showRawMessage && <br />}
                    {state.showRawMessage && <br />}
                    {state.showRawMessage && (
                        <div
                            style={{
                                overflow: "auto",
                                width: "calc(100%)",
                                maxWidth: "1000px"
                            }}
                        >
                            <pre>{state.message}</pre>
                        </div>
                    )}
                </fieldset>
            )}
            {messageGiven && state.messageParsed == null && (
                <fieldset style={{borderColor: "#F00"}}>
                    <legend
                        style={{color: "red", weight: "bold"} as any}
                        className="error"
                    >
                        Error while parsing message, please check syntax from
                        message below
                    </legend>
                    <pre>{messageProp}</pre>
                </fieldset>
            )}
        </div>
    );
}

export default SignedMessage;
