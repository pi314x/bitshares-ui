import * as React from "react";
import {render, act} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";
import {LoadingScreen, stageFromStatus} from "../../components/LoadingScreen";
import {
    reportLocalStep,
    resetLocalSteps
} from "../../lib/common/startupProgress";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

describe("stageFromStatus", () => {
    it("reads the stage from the routerTransition status text", () => {
        expect(stageFromStatus("")).toBe("latency");
        expect(stageFromStatus("Running latency checks (3/10 nodes)")).toBe(
            "latency"
        );
        expect(
            stageFromStatus("Connecting to API server: wss://node.xbts.io/ws")
        ).toBe("connect");
        expect(
            stageFromStatus(
                "Connection established, initializing local databases"
            )
        ).toBe("database");
    });
});

describe("LoadingScreen, what is read from this device", () => {
    beforeEach(() => resetLocalSteps());

    it("has the steps of the device in the same list, after the connection's, all waiting at first", () => {
        const {container} = render(<LoadingScreen />);
        const items = Array.from(container.querySelectorAll("ol li"));
        // checking nodes, connecting, then the local database, settings, keys,
        // the wallet and the accounts: one sequence
        expect(items.length).toBe(7);
        expect(container.querySelectorAll("section").length).toBe(0);
        expect(items[0].getAttribute("aria-current")).toBe("step");
        expect(items[6].getAttribute("data-state")).toBe("pending");
    });

    it("lists what is read from the device, and a line keeps its words when it is checked", () => {
        const {container} = render(<LoadingScreen />);
        const lines = () =>
            Array.from(container.querySelectorAll("ol li")).map(
                li => li.textContent || ""
            );
        const before = lines();
        act(() => {
            reportLocalStep("database", "done");
            reportLocalStep("settings", "done");
            reportLocalStep("keys", "active");
            reportLocalStep("wallet", "active");
        });
        const text = container.textContent || "";
        expect(text).toContain("Opening the local database");
        expect(text).toContain("Reading your settings");
        expect(text).toContain("Reading the keys stored in this browser");
        expect(text).toContain("Looking for a local wallet");
        expect(text).toContain("Reading your accounts");
        act(() => {
            reportLocalStep("keys", "done", {count: 3});
            reportLocalStep("wallet", "done", {count: 1, name: "default"});
            reportLocalStep("accounts", "done", {count: 2, name: "johnr"});
        });
        // the same words in every row: only the mark changed
        expect(lines()).toEqual(before.map((line, i) => lines()[i]));
        expect(lines().slice(2)).toEqual([
            "Opening the local database",
            "Reading your settings",
            "Reading the keys stored in this browser",
            "Looking for a local wallet",
            "Reading your accounts"
        ]);
        expect(
            container.querySelectorAll('ol li[data-state="done"]').length
        ).toBeGreaterThanOrEqual(5);
    });

    it("says the same whatever was found: nothing, a password sign-in or a wallet", () => {
        const {container} = render(<LoadingScreen />);
        const lines = () =>
            Array.from(container.querySelectorAll("ol li")).map(
                li => li.textContent || ""
            );
        act(() => {
            reportLocalStep("database", "done");
            reportLocalStep("keys", "none", {count: 0});
            reportLocalStep("wallet", "none");
            reportLocalStep("accounts", "none", {count: 0});
        });
        const none = lines();
        act(() => {
            reportLocalStep("wallet", "none", {password: true});
        });
        expect(lines()).toEqual(none);
        expect(container.textContent).not.toContain("No keys stored");
        expect(container.textContent).not.toContain("no local wallet");
    });

    it("has no current step once everything is read", () => {
        const {container} = render(
            <LoadingScreen status="Connection established, initializing local databases" />
        );
        act(() => {
            reportLocalStep("database", "done");
            reportLocalStep("settings", "done");
            reportLocalStep("keys", "none", {count: 0});
            reportLocalStep("wallet", "none");
            reportLocalStep("accounts", "none", {count: 0});
        });
        expect(container.querySelector('[aria-current="step"]')).toBeNull();
        expect(
            container.querySelectorAll('ol li[data-state="done"]').length
        ).toBe(7);
    });

    it("reads the device in the order it happens: the database, the settings, the keys, the wallet, the accounts", () => {
        const {container} = render(<LoadingScreen />);
        const text = Array.from(container.querySelectorAll("ol li")).map(
            li => li.textContent || ""
        );
        const at = (needle: RegExp) => text.findIndex(t => needle.test(t));
        expect(at(/database/i)).toBeLessThan(at(/settings/i));
        expect(at(/settings/i)).toBeLessThan(at(/keys/i));
        expect(at(/keys/i)).toBeLessThan(at(/wallet/i));
        expect(at(/wallet/i)).toBeLessThan(at(/accounts/i));
    });

    it("marks a step that could not be read", () => {
        const {container} = render(<LoadingScreen />);
        act(() => {
            reportLocalStep("database", "done");
            reportLocalStep("wallet", "failed");
        });
        expect(container.textContent).toContain(
            "The local wallet could not be read"
        );
        expect(
            container.querySelector('li[data-state="failed"]')
        ).not.toBeNull();
    });
});

describe("LoadingScreen", () => {
    beforeEach(() => resetLocalSteps());

    it("shows the steps with the current one marked, the status and the node", () => {
        const {container, getByText} = render(
            <LoadingScreen
                status="Connecting to API server: wss://node.xbts.io/ws"
                server="wss://node.xbts.io/ws"
            />
        );
        const items = container.querySelectorAll("ol li");
        expect(items.length).toBe(7);
        expect(items[1].getAttribute("aria-current")).toBe("step");
        expect(getByText(/Connecting to API server/)).toBeTruthy();
        expect(container.textContent).toContain("wss://node.xbts.io/ws");
    });

    it("follows the legacy theme for the tokens", () => {
        render(<LoadingScreen theme="lightTheme" />);
        expect(document.documentElement.getAttribute("data-theme")).toBe(
            "light"
        );
        render(<LoadingScreen theme="darkTheme" />);
        expect(document.documentElement.getAttribute("data-theme")).toBe(
            "dark"
        );
    });
});
