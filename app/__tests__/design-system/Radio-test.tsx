import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Radio} from "../../design-system/Radio";

describe("design-system/Radio", () => {
    it("checks the option matching Radio.Group's value", () => {
        const {getByLabelText} = render(
            <Radio.Group value={1}>
                <Radio value={0}>Zero</Radio>
                <Radio value={1}>One</Radio>
            </Radio.Group>
        );
        expect((getByLabelText("Zero") as HTMLInputElement).checked).toBe(
            false
        );
        expect((getByLabelText("One") as HTMLInputElement).checked).toBe(
            true
        );
    });

    it("calls Radio.Group's onChange with the original (non-stringified) value", () => {
        const onChange = jest.fn();
        const {getByLabelText} = render(
            <Radio.Group value={0} onChange={onChange}>
                <Radio value={0}>Zero</Radio>
                <Radio value={1}>One</Radio>
            </Radio.Group>
        );
        fireEvent.click(getByLabelText("One"));
        expect(onChange).toHaveBeenCalledWith({
            target: {value: 1, checked: true}
        });
    });

    it("switches the checked option within an uncontrolled Radio.Group", () => {
        const {getByLabelText} = render(
            <Radio.Group defaultValue="a">
                <Radio value="a">A</Radio>
                <Radio value="b">B</Radio>
            </Radio.Group>
        );
        fireEvent.click(getByLabelText("B"));
        expect((getByLabelText("B") as HTMLInputElement).checked).toBe(true);
        expect((getByLabelText("A") as HTMLInputElement).checked).toBe(
            false
        );
    });

    it("supports a standalone Radio outside any Group, controlled via checked/onChange", () => {
        const onChange = jest.fn();
        const {container} = render(
            <Radio value="asset-1" checked={false} onChange={onChange} />
        );
        const input = container.querySelector("input") as HTMLInputElement;
        expect(input.checked).toBe(false);
        fireEvent.click(input);
        expect(onChange).toHaveBeenCalledWith({
            target: {value: "asset-1", checked: true}
        });
    });

    it("disables every Radio in a disabled Group, but a Radio's own disabled wins", () => {
        const {getByLabelText} = render(
            <Radio.Group value="a" disabled>
                <Radio value="a">A</Radio>
                <Radio value="b" disabled={false}>
                    B
                </Radio>
            </Radio.Group>
        );
        expect((getByLabelText("A") as HTMLInputElement).disabled).toBe(
            true
        );
        expect((getByLabelText("B") as HTMLInputElement).disabled).toBe(
            false
        );
    });
});
