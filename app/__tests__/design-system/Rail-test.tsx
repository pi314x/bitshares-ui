import * as React from "react";
import {render} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {Rail} from "../../design-system/Rail";

const groups = [
    {
        label: "Account",
        items: [
            {label: "Dashboard", to: "/", exact: true},
            {label: "Accounts", to: "/accounts"}
        ]
    },
    {
        label: "Markets",
        items: [{label: "Trade", to: "/market/BTS_CNY"}]
    }
];

describe("design-system/Rail", () => {
    it("renders every nav item across all groups", () => {
        const {getByText} = render(
            <MemoryRouter initialEntries={["/"]}>
                <Rail groups={groups} />
            </MemoryRouter>
        );
        expect(getByText("Dashboard")).toBeTruthy();
        expect(getByText("Accounts")).toBeTruthy();
        expect(getByText("Trade")).toBeTruthy();
    });

    it("marks the item matching the current route as active", () => {
        const {getByText} = render(
            <MemoryRouter initialEntries={["/accounts"]}>
                <Rail groups={groups} />
            </MemoryRouter>
        );
        expect(getByText("Accounts").className).toContain("navItemActive");
        expect(getByText("Dashboard").className).not.toContain(
            "navItemActive"
        );
    });

    it("links to real react-router paths, not a fake in-page toggle", () => {
        const {getByText} = render(
            <MemoryRouter initialEntries={["/"]}>
                <Rail groups={groups} />
            </MemoryRouter>
        );
        expect(getByText("Trade").getAttribute("href")).toBe(
            "/market/BTS_CNY"
        );
    });
});
