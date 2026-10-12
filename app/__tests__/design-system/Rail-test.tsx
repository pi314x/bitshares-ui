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
        expect(getByText("Dashboard").className).not.toContain("navItemActive");
    });

    it("links to real react-router paths, not a fake in-page toggle", () => {
        const {getByText} = render(
            <MemoryRouter initialEntries={["/"]}>
                <Rail groups={groups} />
            </MemoryRouter>
        );
        expect(getByText("Trade").getAttribute("href")).toBe("/market/BTS_CNY");
    });

    it("renders the real BitShares logo, not a placeholder letter", () => {
        const {getByAltText, queryByText} = render(
            <MemoryRouter initialEntries={["/"]}>
                <Rail groups={groups} />
            </MemoryRouter>
        );
        expect(getByAltText("BitShares").tagName).toBe("IMG");
        expect(queryByText("B")).toBeNull();
    });

    it("can mark an entry active by pattern when its target redirects", () => {
        const withMatch = [
            {
                label: "Account",
                items: [
                    {label: "Accounts", to: "/accounts"},
                    {
                        label: "Voting",
                        to: "/voting",
                        match: /^\/(voting|account\/[^/]+\/voting)(\/|$)/
                    }
                ]
            }
        ];
        const {getByText} = render(
            <MemoryRouter initialEntries={["/account/abit/voting/witnesses"]}>
                <Rail groups={withMatch} />
            </MemoryRouter>
        );
        expect(getByText("Voting").className).toContain("navItemActive");
        expect(getByText("Accounts").className).not.toContain("navItemActive");
    });

    it("does not mark a pattern entry active elsewhere", () => {
        const withMatch = [
            {
                label: "Account",
                items: [
                    {
                        label: "Voting",
                        to: "/voting",
                        match: /^\/(voting|account\/[^/]+\/voting)(\/|$)/
                    }
                ]
            }
        ];
        const {getByText} = render(
            <MemoryRouter initialEntries={["/account/abit/overview"]}>
                <Rail groups={withMatch} />
            </MemoryRouter>
        );
        expect(getByText("Voting").className).not.toContain("navItemActive");
    });
});
