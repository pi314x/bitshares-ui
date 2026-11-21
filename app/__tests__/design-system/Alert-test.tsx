import * as React from "react";
import {render} from "@testing-library/react";
import {Alert} from "../../design-system/Alert";

describe("design-system/Alert", () => {
    it("renders a message with no description", () => {
        const {getByText, queryByText} = render(
            <Alert message="Something happened" />
        );
        expect(getByText("Something happened")).toBeTruthy();
        expect(queryByText("More detail")).toBeNull();
    });

    it("renders both a message and a description when both are given", () => {
        const {getByText} = render(
            <Alert message="Title" description="More detail" />
        );
        expect(getByText("Title")).toBeTruthy();
        expect(getByText("More detail")).toBeTruthy();
    });

    it("renders with only a description when message is empty", () => {
        const {getByText, container} = render(
            <Alert message="" description="Just the detail" />
        );
        expect(getByText("Just the detail")).toBeTruthy();
        expect(container.querySelector("[class*='message']")).toBeNull();
    });

    it("shows a type-matching icon only when showIcon is set", () => {
        const {container: withIcon} = render(
            <Alert message="Warning" type="warning" showIcon />
        );
        expect(withIcon.querySelector("svg")).toBeTruthy();

        const {container: withoutIcon} = render(
            <Alert message="Warning" type="warning" />
        );
        expect(withoutIcon.querySelector("svg")).toBeNull();
    });

    it("applies the type as a CSS module class for each of the four types", () => {
        (["success", "info", "warning", "error"] as const).forEach(type => {
            const {container} = render(<Alert message="x" type={type} />);
            const el = container.firstChild as HTMLElement;
            expect(el.className).toMatch(new RegExp(type));
        });
    });

    it("applies the banner class when banner is set", () => {
        const {container} = render(<Alert message="x" banner />);
        const el = container.firstChild as HTMLElement;
        expect(el.className).toMatch(/banner/);
    });
});
