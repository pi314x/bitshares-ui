// What a build says about itself: read from the constants webpack defines, and cut down to what is worth showing - a number
// becomes "v1.0.0", the commit is its first 7 characters, and what the build could not find out is not said at all.
import {buildInfo, buildInfoParts} from "../../lib/common/buildInfo";

describe("buildInfo", () => {
    it("reads the three constants of the build", () => {
        // jest defines them as "test" (package.json)
        expect(buildInfo()).toEqual({
            version: "test",
            branch: "test",
            commit: "test"
        });
    });
});

describe("buildInfoParts", () => {
    const real = {
        version: "1.0.0",
        branch: "claude/bitshares-ui-migration-pu5y14",
        commit: "fc05acf2f"
    };

    it("shows a version number with a v, the commit's first 7 characters and the branch as it is", () => {
        expect(buildInfoParts(real)).toEqual({
            version: "v1.0.0",
            branch: "claude/bitshares-ui-migration-pu5y14",
            commit: "fc05acf"
        });
    });

    it("cuts a full 40-character commit as well", () => {
        const full = "fc05acf2f9d1ae68c31676da6c2ec4c0bd6d0126";
        expect(buildInfoParts({...real, commit: full}).commit).toBe("fc05acf");
    });

    it("says nothing for what the build could not find out or was not told", () => {
        expect(
            buildInfoParts({version: "", branch: "unknown", commit: "unknown"})
        ).toEqual({version: "", branch: "", commit: ""});
        // the Dockerfile's branch name for a build without one
        expect(buildInfoParts({...real, branch: "container"}).branch).toBe("");
        expect(buildInfoParts({...real, commit: "unknown"}).commit).toBe("");
    });

    it("says the commit once when the version is the commit (a `develop` build)", () => {
        expect(
            buildInfoParts({
                version: "3418709",
                branch: "develop",
                commit: "3418709"
            })
        ).toEqual({version: "", branch: "develop", commit: "3418709"});
        expect(
            buildInfoParts({
                version: "3418709a0",
                branch: "develop",
                commit: "3418709"
            }).version
        ).toBe("");
    });

    it("shows a version that is not a number as it is, and keeps a version when the commit is another", () => {
        expect(buildInfoParts({...real, version: "next"}).version).toBe("next");
        expect(
            buildInfoParts({
                version: "1.0.0",
                branch: "main",
                commit: "abcdef1"
            }).version
        ).toBe("v1.0.0");
    });
});
