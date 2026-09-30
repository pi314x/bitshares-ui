// TypeScript/functional-component port of the legacy LoadingIndicator.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: purely a presentational spinner.
//
// Preserved verbatim, not "fixed": `state.progress` is initialized to
// `0` and never updated anywhere in the file (grepped) - the
// `<span>{state.progress}</span>` in the default case's "progress
// indicator" always renders "0". Separately, the `with-progress` CSS
// class is only ever added when `this.progress > 0` - but `this.progress`
// (no `.state`) is a plain instance property that's never assigned
// anywhere either (a distinct bug from the `state.progress` field above,
// almost certainly a typo for it), so it's always `undefined` and that
// branch never runs. A function component has no `this` at all, so this
// specific broken reference can't be transcribed literally - simplified
// to the behaviorally identical constant (the class is never added),
// which is the one case in this migration where TypeScript's lack of a
// `this` context (not its type system) forces a change to an otherwise
// "preserve every bug verbatim" case.
//
// The unreachable `break;` statements after each `case`'s `return` in
// the original `switch` are dropped as syntactically meaningless (dead
// code with zero effect either way, not a functional change).
import * as React from "react";

interface LoadingIndicatorProps {
    type?: string | null;
    loadingText?: string | null;
    children?: React.ReactNode;
}

export default function LoadingIndicator({
    type = null,
    loadingText = null,
    children
}: LoadingIndicatorProps) {
    const [progress] = React.useState(0);

    switch (type) {
        case "three-bounce":
            return (
                <div className="three-bounce">
                    <div className="bounce1" />
                    <div className="bounce2" />
                    <div className="bounce3" />
                </div>
            );
        case "circle":
            return (
                <div className="circle-wrapper">
                    <div className="circle1 circle" />
                    <div className="circle2 circle" />
                    <div className="circle3 circle" />
                    <div className="circle4 circle" />
                    <div className="circle5 circle" />
                    <div className="circle6 circle" />
                    <div className="circle7 circle" />
                    <div className="circle8 circle" />
                    <div className="circle9 circle" />
                    <div className="circle10 circle" />
                    <div className="circle11 circle" />
                    <div className="circle12 circle" />
                </div>
            );
        case "circle-small":
            return (
                <div
                    className="circle-wrapper"
                    style={{height: "15px", minHeight: "15px"}}
                >
                    <div className="circle1 circle" />
                    <div className="circle2 circle" />
                    <div className="circle3 circle" />
                    <div className="circle4 circle" />
                    <div className="circle5 circle" />
                    <div className="circle6 circle" />
                    <div className="circle7 circle" />
                    <div className="circle8 circle" />
                    <div className="circle9 circle" />
                    <div className="circle10 circle" />
                    <div className="circle11 circle" />
                    <div className="circle12 circle" />
                </div>
            );
        default: {
            const classes = "loading-overlay";
            return (
                <div className={classes}>
                    <div className="loading-panel">
                        {loadingText && (
                            <div
                                className="text-center"
                                style={{paddingTop: "10px", color: "black"}}
                            >
                                {loadingText}
                            </div>
                        )}
                        <div className="spinner">
                            <div className="bounce1" />
                            <div className="bounce2" />
                            <div className="bounce3" />
                        </div>
                        <div className="progress-indicator">
                            <span>{progress}</span>
                        </div>
                    </div>
                    {!!children && (
                        <div className="loading-panel--child">{children}</div>
                    )}
                </div>
            );
        }
    }
}
