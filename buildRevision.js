// Which branch and commit a build is of: the footer of the left menu shows them (__GIT_BRANCH__ and __GIT_REV__ in
// webpack.config.js, lib/common/buildInfo.ts).
//
// What a build is told wins (BRANCH and GIT_REV: scripts/prepare-release.sh, a build argument). The placeholders the Dockerfile
// and docker-compose use for "not told" ("container", "unknown", or nothing) are not told values. Otherwise the build reads git, and it
// READS FILES, it does not run git: a container build's context keeps only .git/HEAD, .git/packed-refs and .git/refs/heads
// (.dockerignore), which is enough for the branch and the commit and carries nothing secret (no .git/config, no objects).
// A detached HEAD has a commit and no branch. What cannot be found out is "unknown", which the footer does not show.

const NOT_TOLD = ["container", "unknown"];
const told = value => (NOT_TOLD.indexOf(value) === -1 ? value : "");
const DETACHED = /^Detached: /;

const attempt = read => {
    try {
        return read();
    } catch (e) {
        return "";
    }
};

/**
 * @param {{env: object, git: {branch: Function, short: Function}, root: string, run?: Function}} options
 *   git: git-rev-sync; run(root): the short commit by asking git itself, for a git worktree (its `.git` is a pointer file
 *   that git-rev-sync cannot follow to the commit).
 * @returns {{branch: string, commit: string}}
 */
function buildRevision({env, git, root, run}) {
    let branch = told(env.BRANCH);
    let commit = told(env.GIT_REV);
    if (!branch) {
        const name = attempt(() => git.branch(root));
        branch = DETACHED.test(name) ? "" : name;
    }
    if (!commit) {
        commit =
            attempt(() => git.short(root)) ||
            (run ? attempt(() => run(root)) : "");
    }
    return {branch: branch || "unknown", commit: commit || "unknown"};
}

module.exports = {buildRevision};
