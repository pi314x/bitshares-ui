import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Slider} from "../../design-system/Slider";

describe("design-system/Slider", () => {
    it("renders the current value", () => {
        const {getByRole} = render(
            <Slider value={25} onChange={() => {}} />
        );
        expect((getByRole("slider") as HTMLInputElement).value).toBe("25");
    });

    it("calls onChange with the new numeric value", () => {
        const onChange = jest.fn();
        const {getByRole} = render(
            <Slider value={25} onChange={onChange} min={0} max={100} />
        );
        fireEvent.change(getByRole("slider"), {target: {value: "60"}});
        expect(onChange).toHaveBeenCalledWith(60);
    });

    it("respects min/max/step", () => {
        const {getByRole} = render(
            <Slider value={5} onChange={() => {}} min={0} max={10} step={0.5} />
        );
        const input = getByRole("slider") as HTMLInputElement;
        expect(input.min).toBe("0");
        expect(input.max).toBe("10");
        expect(input.step).toBe("0.5");
    });

    it("disables the input when disabled is set", () => {
        const {getByRole} = render(
            <Slider value={5} onChange={() => {}} disabled />
        );
        expect((getByRole("slider") as HTMLInputElement).disabled).toBe(true);
    });
});
