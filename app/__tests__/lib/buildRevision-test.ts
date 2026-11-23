// Which branch and commit a build is of. What the build is told wins (and the Dockerfile's / compose's placeholders are not told
// values); else it is read from the .git files, which a container build's context keeps; a detached HEAD has a commit and no
// branch; what cannot be found is "unknown". The real reading is checked on files in a temporary folder, with git-rev-sync.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {buildRevision} from "../../../buildRevision";

// git-rev-sync ships no types
// eslint-disable-next-line @typescript-eslint/no-var-requires
const gitRevSync = require("git-rev-sync");

const fakeGit = (branch: string, short: string) => ({
    branch: jest.fn(() => branch),
    short: jest.fn(() => short)
});

describe("buildRevision (what the build is told)", () => {
    it("takes BRANCH and GIT_REV as they are, and does not read git", () => {
        const git = fakeGit("develop", "1234567");
        expect(
            buildRevision({
                env: {BRANCH: "release/1", GIT_REV: "abcdef1"},
                git,
                root: "/app"
            })
        ).toEqual({branch: "release/1", commit: "abcdef1"});
        expect(git.branch).not.toHaveBeenCalled();
        expect(git.short).not.toHaveBeenCalled();
    });

    it("does not count the placeholders of the Dockerfile and of compose as told", () => {
        const git = fakeGit("pi314x/migration", "36212e7");
        for (const placeholder of ["container", "unknown", ""]) {
            expect(
                buildRevision({
                    env: {BRANCH: placeholder, GIT_REV: placeholder},
                    git,
                    root: "/app"
                })
            ).toEqual({branch: "pi314x/migration", commit: "36212e7"});
        }
    });

    it("reads what it was not told, and keeps what it was", () => {
        const git = fakeGit("main", "36212e7");
        expect(
            buildRevision({env: {GIT_REV: "abcdef1"}, git, root: "/app"})
        ).toEqual({branch: "main", commit: "abcdef1"});
        expect(
            buildRevision({env: {BRANCH: "named"}, git, root: "/app"})
        ).toEqual({branch: "named", commit: "36212e7"});
    });

    it("asks git-rev-sync about the repository's own folder", () => {
        const git = fakeGit("main", "36212e7");
        buildRevision({env: {}, git, root: "/the/repo"});
        expect(git.branch).toHaveBeenCalledWith("/the/repo");
        expect(git.short).toHaveBeenCalledWith("/the/repo");
    });
});

describe("buildRevision (what it cannot find)", () => {
    const throwing = () => {
        throw new Error("no repository");
    };

    it("says unknown for both when there is no git at all", () => {
        expect(
            buildRevision({
                env: {},
                git: {branch: throwing, short: throwing},
                root: "/app"
            })
        ).toEqual({branch: "unknown", commit: "unknown"});
    });

    it("has a commit and no branch for a detached HEAD", () => {
        const git = {
            branch: () => "Detached: 36212e7f9d1ae68c31676da6c2ec4c0bd6d0126",
            short: () => "36212e7"
        };
        expect(buildRevision({env: {}, git, root: "/app"})).toEqual({
            branch: "unknown",
            commit: "36212e7"
        });
    });

    it("asks git itself for the commit when git-rev-sync cannot (a git worktree)", () => {
        const run = jest.fn(() => "36212e7");
        expect(
            buildRevision({
                env: {},
                git: {branch: () => "main", short: throwing},
                root: "/wt",
                run
            })
        ).toEqual({branch: "main", commit: "36212e7"});
        expect(run).toHaveBeenCalledWith("/wt");
    });

    it("says unknown when git itself fails as well, and does not throw", () => {
        expect(
            buildRevision({
                env: {},
                git: {branch: () => "main", short: throwing},
                root: "/wt",
                run: throwing
            })
        ).toEqual({branch: "main", commit: "unknown"});
    });
});

describe("buildRevision (the files a container build keeps)", () => {
    const commit = "36212e7f9d1ae68c31676da6c2ec4c0bd6d0126";
    let dir: string;

    const put = (file: string, text: string) => {
        const target = path.join(dir, ".git", file);
        fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.writeFileSync(target, text);
    };

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "revision-"));
    });

    afterEach(() => {
        fs.rmSync(dir, {recursive: true, force: true});
    });

    it("reads a branch checked out with a loose ref", () => {
        put("HEAD", "ref: refs/heads/pi314x/bitshares-ui-migration\n");
        put("refs/heads/pi314x/bitshares-ui-migration", commit + "\n");
        expect(buildRevision({env: {}, git: gitRevSync, root: dir})).toEqual({
            branch: "pi314x/bitshares-ui-migration",
            commit: "36212e7"
        });
    });

    it("reads a branch whose ref is only in packed-refs", () => {
        put("HEAD", "ref: refs/heads/main\n");
        put(
            "packed-refs",
            "# pack-refs with: peeled fully-peeled sorted\n" +
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa refs/heads/develop\n" +
                commit +
                " refs/heads/main\n"
        );
        expect(buildRevision({env: {}, git: gitRevSync, root: dir})).toEqual({
            branch: "main",
            commit: "36212e7"
        });
    });

    it("reads a detached HEAD: the commit, no branch", () => {
        put("HEAD", commit + "\n");
        expect(buildRevision({env: {}, git: gitRevSync, root: dir})).toEqual({
            branch: "unknown",
            commit: "36212e7"
        });
    });

    it("works with nothing but those three paths in .git (no config, no objects)", () => {
        put("HEAD", "ref: refs/heads/main\n");
        put("refs/heads/main", commit + "\n");
        expect(fs.readdirSync(path.join(dir, ".git")).sort()).toEqual([
            "HEAD",
            "refs"
        ]);
        expect(
            buildRevision({env: {}, git: gitRevSync, root: dir}).commit
        ).toBe("36212e7");
    });
});

describe(".dockerignore (what the container build's context keeps of .git)", () => {
    const lines = fs
        .readFileSync(path.join(__dirname, "../../../.dockerignore"), "utf8")
        .split("\n")
        .map(line => line.trim())
        .filter(line => line && !line.startsWith("#"));

    it("leaves .git out, and takes back only HEAD, packed-refs and refs/heads, after it", () => {
        const at = lines.indexOf(".git");
        expect(at).toBeGreaterThan(-1);
        expect(lines.filter(line => line.startsWith("!.git"))).toEqual([
            "!.git/HEAD",
            "!.git/packed-refs",
            "!.git/refs/heads"
        ]);
        expect(lines.indexOf("!.git/HEAD")).toBeGreaterThan(at);
    });

    it("never takes back .git/config (a remote address can carry a token) or the objects", () => {
        expect(lines).not.toContain("!.git/config");
        expect(lines).not.toContain("!.git/objects");
        expect(lines).not.toContain("!.git");
    });
});

describe("the build files", () => {
    const read = (file: string) =>
        fs.readFileSync(path.join(__dirname, "../../../", file), "utf8");

    it("webpack.config.js asks buildRevision, not a copy of its rules", () => {
        const source = read("webpack.config.js");
        expect(source).toContain('require("./buildRevision")');
        expect(source).not.toContain("process.env.BRANCH");
    });
});
