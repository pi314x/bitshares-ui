import * as React from "react";
import {render} from "@testing-library/react";
import {Progress} from "../../design-system/Progress";

describe("design-system/Progress", () => {
    it("sizes the fill bar to the given percent", () => {
        const {container} = render(<Progress percent={40} />);
        const fill = container.querySelector(
            "[class*='fill']"
        ) as HTMLElement;
        expect(fill.style.width).toBe("40%");
    });

    it("shows the rounded percentage by default", () => {
        const {getByText} = render(<Progress percent={33.6} />);
        expect(getByText("34%")).toBeTruthy();
    });

    it("hides the info text when showInfo is false", () => {
        const {queryByText} = render(
            <Progress percent={40} showInfo={false} />
        );
        expect(queryByText("40%")).toBeNull();
    });

    it("clamps percent to the 0-100 range", () => {
        const {container: over} = render(<Progress percent={150} />);
        expect(
            (over.querySelector("[class*='fill']") as HTMLElement).style
                .width
        ).toBe("100%");

        const {container: under} = render(<Progress percent={-10} />);
        expect(
            (under.querySelector("[class*='fill']") as HTMLElement).style
                .width
        ).toBe("0%");
    });
});
