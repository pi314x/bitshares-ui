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

    it("renders the four glyphs added during the call-site migration pass", () => {
        (["star", "user", "plus-circle", "file-search"] as const).forEach(
            type => {
                const {container} = render(<Icon type={type} />);
                expect(container.querySelector("svg")).toBeTruthy();
            }
        );
    });

    it("renders the lock/unlock glyphs added during the call-site migration pass", () => {
        (["lock", "unlock"] as const).forEach(type => {
            const {container} = render(<Icon type={type} />);
            expect(container.querySelector("svg")).toBeTruthy();
            expect(container.querySelector("rect")).toBeTruthy();
        });
    });

    it("renders the line-chart glyph added during the call-site migration pass", () => {
        const {container} = render(<Icon type="line-chart" />);
        expect(container.querySelector("svg")).toBeTruthy();
        expect(container.querySelector("path")).toBeTruthy();
    });

    it("renders the download glyph added during the call-site migration pass", () => {
        const {container} = render(<Icon type="download" />);
        expect(container.querySelector("svg")).toBeTruthy();
        expect(container.querySelector("path")).toBeTruthy();
    });

    it("renders the message glyph added during the call-site migration pass", () => {
        const {container} = render(<Icon type="message" />);
        expect(container.querySelector("svg")).toBeTruthy();
        expect(container.querySelector("path")).toBeTruthy();
    });

    it("renders star's filled variant distinctly from its outline", () => {
        const {container: outline} = render(<Icon type="star" />);
        expect(
            outline.querySelector("path")?.getAttribute("fill")
        ).not.toBe("currentColor");

        const {container: filled} = render(
            <Icon type="star" theme="filled" />
        );
        expect(filled.querySelector("path")?.getAttribute("fill")).toBe(
            "currentColor"
        );
    });
});
