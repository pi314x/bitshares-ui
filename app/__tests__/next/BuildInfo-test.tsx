// The build line of the left menu's footer: the commit on one line, the git branch under it, the whole of it as the title, no
// version, and nothing at all for a build that knows nothing about itself.
import * as React from "react";
import {render} from "@testing-library/react";
import BuildInfo from "../../next/BuildInfo";

const real = {
    branch: "pi314x/bitshares-ui-migration-pu5y14",
    commit: "fc05acf2f"
};

describe("BuildInfo", () => {
    it("shows the commit and the branch", () => {
        const view = render(<BuildInfo info={real} />);
        const box = view.getByTestId("build-info");
        expect(box.textContent).toBe(
            "fc05acfpi314x/bitshares-ui-migration-pu5y14"
        );
        expect(view.getByText("fc05acf")).toBeTruthy();
        expect(
            view.getByText("pi314x/bitshares-ui-migration-pu5y14")
        ).toBeTruthy();
    });

    it("does not show a version, not even one the build carries", () => {
        const withVersion = {...real, version: "1.0.0"};
        const view = render(<BuildInfo info={withVersion} />);
        expect(view.getByTestId("build-info").textContent).not.toContain(
            "1.0.0"
        );
        expect(view.queryByText(/v1\.0\.0/)).toBeNull();
    });

    it("carries the whole of it as the title, for a branch name the line cuts short", () => {
        const view = render(<BuildInfo info={real} />);
        expect(view.getByTestId("build-info").getAttribute("title")).toBe(
            "fc05acf · pi314x/bitshares-ui-migration-pu5y14"
        );
    });

    it("leaves out the branch of a container build that was not told it", () => {
        const view = render(
            <BuildInfo info={{...real, branch: "container"}} />
        );
        expect(view.getByTestId("build-info").textContent).toBe("fc05acf");
    });

    it("shows what is known when the rest is not", () => {
        const onlyCommit = render(
            <BuildInfo info={{branch: "unknown", commit: "fc05acf2f"}} />
        );
        expect(onlyCommit.getByTestId("build-info").textContent).toBe(
            "fc05acf"
        );
        const onlyBranch = render(
            <BuildInfo info={{branch: "main", commit: ""}} />
        );
        expect(onlyBranch.getAllByTestId("build-info")[1].textContent).toBe(
            "main"
        );
    });

    it("shows nothing for a build that knows nothing about itself", () => {
        const view = render(
            <BuildInfo info={{branch: "unknown", commit: "unknown"}} />
        );
        expect(view.queryByTestId("build-info")).toBeNull();
        expect(view.container.firstChild).toBeNull();
    });

    it("reads the build's own constants when it is given nothing", () => {
        // jest defines both as "test"
        const view = render(<BuildInfo />);
        expect(view.getByTestId("build-info").textContent).toBe("testtest");
    });
});
