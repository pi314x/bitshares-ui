import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Checkbox} from "../../design-system/Checkbox";

describe("design-system/Checkbox", () => {
    it("reflects the checked prop", () => {
        const {getByRole, rerender} = render(
            <Checkbox checked={false}>Label</Checkbox>
        );
        expect((getByRole("checkbox") as HTMLInputElement).checked).toBe(
            false
        );

        rerender(<Checkbox checked={true}>Label</Checkbox>);
        expect((getByRole("checkbox") as HTMLInputElement).checked).toBe(
            true
        );
    });

    it("calls onChange with the native event carrying target.checked", () => {
        // React's SyntheticEvent is pooled/nullified after the handler
        // returns, so `target.checked` must be read synchronously inside
        // the handler itself rather than from the mock's recorded args
        // afterwards.
        let observedChecked: boolean | undefined;
        const onChange = jest.fn(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                observedChecked = e.target.checked;
            }
        );
        const {getByRole} = render(
            <Checkbox checked={false} onChange={onChange}>
                Label
            </Checkbox>
        );
        fireEvent.click(getByRole("checkbox"));
        expect(onChange).toHaveBeenCalled();
        expect(observedChecked).toBe(true);
    });

    it("calls a plain onClick with no onChange wired up", () => {
        const onClick = jest.fn();
        const {getByRole} = render(
            <Checkbox checked={false} onClick={onClick} />
        );
        fireEvent.click(getByRole("checkbox"));
        expect(onClick).toHaveBeenCalled();
    });

    it("renders without a label when children is omitted", () => {
        const {getByRole, container} = render(<Checkbox checked={false} />);
        expect(getByRole("checkbox")).toBeTruthy();
        expect(container.querySelector("span")).toBeNull();
    });

    it("passes through disabled, id, and className", () => {
        const {getByRole} = render(
            <Checkbox
                checked={false}
                disabled
                id="my-checkbox"
                className="custom-checkbox"
            >
                Label
            </Checkbox>
        );
        const input = getByRole("checkbox") as HTMLInputElement;
        expect(input.disabled).toBe(true);
        expect(input.id).toBe("my-checkbox");
        expect(input.closest("label")?.className).toContain(
            "custom-checkbox"
        );
    });
});
