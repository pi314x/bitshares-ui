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

    it("renders a date input with an hour and a minute select (24-hour clock) when showTime is set", () => {
        const {container} = render(<DatePicker showTime onChange={() => {}} />);
        const input = container.querySelector("input") as HTMLInputElement;
        expect(input.type).toBe("date");
        expect(
            container.querySelector('input[type="datetime-local"]')
        ).toBeNull();
        expect(container.querySelectorAll("select")).toHaveLength(2);
        expect(container.textContent).not.toMatch(/AM|PM/);
    });

    it("shows the moment's date, hour and minute in the inputs", () => {
        const value = moment("2024-03-15T18:05:00");
        const {container} = render(
            <DatePicker showTime value={value} onChange={() => {}} />
        );
        const input = container.querySelector("input") as HTMLInputElement;
        const [hour, minute] = Array.from(container.querySelectorAll("select"));
        expect(input.value).toBe("2024-03-15");
        expect(hour.value).toBe("18");
        expect(minute.value).toBe("05");
    });

    it("calls onChange (and onOk) with a parsed moment when the date is picked", () => {
        const onChange = jest.fn();
        const onOk = jest.fn();
        const {container} = render(
            <DatePicker showTime onChange={onChange} onOk={onOk} />
        );
        const input = container.querySelector("input") as HTMLInputElement;
        fireEvent.change(input, {target: {value: "2024-06-01"}});
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onOk).toHaveBeenCalledTimes(1);
        const called = onChange.mock.calls[0][0];
        expect(moment.isMoment(called)).toBe(true);
        expect(called.format("YYYY-MM-DDTHH:mm")).toBe("2024-06-01T00:00");
    });

    it("calls onChange with the hour on a 24-hour clock when the hour is picked", () => {
        const onChange = jest.fn();
        const {container} = render(
            <DatePicker
                showTime
                value={moment("2024-06-01T09:15:00")}
                onChange={onChange}
            />
        );
        const [hour] = Array.from(container.querySelectorAll("select"));
        fireEvent.change(hour, {target: {value: "21"}});
        expect(onChange.mock.calls[0][0].format("YYYY-MM-DDTHH:mm")).toBe(
            "2024-06-01T21:15"
        );
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
                disabledDate={current => current.isBefore(moment("2024-01-01"))}
            />
        );
        const input = container.querySelector("input") as HTMLInputElement;
        fireEvent.change(input, {target: {value: "2023-06-01"}});
        expect(onChange).not.toHaveBeenCalled();
    });

    it("disables the input when disabled is set", () => {
        const {container} = render(<DatePicker onChange={() => {}} disabled />);
        const input = container.querySelector("input") as HTMLInputElement;
        expect(input.disabled).toBe(true);
    });

    it("forwards its ref to the native input element", () => {
        const ref = React.createRef<HTMLInputElement>();
        const {container} = render(
            <DatePicker ref={ref} onChange={() => {}} />
        );
        expect(ref.current).toBe(container.querySelector("input"));
    });
});
