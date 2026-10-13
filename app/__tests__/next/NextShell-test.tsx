import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import NextShell from "../../next/NextShell";

const navGroups = [
    {label: "Account", items: [{label: "Dashboard", to: "/", exact: true}]}
];

function renderShell(
    overrides: Partial<React.ComponentProps<typeof NextShell>> = {}
) {
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

    describe("navigation drawer (phone width)", () => {
        it("opens from the menu button and says so to assistive technology", () => {
            const {getByLabelText, getByRole} = renderShell();
            const button = getByLabelText("Menu");
            expect(button.getAttribute("aria-expanded")).toBe("false");
            expect(button.getAttribute("aria-controls")).toBe("main-nav");
            fireEvent.click(button);
            expect(button.getAttribute("aria-expanded")).toBe("true");
            expect(getByRole("navigation", {hidden: true}).className).toContain(
                "railOpen"
            );
        });

        it("shows a backdrop while open, and tapping it closes the drawer", () => {
            const {getByLabelText, getByTestId, queryByTestId} = renderShell();
            expect(queryByTestId("nav-scrim")).toBeNull();
            fireEvent.click(getByLabelText("Menu"));
            fireEvent.click(getByTestId("nav-scrim"));
            expect(queryByTestId("nav-scrim")).toBeNull();
            expect(getByLabelText("Menu").getAttribute("aria-expanded")).toBe(
                "false"
            );
        });

        it("closes on Escape and on the close button", () => {
            const {getByLabelText, queryByTestId} = renderShell();
            fireEvent.click(getByLabelText("Menu"));
            fireEvent.keyDown(document, {key: "Escape"});
            expect(queryByTestId("nav-scrim")).toBeNull();
            fireEvent.click(getByLabelText("Menu"));
            fireEvent.click(getByLabelText("Close menu"));
            expect(queryByTestId("nav-scrim")).toBeNull();
        });

        it("closes after a link is followed", () => {
            const {getByLabelText, getByText, queryByTestId} = renderShell();
            fireEvent.click(getByLabelText("Menu"));
            fireEvent.click(getByText("Dashboard"));
            expect(queryByTestId("nav-scrim")).toBeNull();
        });

        it("keeps the page behind it from scrolling, and gives that back", () => {
            const {getByLabelText, unmount} = renderShell();
            fireEvent.click(getByLabelText("Menu"));
            expect(document.body.style.overflow).toBe("hidden");
            fireEvent.keyDown(document, {key: "Escape"});
            expect(document.body.style.overflow).toBe("");
            fireEvent.click(getByLabelText("Menu"));
            unmount();
            expect(document.body.style.overflow).toBe("");
        });
    });
});
