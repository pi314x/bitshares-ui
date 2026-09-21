import * as React from "react";
import {render} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import NextShell from "../../next/NextShell";

const navGroups = [
    {label: "Account", items: [{label: "Dashboard", to: "/", exact: true}]}
];

function renderShell(overrides: Partial<React.ComponentProps<typeof NextShell>> = {}) {
    return render(
        <MemoryRouter initialEntries={["/"]}>
            <NextShell
                navGroups={navGroups}
                crumb="Test Crumb"
                railFooter={<div>rail footer</div>}
                connectionStatus="open"
                activeNode="wss://node.xbts.io/ws"
                nodeSelector={<div>node selector</div>}
                currentAccount="init0"
                accounts={["init0"]}
                onSelectAccount={() => {}}
                locked={true}
                onToggleLock={() => {}}
                currentLocale="en"
                locales={["en", "de"]}
                onSelectLocale={() => {}}
                onShowSend={() => {}}
                onShowDeposit={() => {}}
                onShowWithdraw={() => {}}
                content={<div>screen content</div>}
                {...overrides}
            />
        </MemoryRouter>
    );
}

describe("next/NextShell", () => {
    it("composes Rail + Topbar from the props it's given, not its own data fetching", () => {
        const {getByText} = renderShell();
        expect(getByText("Dashboard")).toBeTruthy();
        expect(getByText("Connected")).toBeTruthy();
        expect(getByText("init0")).toBeTruthy();
    });

    it("shows the given crumb and rail footer, not a hardcoded label", () => {
        const {getByText} = renderShell({
            crumb: "Market · BTS_CNY",
            railFooter: <div>theme toggle goes here</div>
        });
        expect(getByText("Market · BTS_CNY")).toBeTruthy();
        expect(getByText("theme toggle goes here")).toBeTruthy();
    });

    it("renders the content prop inside the shell", () => {
        const {getByText} = renderShell({
            content: <div>a real screen would go here</div>
        });
        expect(getByText("a real screen would go here")).toBeTruthy();
    });

    it("renders without an account (logged-out preview)", () => {
        const {queryByText} = renderShell({
            connectionStatus: null,
            currentAccount: null,
            accounts: []
        });
        expect(queryByText("Connecting…")).toBeTruthy();
    });

    it("defaults to uncontrolled theme when themeValue/onThemeChange are omitted", () => {
        // No themeValue/onThemeChange passed — should not throw, and should
        // fall back to the design system's own default (dark).
        renderShell();
        expect(document.documentElement.getAttribute("data-theme")).toBe(
            "dark"
        );
    });
});
