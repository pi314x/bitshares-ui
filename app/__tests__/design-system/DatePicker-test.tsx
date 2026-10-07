import * as React from "react";
import moment from "moment";
import {render, fireEvent} from "@testing-library/react";
import {DatePicker} from "../../design-system/DatePicker";

describe("design-system/DatePicker", () => {
    it("renders a date-only input by default", () => {
        const {container} = render(<DatePicker onChange={() => {}} />);
        const input = container.querySelector("input") as HTMLInputElement;
        expect(input.type).toBe("date");
    });

    it("renders a datetime-local input when showTime is set", () => {
        const {container} = render(
            <DatePicker showTime onChange={() => {}} />
        );
        const input = container.querySelector("input") as HTMLInputElement;
        expect(input.type).toBe("datetime-local");
    });

    it("formats the moment value into the native input's value", () => {
        const value = moment("2024-03-15T10:30:00");
        const {container} = render(
            <DatePicker showTime value={value} onChange={() => {}} />
        );
        const input = container.querySelector("input") as HTMLInputElement;
        expect(input.value).toBe("2024-03-15T10:30");
    });

    it("calls onChange (and onOk) with a parsed moment on native change", () => {
        const onChange = jest.fn();
        const onOk = jest.fn();
        const {container} = render(
            <DatePicker showTime onChange={onChange} onOk={onOk} />
        );
        const input = container.querySelector("input") as HTMLInputElement;
        fireEvent.change(input, {target: {value: "2024-06-01T12:00"}});
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onOk).toHaveBeenCalledTimes(1);
        const called = onChange.mock.calls[0][0];
        expect(moment.isMoment(called)).toBe(true);
        expect(called.format("YYYY-MM-DDTHH:mm")).toBe("2024-06-01T12:00");
    });

    it("calls onChange with null when cleared", () => {
        const onChange = jest.fn();
        const {container} = render(
            <DatePicker
                showTime
                value={moment("2024-01-01T00:00:00")}
                onChange={onChange}
            />
        );
        const input = container.querySelector("input") as HTMLInputElement;
        fireEvent.change(input, {target: {value: ""}});
        expect(onChange).toHaveBeenCalledWith(null);
    });

    it("rejects a change that disabledDate disallows", () => {
        const onChange = jest.fn();
        const {container} = render(
            <DatePicker
                showTime
                onChange={onChange}
                disabledDate={current =>
                    current.isBefore(moment("2024-01-01"))
                }
            />
        );
        const input = container.querySelector("input") as HTMLInputElement;
        fireEvent.change(input, {target: {value: "2023-06-01T12:00"}});
        expect(onChange).not.toHaveBeenCalled();
    });

    it("disables the input when disabled is set", () => {
        const {container} = render(
            <DatePicker onChange={() => {}} disabled />
        );
        const input = container.querySelector("input") as HTMLInputElement;
        expect(input.disabled).toBe(true);
    });
});
