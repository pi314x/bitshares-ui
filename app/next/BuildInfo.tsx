// The version, the commit and the git branch of this build, small and muted at the top of the left menu's footer: a running
// site, a phone's screenshot or a bug report can then say which code it is. Nothing is shown for what the build does not know.
import * as React from "react";
import {
    BuildInfo as Info,
    buildInfo,
    buildInfoParts
} from "../lib/common/buildInfo";
import styles from "./BuildInfo.module.scss";

export default function BuildInfo({
    info = buildInfo()
}: {
    info?: Info;
}): JSX.Element | null {
    const {version, commit, branch} = buildInfoParts(info);
    const head = [version, commit].filter(Boolean).join(" · ");
    if (!head && !branch) return null;
    return (
        <div
            className={styles.info}
            // the whole of it, for a branch name the line cuts short
            title={[head, branch].filter(Boolean).join(" · ")}
            data-testid="build-info"
        >
            {head ? <span className={styles.head}>{head}</span> : null}
            {branch ? <span className={styles.branch}>{branch}</span> : null}
        </div>
    );
}
