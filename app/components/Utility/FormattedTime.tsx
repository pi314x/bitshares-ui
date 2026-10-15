// TypeScript/functional-component port of the legacy FormattedTime.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
// Displays a duration given in seconds as hours (e.g. "1.5h").
//
// Preserved verbatim (not "fixed"): the original stores `props.time` in
// `this.state.time` in the constructor and never updates it again (no
// `componentWillReceiveProps`/similar) - so it freezes at whatever
// `time` was passed on the very first render, ignoring later prop
// changes. Replicated with a `useState` lazy initializer (runs once,
// matching a constructor), not a plain prop read.
import * as React from "react";

interface FormattedTimeProps {
    time: number;
}

function getHours(secs: number) {
    return secs / 3600;
}

function FormattedTime({time: initialTime}: FormattedTimeProps) {
    const [time] = React.useState(initialTime);
    return <div>{getHours(time)}h</div>;
}

export default FormattedTime;
