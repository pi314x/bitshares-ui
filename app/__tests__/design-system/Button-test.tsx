import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Button} from "../../design-system/Button";

describe("design-system/Button", () => {
    it("renders its children as button text", () => {
        const {getByText} = render(<Button>Review and sign</Button>);
        expect(getByText("Review and sign")).toBeTruthy();
    });

    it("calls onClick when clicked", () => {
        const onClick = jest.fn();
        const {getByText} = render(<Button onClick={onClick}>Click me</Button>);
        fireEvent.click(getByText("Click me"));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("does not fire onClick when disabled", () => {
        const onClick = jest.fn();
        const {getByText} = render(
            <Button onClick={onClick} disabled>
                Disabled
            </Button>
        );
        fireEvent.click(getByText("Disabled"));
        expect(onClick).not.toHaveBeenCalled();
    });

    it("renders a leading icon before its children when icon is set", () => {
        const {container, getByText} = render(
            <Button icon="download">Download</Button>
        );
        expect(getByText("Download")).toBeTruthy();
        expect(container.querySelector("svg")).toBeTruthy();
    });

    it("renders no icon when icon is omitted", () => {
        const {container} = render(<Button>Plain</Button>);
        expect(container.querySelector("svg")).toBeNull();
    });

    it("applies a different class when size is small than the default", () => {
        const {getByText: getDefault} = render(<Button>Default</Button>);
        const {getByText: getSmall} = render(
            <Button size="small">Small</Button>
        );
        expect(getSmall("Small").className).not.toBe(
            getDefault("Default").className
        );
    });

    it("applies the accent variant class alongside a custom className", () => {
        const {getByText} = render(
            <Button variant="accent" className="extra">
                Sign
            </Button>
        );
        const button = getByText("Sign");
        expect(button.className).toContain("extra");
    });
});
