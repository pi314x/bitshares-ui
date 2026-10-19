import * as React from "react";
import {render} from "@testing-library/react";
import {ButtonRow} from "../../design-system/ButtonRow";

describe("design-system/ButtonRow", () => {
    it("holds its buttons in one wrapping row", () => {
        const {container} = render(
            <ButtonRow>
                <button>Save</button>
                <button>Reset</button>
            </ButtonRow>
        );
        const row = container.firstElementChild as HTMLElement;
        expect(row.children).toHaveLength(2);
        expect(row.className).toMatch(/row/);
        expect(row.className).not.toMatch(/end|spaced/);
    });

    it("can sit at the end of the line, with space above, and take a class", () => {
        const {container} = render(
            <ButtonRow end spaced className="steps-action">
                <button>OK</button>
            </ButtonRow>
        );
        const row = container.firstElementChild as HTMLElement;
        expect(row.className).toMatch(/end/);
        expect(row.className).toMatch(/spaced/);
        expect(row.classList.contains("steps-action")).toBe(true);
    });
});
