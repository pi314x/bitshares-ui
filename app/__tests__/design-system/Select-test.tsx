import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Select} from "../../design-system/Select";

describe("design-system/Select", () => {
    it("shows the placeholder closed, and opens the option list on click", () => {
        const {getByText, queryByRole} = render(
            <Select placeholder="Pick an asset">
                <Select.Option value="BTS">BTS</Select.Option>
                <Select.Option value="USD">USD</Select.Option>
            </Select>
        );
        expect(getByText("Pick an asset")).toBeTruthy();
        expect(queryByRole("listbox")).toBeNull();

        fireEvent.click(getByText("Pick an asset"));
        expect(queryByRole("listbox")).toBeTruthy();
        expect(getByText("USD")).toBeTruthy();
    });

    it("calls onChange and onSelect with the chosen value, and closes", () => {
        const onChange = jest.fn();
        const onSelect = jest.fn();
        const {getByText, queryByRole} = render(
            <Select
                placeholder="Pick an asset"
                onChange={onChange}
                onSelect={onSelect}
            >
                <Select.Option value="BTS">BTS</Select.Option>
                <Select.Option value="USD">USD</Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick an asset"));
        fireEvent.click(getByText("USD"));
        expect(onChange).toHaveBeenCalledWith("USD");
        expect(onSelect).toHaveBeenCalledWith("USD");
        expect(queryByRole("listbox")).toBeNull();
        expect(getByText("USD")).toBeTruthy();
    });

    it("does not select a disabled option", () => {
        const onChange = jest.fn();
        const {getByText} = render(
            <Select placeholder="Pick" onChange={onChange}>
                <Select.Option value="a" disabled>
                    A (disabled)
                </Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick"));
        fireEvent.click(getByText("A (disabled)"));
        expect(onChange).not.toHaveBeenCalled();
    });

    it("still fires a click on interactive content nested inside a disabled option", () => {
        const onChange = jest.fn();
        const onCheckboxClick = jest.fn();
        const {getByText, getByLabelText} = render(
            <Select placeholder="Pick" onChange={onChange}>
                <Select.Option value="a" disabled>
                    <label>
                        <input
                            type="checkbox"
                            aria-label="toggle a"
                            onClick={onCheckboxClick}
                        />
                        A
                    </label>
                </Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick"));
        fireEvent.click(getByLabelText("toggle a"));
        expect(onCheckboxClick).toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it("applies an Option's own className to its rendered row", () => {
        const {getByText} = render(
            <Select placeholder="Pick">
                <Select.Option value="a" className="my-option">
                    A
                </Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick"));
        expect(getByText("A").className).toContain("my-option");
    });

    it("applies dropdownClassName to the open dropdown panel", () => {
        const {getByText, getByRole} = render(
            <Select placeholder="Pick" dropdownClassName="my-dropdown">
                <Select.Option value="a">A</Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick"));
        expect(getByRole("listbox").className).toContain("my-dropdown");
    });

    it("filters options by typed text when showSearch is set", () => {
        const {getByText, getByDisplayValue, queryByText} = render(
            <Select placeholder="Pick" showSearch>
                <Select.Option value="BTS">BTS</Select.Option>
                <Select.Option value="USD">USD</Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick"));
        fireEvent.change(getByDisplayValue(""), {target: {value: "us"}});
        expect(getByText("USD")).toBeTruthy();
        expect(queryByText("BTS")).toBeNull();
    });

    it("shows notFoundContent when no option matches the search", () => {
        const {getByText, getByDisplayValue} = render(
            <Select placeholder="Pick" showSearch notFoundContent="No match">
                <Select.Option value="BTS">BTS</Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick"));
        fireEvent.change(getByDisplayValue(""), {
            target: {value: "zzz"}
        });
        expect(getByText("No match")).toBeTruthy();
    });

    it("calls onSearch with the raw typed text on every keystroke", () => {
        const onSearch = jest.fn();
        const {getByText, getByDisplayValue} = render(
            <Select placeholder="Pick" showSearch onSearch={onSearch}>
                <Select.Option value="BTS">BTS</Select.Option>
            </Select>
        );
        fireEvent.click(getByText("Pick"));
        fireEvent.change(getByDisplayValue(""), {target: {value: "zzz"}});
        expect(onSearch).toHaveBeenCalledWith("zzz");
    });

    it("shows the option's value, not its children, as the closed label when optionLabelProp is value", () => {
        const {getByText, queryByText} = render(
            <Select
                placeholder="Pick"
                value="rudex"
                optionLabelProp="value"
            >
                <Select.Option value="rudex">
                    RuDex <span>(balance: 5)</span>
                </Select.Option>
            </Select>
        );
        expect(getByText("rudex")).toBeTruthy();
        expect(queryByText("RuDex")).toBeNull();
    });

    it("stays controlled when value is passed, ignoring its own selection state", () => {
        const {getByText} = render(
            <Select value="BTS" onChange={() => {}}>
                <Select.Option value="BTS">BTS</Select.Option>
                <Select.Option value="USD">USD</Select.Option>
            </Select>
        );
        fireEvent.click(getByText("BTS"));
        fireEvent.click(getByText("USD"));
        // Controlled: the displayed value only changes if a new `value`
        // prop is passed in, not from the click itself.
        expect(getByText("BTS")).toBeTruthy();
    });
});
