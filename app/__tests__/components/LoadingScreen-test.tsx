import * as React from "react";
import {render} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";
import {LoadingScreen, stageFromStatus} from "../../components/LoadingScreen";

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

describe("LoadingScreen", () => {
    it("shows the steps with the current one marked, the status and the node", () => {
        const {container, getByText} = render(
            <LoadingScreen
                status="Connecting to API server: wss://node.xbts.io/ws"
                server="wss://node.xbts.io/ws"
            />
        );
        const items = container.querySelectorAll("li");
        expect(items.length).toBe(3);
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
