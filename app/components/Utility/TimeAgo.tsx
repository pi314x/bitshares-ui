// TypeScript/functional-component port of the legacy TimeAgo.jsx (Phase
// 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `shouldComponentUpdate` (`nextProps.time !== this.props.time`) is a
// pure shallow-equality performance guard with no other side effects -
// not replicated, per this migration's established treatment (hooks
// re-render naturally on every dependency change; this component takes
// no other props that would cause a spurious re-render anyway).
//
// Dropped as confirmed dead (single self-contained file, no other class
// referencing `this.refs`): the legacy string ref
// (`ref={"timeago_ttip_" + time}`) on the wrapper `<span>`.
import * as React from "react";
import {FormattedRelative} from "react-intl";
import {ChainStore} from "bitsharesjs";
import {Tooltip} from "../../design-system/Tooltip";

interface TimeAgoProps {
    time: any;
    chain_time?: boolean;
    component?: React.ReactElement;
    className?: string;
}

function TimeAgo({time, chain_time = true, className}: TimeAgoProps) {
    const offset_mills = chain_time
        ? (ChainStore as any).getEstimatedChainTimeOffset()
        : 0;
    if (!time) {
        return null;
    }
    if (
        typeof time === "string" &&
        time.indexOf("+") === -1 &&
        !/Z$/.test(time)
    ) {
        time += "Z";
    }

    const timePassed = Math.round(
        (new Date().getTime() - new Date(time).getTime() + offset_mills) / 1000
    );
    let interval;

    if (timePassed < 60) {
        // 60s
        interval = 500; // 0.5s
    } else if (timePassed < 60 * 60) {
        // 1 hour
        interval = 60 * 500; // 30 seconds
    } else {
        interval = 60 * 60 * 500; // 30 minutes
    }

    return (
        <Tooltip placement="bottom" title={new Date(time).toString()}>
            <span className={"tooltip inline-block " + className}>
                <FormattedRelative
                    updateInterval={interval}
                    value={new Date(time).getTime() + offset_mills * 0.75}
                    initialNow={Date.now()}
                />
            </span>
        </Tooltip>
    );
}

export default TimeAgo;
