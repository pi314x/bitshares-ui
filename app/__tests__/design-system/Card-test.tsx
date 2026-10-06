import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Card} from "../../design-system/Card";

describe("design-system/Card", () => {
    it("renders its children inside a styled container", () => {
        const {getByText} = render(<Card>content</Card>);
        expect(getByText("content")).toBeTruthy();
    });

    it("passes through className, style, and event handlers", () => {
        const onKeyDown = jest.fn();
        const {container} = render(
            <Card
                className="custom-card"
                style={{borderRadius: "10px"}}
                onKeyDown={onKeyDown}
            >
                content
            </Card>
        );
        const card = container.firstChild as HTMLElement;
        expect(card.className).toContain("custom-card");
        expect(card.style.borderRadius).toBe("10px");
        fireEvent.keyDown(card, {key: "Enter"});
        expect(onKeyDown).toHaveBeenCalled();
    });

    it("forwards a ref to the rendered element", () => {
        const ref = React.createRef<HTMLDivElement>();
        render(<Card ref={ref}>content</Card>);
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
});
