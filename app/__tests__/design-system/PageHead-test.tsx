import * as React from "react";
import {render} from "@testing-library/react";
import {PageHead} from "../../design-system/PageHead";

describe("design-system/PageHead", () => {
    it("renders the title as the page's h1, with the lead and the note under it", () => {
        const {getByRole, getByText} = render(
            <PageHead title="Voting" lead="What it is for." note="A note." />
        );
        expect(getByRole("heading", {level: 1}).textContent).toBe("Voting");
        expect(getByText("What it is for.").tagName).toBe("P");
        expect(getByText("A note.").tagName).toBe("P");
    });

    it("draws no paragraph when there is no lead or note", () => {
        const {container} = render(<PageHead title="Help" />);
        expect(container.querySelector("p")).toBeNull();
    });

    it("puts the page's action next to the text, and none when there is none", () => {
        const {getByText, container, rerender} = render(
            <PageHead
                title="SameT funds"
                action={<button>Create fund</button>}
            />
        );
        expect(getByText("Create fund")).toBeTruthy();
        rerender(<PageHead title="SameT funds" action={null} />);
        expect(container.querySelector("button")).toBeNull();
    });

    it("can drop the space under it, for a page that spaces its own blocks", () => {
        const {container, rerender} = render(<PageHead title="A" />);
        const head = () => container.firstElementChild as HTMLElement;
        const normal = head().className;
        rerender(<PageHead title="A" flush />);
        expect(head().className).not.toBe(normal);
    });
});
