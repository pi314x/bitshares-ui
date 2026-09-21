import * as React from "react";
import {render} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import NextShell from "../../next/NextShell";

const navGroups = [
    {label: "Account", items: [{label: "Dashboard", to: "/", exact: true}]}
];

describe("next/NextShell", () => {
    it("composes Rail + Topbar from the props it's given, not its own data fetching", () => {
        const {getByText} = render(
            <MemoryRouter initialEntries={["/"]}>
                <NextShell
                    navGroups={navGroups}
                    connectionStatus="open"
                    accountName="init0"
                />
            </MemoryRouter>
        );
        expect(getByText("Dashboard")).toBeTruthy();
        expect(getByText("Connected")).toBeTruthy();
        expect(getByText("init0")).toBeTruthy();
    });

    it("renders without an account name (logged-out preview)", () => {
        const {queryByText} = render(
            <MemoryRouter initialEntries={["/"]}>
                <NextShell
                    navGroups={navGroups}
                    connectionStatus={null}
                    accountName={null}
                />
            </MemoryRouter>
        );
        expect(queryByText("Connecting…")).toBeTruthy();
    });
});
