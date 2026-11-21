import * as React from "react";
import * as fs from "fs";
import * as path from "path";
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

describe("next/NextShell: the rail is as tall as the window below the shell's top", () => {
    // jsdom has no layout: the top of the shell is what the test says it is. The banner above the shell is 60px
    // until the page has scrolled past it; the rail is as tall as the window less that, or its last row (language
    // and theme) lay 60px below the window's bottom edge.
    let top = 60;
    let frames: Array<() => void> = [];
    const flush = () => {
        const run = frames;
        frames = [];
        run.forEach(frame => frame());
    };
    let rect: jest.SpyInstance;
    let raf: jest.SpyInstance;
    // (jsdom's style object does not keep custom properties: what is written to it is recorded)
    let written: Array<[string, string]> = [];
    let setProperty: jest.SpyInstance;
    const lastShellTop = () => {
        const mine = written.filter(([name]) => name === "--shell-top");
        return mine.length ? mine[mine.length - 1][1] : null;
    };
    beforeEach(() => {
        top = 60;
        frames = [];
        written = [];
        setProperty = jest
            .spyOn(CSSStyleDeclaration.prototype, "setProperty")
            .mockImplementation((name: string, value: string | null) => {
                written.push([name, String(value)]);
            });
        rect = jest
            .spyOn(HTMLElement.prototype, "getBoundingClientRect")
            .mockImplementation(function(this: HTMLElement) {
                const t = String(this.className).includes("shell") ? top : 0;
                return {
                    top: t,
                    bottom: t,
                    left: 0,
                    right: 0,
                    width: 0,
                    height: 0
                } as any;
            });
        raf = jest
            .spyOn(window, "requestAnimationFrame")
            .mockImplementation((cb: FrameRequestCallback) => {
                frames.push(() => cb(0));
                return frames.length;
            });
    });
    afterEach(() => {
        rect.mockRestore();
        raf.mockRestore();
        setProperty.mockRestore();
    });

    it("writes where the shell starts, and the rail's height is the window's less that", () => {
        renderShell();
        expect(lastShellTop()).toBe("60px");
        // (the rule itself is in Rail.module.scss: 100dvh less the variable, which is 0 where it is not set)
        const rule = fs.readFileSync(
            path.join(__dirname, "../../design-system/Rail.module.scss"),
            "utf8"
        );
        expect(rule).toMatch(
            /height: calc\(100dvh - var\(--shell-top, 0px\)\)/
        );
    });

    it("follows the scroll: 0 once the page has scrolled past the banner, never negative", () => {
        renderShell();
        top = 25;
        fireEvent.scroll(window);
        flush();
        expect(lastShellTop()).toBe("25px");
        top = -300;
        fireEvent.scroll(window);
        flush();
        expect(lastShellTop()).toBe("0px");
    });

    it("follows a resize of the window, and stops listening when the shell goes", () => {
        const {unmount} = renderShell();
        top = 0;
        fireEvent(window, new Event("resize"));
        flush();
        expect(lastShellTop()).toBe("0px");
        unmount();
        top = 80;
        fireEvent.scroll(window);
        expect(frames).toHaveLength(0);
    });
});

describe("next/NextShell", () => {
    it("composes Rail + Topbar from the props it's given, not its own data fetching", () => {
        const {getByText} = renderShell();
        expect(getByText("Dashboard")).toBeTruthy();
        expect(getByText("Connected")).toBeTruthy();
        expect(getByText("init0")).toBeTruthy();
    });

    it("puts the connection and the head block in one chip at the end that opens the nodes page", () => {
        const {getByText, getByRole, queryByText} = renderShell({
            statusDock: <span>#115,209,838 3s</span>
        });
        const chip = getByRole("link", {name: /Nodes: connected/});
        expect(chip.getAttribute("href")).toBe("/settings/access");
        // the state and the block are in that one chip
        expect(chip.textContent).toContain("Connected");
        expect(chip.textContent).toContain("#115,209,838");
        // it is the last row of the shell, after the content
        const content = getByText("screen content");
        expect(
            content.compareDocumentPosition(chip) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        // and the top bar no longer carries a connection chip
        expect(queryByText("node selector")).toBeNull();
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
