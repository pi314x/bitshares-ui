import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Switch} from "../../design-system/Switch";

describe("design-system/Switch", () => {
    it("reflects the checked prop via aria-checked", () => {
        const {getByRole, rerender} = render(
            <Switch checked={false} onChange={() => {}} />
        );
        expect(getByRole("switch").getAttribute("aria-checked")).toBe(
            "false"
        );

        rerender(<Switch checked={true} onChange={() => {}} />);
        expect(getByRole("switch").getAttribute("aria-checked")).toBe(
            "true"
        );
    });

    it("calls onChange with the toggled value on click", () => {
        const onChange = jest.fn();
        const {getByRole} = render(
            <Switch checked={false} onChange={onChange} />
        );
        fireEvent.click(getByRole("switch"));
        expect(onChange).toHaveBeenCalledWith(
            true,
            expect.anything()
        );
    });

    it("shows checkedChildren/unCheckedChildren depending on state", () => {
        const {getByText, queryByText, rerender} = render(
            <Switch
                checked={true}
                onChange={() => {}}
                checkedChildren="Yes"
                unCheckedChildren="No"
            />
        );
        expect(getByText("Yes")).toBeTruthy();
        expect(queryByText("No")).toBeNull();

        rerender(
            <Switch
                checked={false}
                onChange={() => {}}
                checkedChildren="Yes"
                unCheckedChildren="No"
            />
        );
        expect(getByText("No")).toBeTruthy();
        expect(queryByText("Yes")).toBeNull();
    });

    it("passes through className and style", () => {
        const {getByRole} = render(
            <Switch
                checked={false}
                onChange={() => {}}
                className="custom-switch"
                style={{marginLeft: 6}}
            />
        );
        const el = getByRole("switch") as HTMLElement;
        expect(el.className).toContain("custom-switch");
        expect(el.style.marginLeft).toBe("6px");
    });
});
