import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Input} from "../../design-system/Input";

describe("design-system/Input", () => {
    it("renders a native input and forwards value/onChange", () => {
        const onChange = jest.fn();
        const {getByDisplayValue} = render(
            <Input value="hello" onChange={onChange} placeholder="Name" />
        );
        const input = getByDisplayValue("hello");
        fireEvent.change(input, {target: {value: "hello!"}});
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("calls onPressEnter only on Enter, and still calls onKeyDown for every key", () => {
        const onPressEnter = jest.fn();
        const onKeyDown = jest.fn();
        const {getByTestId} = render(
            <Input
                data-testid="in"
                onPressEnter={onPressEnter}
                onKeyDown={onKeyDown}
            />
        );
        const input = getByTestId("in");
        fireEvent.keyDown(input, {key: "a"});
        expect(onPressEnter).not.toHaveBeenCalled();
        expect(onKeyDown).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(input, {key: "Enter"});
        expect(onPressEnter).toHaveBeenCalledTimes(1);
        expect(onKeyDown).toHaveBeenCalledTimes(2);
    });

    it("renders addonAfter and suffix alongside the input", () => {
        const {getByText} = render(
            <Input addonAfter={<span>.bts</span>} suffix={<span>★</span>} />
        );
        expect(getByText(".bts")).toBeTruthy();
        expect(getByText("★")).toBeTruthy();
    });

    it("Input.TextArea renders a native textarea", () => {
        const onChange = jest.fn();
        const {getByDisplayValue} = render(
            <Input.TextArea value="note text" onChange={onChange} rows={3} />
        );
        const textarea = getByDisplayValue("note text");
        expect(textarea.tagName).toBe("TEXTAREA");
    });

    it("Input.Group renders its children", () => {
        const {getByText} = render(
            <Input.Group compact>
                <Input value="25" onChange={() => {}} />
                <span>BTS</span>
            </Input.Group>
        );
        expect(getByText("BTS")).toBeTruthy();
    });
});
