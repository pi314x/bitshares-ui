// What this build is: the git branch and the commit it was built from. Both are decided when the app is built (webpack.config.js;
// a container build has no .git folder and is told them through its BRANCH and GIT_REV build arguments). The footer of the left
// menu shows them (next/BuildInfo.tsx), so a running site can say which code it is. The version of package.json is not shown: it
// is one fixed number for every build, the commit says which code it is. The `typeof` keeps a bundle that does not define them
// (the preview build) working.

export interface BuildInfo {
    branch: string;
    commit: string;
}

/** What the build says about itself; "" for what it does not define. */
export function buildInfo(): BuildInfo {
    return {
        branch: typeof __GIT_BRANCH__ !== "undefined" ? __GIT_BRANCH__ : "",
        commit: typeof __GIT_REV__ !== "undefined" ? __GIT_REV__ : ""
    };
}

// What a build says when it could not find out ("unknown": no .git folder and no build argument) or was not told ("container":
// the Dockerfile's branch name for a build without one): nothing worth showing.
const NOT_KNOWN = ["", "unknown", "container"];

const COMMIT_LENGTH = 7;

/** The two parts as they are shown; "" for a part that is not known. */
export function buildInfoParts(info: BuildInfo): BuildInfo {
    const known = (value: string) =>
        NOT_KNOWN.indexOf(value) === -1 ? value : "";
    return {
        branch: known(info.branch),
        commit: known(info.commit).slice(0, COMMIT_LENGTH)
    };
}
