import * as React from "react";
import {render} from "@testing-library/react";
import {Icon} from "../../design-system/Icon";

describe("design-system/Icon", () => {
    it("renders an outlined glyph by default", () => {
        const {container} = render(<Icon type="search" />);
        const svg = container.querySelector("svg");
        expect(svg).toBeTruthy();
        expect(svg?.querySelector("circle")).toBeTruthy();
    });

    it("renders the filled variant only for glyphs that have one", () => {
        const {container: filled} = render(
            <Icon type="question-circle" theme="filled" />
        );
        const filledCircle = filled.querySelector("circle");
        expect(filledCircle?.getAttribute("fill")).toBe("currentColor");

        // "search" has no filled variant, so theme="filled" falls back to
        // its outline path instead of rendering nothing.
        const {container: fallback} = render(
            <Icon type="search" theme="filled" />
        );
        expect(fallback.querySelector("svg")).toBeTruthy();
        expect(fallback.querySelector("path")).toBeTruthy();
    });

    it("applies the spin class only to the loading glyph", () => {
        const {container: loading} = render(<Icon type="loading" />);
        expect(
            loading.querySelector("svg")?.getAttribute("class")
        ).toContain("spin");

        const {container: notLoading} = render(<Icon type="search" />);
        expect(
            notLoading.querySelector("svg")?.getAttribute("class")
        ).not.toContain("spin");
    });

    it("passes through className and other SVG attributes", () => {
        const {container} = render(
            <Icon type="close" className="custom" data-testid="close-icon" />
        );
        const svg = container.querySelector("svg");
        expect(svg?.getAttribute("class")).toContain("custom");
        expect(svg?.getAttribute("data-testid")).toBe("close-icon");
    });
});
