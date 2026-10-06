import * as React from "react";
import {render} from "@testing-library/react";
import {BodyClassName} from "../../design-system/BodyClassName";

describe("design-system/BodyClassName", () => {
    afterEach(() => {
        document.body.className = "";
    });

    it("adds its className to document.body while mounted", () => {
        const {unmount} = render(
            <BodyClassName className="dark">content</BodyClassName>
        );
        expect(document.body.classList.contains("dark")).toBe(true);

        unmount();
        expect(document.body.classList.contains("dark")).toBe(false);
    });

    it("swaps the body class when className changes", () => {
        const {rerender} = render(
            <BodyClassName className="dark">content</BodyClassName>
        );
        expect(document.body.classList.contains("dark")).toBe(true);

        rerender(<BodyClassName className="light">content</BodyClassName>);
        expect(document.body.classList.contains("dark")).toBe(false);
        expect(document.body.classList.contains("light")).toBe(true);
    });

    it("renders its children unchanged", () => {
        const {getByText} = render(
            <BodyClassName className="dark">
                <span>child content</span>
            </BodyClassName>
        );
        expect(getByText("child content")).toBeTruthy();
    });
});
