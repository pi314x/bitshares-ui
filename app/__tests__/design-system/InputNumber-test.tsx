import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {InputNumber} from "../../design-system/InputNumber";

describe("design-system/InputNumber", () => {
    it("renders its numeric value", () => {
        const {getByDisplayValue} = render(<InputNumber value={42} />);
        expect(getByDisplayValue("42")).toBeTruthy();
    });

    it("renders an empty field when value is false", () => {
        const {getByPlaceholderText} = render(
            <InputNumber value={false} placeholder="Height" />
        );
        expect((getByPlaceholderText("Height") as HTMLInputElement).value).toBe(
            ""
        );
    });

    it("calls onChange with a parsed number when typed into directly", () => {
        const onChange = jest.fn();
        const {getByDisplayValue} = render(
            <InputNumber value={10} onChange={onChange} />
        );
        fireEvent.change(getByDisplayValue("10"), {
            target: {value: "25"}
        });
        expect(onChange).toHaveBeenCalledWith(25);
    });

    it("increments and decrements by 1 via the stepper buttons", () => {
        const onChange = jest.fn();
        const {getByLabelText} = render(
            <InputNumber value={5} onChange={onChange} />
        );
        fireEvent.click(getByLabelText("Increase"));
        expect(onChange).toHaveBeenLastCalledWith(6);

        fireEvent.click(getByLabelText("Decrease"));
        expect(onChange).toHaveBeenLastCalledWith(4);
    });

    it("disables the input and steppers when disabled is set", () => {
        const {getByLabelText, getByRole} = render(
            <InputNumber value={1} disabled />
        );
        expect((getByRole("spinbutton") as HTMLInputElement).disabled).toBe(
            true
        );
        expect(
            (getByLabelText("Increase") as HTMLButtonElement).disabled
        ).toBe(true);
    });
});
