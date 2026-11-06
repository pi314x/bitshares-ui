import * as React from "react";
import {render} from "@testing-library/react";
import {Star} from "../../design-system/Star";

describe("design-system/Star", () => {
    it("draws the outline star when it is off and the filled one when it is on", () => {
        const off = render(<Star />);
        const on = render(<Star on />);
        const offShape = off.container.querySelector("svg")!.innerHTML;
        const onShape = on.container.querySelector("svg")!.innerHTML;
        expect(offShape).not.toBe("");
        expect(onShape).not.toBe("");
        expect(onShape).not.toBe(offShape);
    });

    it("marks an on star, carries its title and takes a size", () => {
        const {container} = render(<Star on title="Favourite" size={20} />);
        const star = container.firstElementChild as HTMLElement;
        expect(star.getAttribute("title")).toBe("Favourite");
        expect(star.className.split(" ").length).toBeGreaterThan(1);
        const svg = container.querySelector("svg")!;
        expect(svg.getAttribute("width")).toBe("20");
    });
});
