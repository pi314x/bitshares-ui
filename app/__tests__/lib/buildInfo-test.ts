// What a build says about itself: read from the constants webpack defines, and cut down to what is worth showing - the commit is
// its first 7 characters, what the build could not find out is not said at all, and the version is not part of it.
import {buildInfo, buildInfoParts} from "../../lib/common/buildInfo";

describe("buildInfo", () => {
    it("reads the two constants of the build, and not the version", () => {
        // jest defines them as "test" (package.json)
        expect(buildInfo()).toEqual({branch: "test", commit: "test"});
    });
});

describe("buildInfoParts", () => {
    const real = {
        branch: "pi314x/bitshares-ui-migration-pu5y14",
        commit: "fc05acf2f"
    };

    it("shows the commit's first 7 characters and the branch as it is", () => {
        expect(buildInfoParts(real)).toEqual({
            branch: "pi314x/bitshares-ui-migration-pu5y14",
            commit: "fc05acf"
        });
    });

    it("cuts a full 40-character commit as well", () => {
        const full = "fc05acf2f9d1ae68c31676da6c2ec4c0bd6d0126";
        expect(buildInfoParts({...real, commit: full}).commit).toBe("fc05acf");
    });

    it("says nothing for what the build could not find out or was not told", () => {
        expect(buildInfoParts({branch: "unknown", commit: "unknown"})).toEqual({
            branch: "",
            commit: ""
        });
        expect(buildInfoParts({branch: "", commit: ""})).toEqual({
            branch: "",
            commit: ""
        });
        // the Dockerfile's branch name for a build without one
        expect(buildInfoParts({...real, branch: "container"}).branch).toBe("");
        expect(buildInfoParts({...real, commit: "unknown"}).commit).toBe("");
    });

    it("never returns a version, even when the build object carries one", () => {
        const withVersion = {...real, version: "1.0.0"};
        expect(Object.keys(buildInfoParts(withVersion)).sort()).toEqual([
            "branch",
            "commit"
        ]);
    });
});
