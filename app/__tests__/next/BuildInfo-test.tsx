// The build line of the left menu's footer: the version and the commit on one line, the git branch under it, the whole of it as the
// title, and nothing at all for a build that knows nothing about itself.
import * as React from "react";
import {render} from "@testing-library/react";
import BuildInfo from "../../next/BuildInfo";

const real = {
    version: "1.0.0",
    branch: "claude/bitshares-ui-migration-pu5y14",
    commit: "fc05acf2f"
};

describe("BuildInfo", () => {
    it("shows the version, the commit and the branch", () => {
        const view = render(<BuildInfo info={real} />);
        const box = view.getByTestId("build-info");
        expect(box.textContent).toBe(
            "v1.0.0 · fc05acfclaude/bitshares-ui-migration-pu5y14"
        );
        expect(view.getByText("v1.0.0 · fc05acf")).toBeTruthy();
        expect(
            view.getByText("claude/bitshares-ui-migration-pu5y14")
        ).toBeTruthy();
    });

    it("carries the whole of it as the title, for a branch name the line cuts short", () => {
        const view = render(<BuildInfo info={real} />);
        expect(view.getByTestId("build-info").getAttribute("title")).toBe(
            "v1.0.0 · fc05acf · claude/bitshares-ui-migration-pu5y14"
        );
    });

    it("leaves out the branch of a container build that was not told it", () => {
        const view = render(
            <BuildInfo info={{...real, branch: "container"}} />
        );
        expect(view.getByTestId("build-info").textContent).toBe(
            "v1.0.0 · fc05acf"
        );
    });

    it("shows what is known when the rest is not", () => {
        const view = render(
            <BuildInfo
                info={{version: "1.0.0", branch: "unknown", commit: "unknown"}}
            />
        );
        expect(view.getByTestId("build-info").textContent).toBe("v1.0.0");
        const onlyBranch = render(
            <BuildInfo info={{version: "", branch: "main", commit: ""}} />
        );
        expect(onlyBranch.getAllByTestId("build-info")[1].textContent).toBe(
            "main"
        );
    });

    it("shows nothing for a build that knows nothing about itself", () => {
        const view = render(
            <BuildInfo
                info={{version: "", branch: "unknown", commit: "unknown"}}
            />
        );
        expect(view.queryByTestId("build-info")).toBeNull();
        expect(view.container.firstChild).toBeNull();
    });

    it("reads the build's own constants when it is given nothing", () => {
        // jest defines all three as "test": the version is the commit, so it is said once, and the branch under it
        const view = render(<BuildInfo />);
        expect(view.getByTestId("build-info").textContent).toBe("testtest");
    });
});
