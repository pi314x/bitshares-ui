// TypeScript/functional-component port of the legacy ReportModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `shouldComponentUpdate` here is not a pure performance guard like
// every other instance of it dropped elsewhere in this migration - it
// also runs a real side effect (`getLogs()` + an `html2canvas` screen
// capture) whenever `visible` transitions from `false` to `true`. The
// re-render-gating half is dropped, per this migration's usual
// treatment (hooks have no equivalent, and it never changes final
// rendered output - once the async `getLogs()`/`html2canvas` calls
// resolve and call `setState`, a follow-up render always happens
// regardless of what the dropped gate would have returned for the
// *intermediate* render). The side-effect half becomes a `useEffect`
// keyed on `visible`: since the effect only re-fires when `visible`
// itself changes, and only proceeds when the *current* value is `true`,
// this reproduces "fires exactly on a false-to-true transition" without
// needing a separate previous-value ref - a true-to-false transition
// re-fires the effect too, but the `visible &&` guard inside skips it,
// exactly matching the original's `nextProps.visible &&` check. Like
// every other `componentDidUpdate`-style effect ported this session
// (see `AccountSelector.tsx`/`JoinWitnessesModal.tsx`/
// `SetDefaultFeeAssetModal.tsx`), this doesn't fire on mount, matching
// `shouldComponentUpdate`'s own semantics (it's never called for the
// initial mount either).
//
// Preserved verbatim, not "fixed" (both grep-verified against the
// original, not introduced here):
// - `decriptionArea`'s `if (true) { // !showLog && !showScreen ... }` -
//   a hardcoded `true` with a comment showing what condition it used to
//   be; the area is unconditionally shown.
// - `screenshotArea`'s `<text>this.state.imageURI</text>` - a bare
//   `<text>` (an SVG element, not HTML, used outside any `<svg>`,
//   mirroring a quirk already found and preserved in
//   `AccountSignedMessages.tsx` earlier this migration) whose child is
//   the *literal string* `"this.state.imageURI"`, not an interpolated
//   `{state.imageURI}` - almost certainly a typo for the latter, but a
//   behavior-changing one this migration doesn't correct.
// - `loadingImage`/`logsCopySuccess` state: initialized `false` and
//   read in `render()`, but never set to `true` anywhere in the file -
//   their conditional UI blocks are permanently dead at runtime, kept
//   as real (if inert) state rather than deleted, since they're
//   genuinely read, just never toggled.
import * as React from "react";
import Translate from "react-translate-component";
import LoadingIndicator from "../LoadingIndicator";
import LogsActions from "actions/LogsActions";
import CopyButton from "../Utility/CopyButton";
import html2canvas from "html2canvas";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import {Tooltip} from "../../design-system/Tooltip";
import counterpart from "counterpart";

interface ReportModalState {
    loadingImage: boolean;
    logEntries: any;
    logsCopySuccess: boolean;
    showLog: boolean;
    imageURI: any;
    showScreen: boolean;
}

interface ReportModalProps {
    visible: boolean;
    hideModal: () => void;
}

export default function ReportModal({visible, hideModal}: ReportModalProps) {
    const [state, setState] = React.useState<ReportModalState>({
        loadingImage: false,
        logEntries: [],
        logsCopySuccess: false,
        showLog: false,
        imageURI: null,
        showScreen: false
    });

    const mergeState = (partial: Partial<ReportModalState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const getLogs = () => {
        (LogsActions as any).getLogs().then((data: any) => {
            if (__DEV__) {
                data.unshift(
                    "Running in DEV mode, persistant capturing of logs deactivated!"
                );
            }
            mergeState({
                logEntries: data.join("\n")
            });
        });
    };

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            return;
        }
        if (visible) {
            getLogs();
            (html2canvas as any)(document.getElementById("content"))
                .then((canvas: any) => {
                    return canvas.toDataURL("image/png");
                })
                .then(
                    (uri: any) => mergeState({imageURI: uri}),
                    (error: any) => {
                        console.error(
                            "Screenshot could not be captured",
                            error
                        );
                        mergeState({
                            imageURI: "Screenshot could not be captured"
                        });
                    }
                );
        }
    }, [visible]);

    const onLogEntryChanged = (e: any) => {
        mergeState({logEntries: [e.target.value]});
    };

    const showScreenshot = () => {
        // Take screenshot
        mergeState({
            showScreen: !state.showScreen
        });
    };

    const showLog = () => {
        mergeState({
            showLog: !state.showLog
        });
    };

    const {
        logEntries,
        loadingImage,
        logsCopySuccess,
        showLog: showLogState,
        showScreen
    } = state;

    const decriptionArea = () => {
        if (true) {
            // !showLog && !showScreen
            return (
                <p>
                    <Translate content="modal.report.explanatory_text_2" />
                    <br />
                    &nbsp;&nbsp;
                    <a
                        href="https://github.com/bitshares/bitshares-ui/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{textAlign: "center", width: "100%"}}
                        className="external-link"
                    >
                        https://github.com/bitshares/bitshares-ui/issues
                    </a>
                    <br />
                    <Translate content="modal.report.explanatory_text_3" />
                    <br />
                    <br />
                    <Translate content="modal.report.explanatory_text_4" />
                </p>
            );
        }
    };

    const logsArea = () => {
        if (showLogState) {
            return (
                <textarea
                    id="logsText"
                    style={{}}
                    rows={20}
                    value={logEntries}
                    onChange={onLogEntryChanged}
                />
            );
        }
    };

    const screenshotArea = () => {
        if (state.imageURI != null) {
            if (showScreen) {
                if (state.imageURI.length > 100) {
                    return <img src={state.imageURI} />;
                } else {
                    return <text>this.state.imageURI</text>;
                }
            }
        }
    };

    return (
        <Modal
            title={counterpart.translate("modal.report.title")}
            visible={visible}
            onCancel={hideModal}
            footer={[
                <Button key={"submit"} onClick={hideModal}>
                    {counterpart.translate("modal.ok")}
                </Button>
            ]}
        >
            <div className="grid-block vertical no-overflow">
                <p>
                    <Translate content="modal.report.explanatory_text_1" />
                </p>
                <span
                    className="raw"
                    style={{
                        border: "1px solid darkgray",
                        marginBottom: "1em"
                    }}
                >
                    <div className="right-label" style={{paddingBottom: "0em"}}>
                        <CopyButton text={state.logEntries} />
                    </div>

                    <Tooltip
                        title={
                            state.showLog
                                ? counterpart.translate("modal.report.hideLog")
                                : counterpart.translate("modal.report.showLog")
                        }
                    >
                        <div onClick={showLog} style={{cursor: "pointer"}}>
                            <label
                                className="left-label"
                                style={{
                                    paddingTop: "1em",
                                    paddingLeft: "0.5em",
                                    cursor: "pointer"
                                }}
                            >
                                {state.showLog ? "-" : "+"}
                                &nbsp;
                                <Translate content="modal.report.lastLogEntries" />
                            </label>
                        </div>
                    </Tooltip>

                    {logsArea()}
                </span>
                <span
                    className="raw"
                    style={{
                        border: "1px solid darkgray",
                        marginBottom: "1em"
                    }}
                >
                    <div className="right-label" style={{paddingBottom: "0em"}}>
                        {state.imageURI != null ? (
                            <img
                                style={{
                                    height: "2.8em",
                                    marginTop: "0em",
                                    marginRight: "0em"
                                }}
                                src={state.imageURI}
                            />
                        ) : (
                            "Failed"
                        )}
                    </div>
                    <div
                        className="right-label"
                        style={{
                            paddingBottom: "0em",
                            paddingTop: "1em",
                            paddingRight: "0.5em"
                        }}
                    >
                        <Translate content="modal.report.copyScreenshot" />
                    </div>

                    <Tooltip
                        title={
                            state.showScreen
                                ? counterpart.translate(
                                      "modal.report.hideScreenshot"
                                  )
                                : counterpart.translate(
                                      "modal.report.takeScreenshot"
                                  )
                        }
                    >
                        <div
                            onClick={showScreenshot}
                            style={{cursor: "pointer"}}
                        >
                            <label
                                className="left-label"
                                style={{
                                    paddingTop: "1em",
                                    paddingLeft: "0.5em",
                                    cursor: "pointer"
                                }}
                            >
                                {state.showScreen ? "-" : "+"}
                                &nbsp;
                                <Translate content="modal.report.screenshot" />
                            </label>
                        </div>
                    </Tooltip>

                    {screenshotArea()}
                </span>
                <br />
                {decriptionArea()}
                {loadingImage && (
                    <div style={{textAlign: "center"}}>
                        <LoadingIndicator type="three-bounce" />
                    </div>
                )}
                {logsCopySuccess && (
                    <p>
                        <Translate content="modal.report.copySuccess" />
                    </p>
                )}
            </div>
        </Modal>
    );
}
