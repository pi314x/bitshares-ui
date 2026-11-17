import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";
import {DateTimeInput} from "../../design-system/DateTimeInput";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

const parts = (container: HTMLElement) => {
    const [hour, minute] = Array.from(
        container.querySelectorAll("select")
    ) as HTMLSelectElement[];
    return {
        date: container.querySelector("input") as HTMLInputElement,
        hour,
        minute
    };
};

describe("design-system/DateTimeInput", () => {
    it("shows the time on a 24-hour clock: hours 00-23, no AM/PM", () => {
        const {container} = render(
            <DateTimeInput value="2026-11-17T21:36" onChange={() => {}} />
        );
        const {date, hour, minute} = parts(container);
        expect(date.value).toBe("2026-11-17");
        expect(hour.value).toBe("21");
        expect(minute.value).toBe("36");
        expect(Array.from(hour.options).map(o => o.value)).toEqual(
            Array.from({length: 24}, (_, i) => String(i).padStart(2, "0"))
        );
        expect(minute.options).toHaveLength(60);
        expect(container.textContent).not.toMatch(/AM|PM/i);
        expect(
            container.querySelector('input[type="datetime-local"]')
        ).toBeNull();
    });

    it("names the three parts for a screen reader, and the group by the caller's label", () => {
        const {container, getByRole, getByLabelText} = render(
            <DateTimeInput value="" aria-label="Release" onChange={() => {}} />
        );
        expect(getByRole("group").getAttribute("aria-label")).toBe("Release");
        expect(getByLabelText("Date")).toBeTruthy();
        expect(getByLabelText("Hour (00-23)")).toBeTruthy();
        expect(getByLabelText("Minute")).toBeTruthy();
        expect(container.querySelectorAll("select")).toHaveLength(2);
    });

    it("changes one part and keeps the others", () => {
        const onChange = jest.fn();
        const {container} = render(
            <DateTimeInput value="2026-11-17T09:30" onChange={onChange} />
        );
        const {date, hour, minute} = parts(container);
        fireEvent.change(hour, {target: {value: "23"}});
        expect(onChange).toHaveBeenLastCalledWith("2026-11-17T23:30");
        fireEvent.change(minute, {target: {value: "05"}});
        expect(onChange).toHaveBeenLastCalledWith("2026-11-17T09:05");
        fireEvent.change(date, {target: {value: "2026-12-01"}});
        expect(onChange).toHaveBeenLastCalledWith("2026-12-01T09:30");
    });

    it("gives no value until there is a date, and a date picked after a time takes that time", () => {
        const Harness = () => {
            const [value, setValue] = React.useState("");
            return (
                <>
                    <DateTimeInput value={value} onChange={setValue} />
                    <output>{value}</output>
                </>
            );
        };
        const {container} = render(<Harness />);
        const out = () => container.querySelector("output")!.textContent;
        const {date, hour} = parts(container);
        fireEvent.change(hour, {target: {value: "18"}});
        expect(out()).toBe("");
        expect(parts(container).hour.value).toBe("18");
        fireEvent.change(date, {target: {value: "2026-11-17"}});
        expect(out()).toBe("2026-11-17T18:00");
        fireEvent.change(date, {target: {value: ""}});
        expect(out()).toBe("");
    });

    it("is disabled as a whole, and the ref is the date input", () => {
        const ref = React.createRef<HTMLInputElement>();
        const {container} = render(
            <DateTimeInput ref={ref} value="" disabled onChange={() => {}} />
        );
        const {date, hour, minute} = parts(container);
        expect([date.disabled, hour.disabled, minute.disabled]).toEqual([
            true,
            true,
            true
        ]);
        expect(ref.current).toBe(date);
    });
});
