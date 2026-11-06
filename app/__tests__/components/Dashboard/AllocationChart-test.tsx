import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import AllocationChart from "../../../components/Dashboard/Desk/AllocationChart";

const props = (parts: any[]) => ({
    parts,
    otherLabel: (count: number) => `Other (${count})`,
    totalText: "1,000.00",
    unitSymbol: "UNIT",
    format: (value: number) => value.toFixed(2),
    percent: (share: number) => `${(share * 100).toFixed(1)}%`,
    emptyText: "Nothing with a price yet",
    ariaLabel: "Allocation"
});

describe("AllocationChart", () => {
    it("shows a slice and a legend row for each part, with its share", () => {
        const {container, getByText} = render(
            <AllocationChart
                {...props([
                    {key: "a", label: "BTS", value: 750},
                    {key: "b", label: "USD", value: 250}
                ])}
            />
        );
        expect(container.querySelectorAll("path")).toHaveLength(2);
        expect(getByText("BTS")).toBeTruthy();
        expect(getByText("75.0%")).toBeTruthy();
        expect(getByText("25.0%")).toBeTruthy();
        // the total in the middle until a slice is pointed at
        expect(container.querySelector("svg")!.textContent).toContain(
            "1,000.00"
        );
    });

    it("says the share and the name in the middle for the slice pointed at", () => {
        const {container, getByText} = render(
            <AllocationChart
                {...props([
                    {key: "a", label: "BTS", value: 750},
                    {key: "b", label: "USD", value: 250}
                ])}
            />
        );
        const row = getByText("USD").closest("li")!;
        fireEvent.mouseEnter(row);
        const text = container.querySelector("svg")!.textContent || "";
        expect(text).toContain("25.0%");
        expect(text).toContain("USD");
        fireEvent.mouseLeave(row);
        expect(container.querySelector("svg")!.textContent).toContain(
            "1,000.00"
        );
    });

    it("folds the small ones into 'Other' with a count", () => {
        const many = Array.from({length: 9}, (_, i) => ({
            key: `k${i}`,
            label: `A${i}`,
            value: 100 - i * 10
        }));
        const {getByText} = render(<AllocationChart {...props(many)} />);
        expect(getByText("Other (3)")).toBeTruthy();
    });

    it("says so when nothing has a price", () => {
        const {getByText, container} = render(
            <AllocationChart
                {...props([{key: "a", label: "X", value: null}])}
            />
        );
        expect(getByText("Nothing with a price yet")).toBeTruthy();
        expect(container.querySelector("svg")).toBeNull();
    });
});
