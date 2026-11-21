// The wallet extension page (More -> Wallet extension): the guide is there in words, every control name it points at is the
// one the app shows, its two links leave the app safely, and its first card says whether the extension is connected and
// connects it - sending a failed connect to Settings -> Signing, as the top bar's button does.
import * as React from "react";
import {act, fireEvent, render} from "@testing-library/react";
import counterpart from "counterpart";
import {MemoryRouter, Route, Routes} from "react-router-dom";
import localeEn from "../../assets/locales/locale-en.json";
import ExtensionGuide from "../../components/Extension/ExtensionGuide";
import ExternalSignerActions from "../../actions/ExternalSignerActions";
import {reduxStore} from "../../store/reduxStore";
import {
    initialExternalSignerState,
    patchExternalSigner
} from "../../store/slices/externalSignerSlice";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

const setStatus = (patch: any) =>
    reduxStore.dispatch(
        patchExternalSigner({...initialExternalSignerState, ...patch})
    );

beforeEach(() => setStatus({status: "disconnected"}));
afterEach(() => jest.restoreAllMocks());

const page = () =>
    render(
        <MemoryRouter initialEntries={["/extension"]}>
            <Routes>
                <Route path="/extension" element={<ExtensionGuide />} />
                <Route
                    path="/settings/signing"
                    element={<div>the signing settings</div>}
                />
            </Routes>
        </MemoryRouter>
    );

describe("Wallet extension page", () => {
    it("has the guide: what it does, what it needs, install, connect, sign, limits, safety", () => {
        const view = page();
        const text = document.body.textContent!;
        expect(view.getByText("Wallet extension")).toBeTruthy();
        [
            "What it does",
            "Before you start",
            "Install the extension",
            "Connect it to this app",
            "Sign and send",
            "What does not work with the extension",
            "Staying safe"
        ].forEach(title => expect(view.getByText(title)).toBeTruthy());
        // the facts the guide rests on
        expect(text).toContain("This app never sees a key.");
        expect(text).toContain("http://192.168.1.20:8080");
        expect(text).toContain("Claiming balances");
        expect(text).toContain("Signing without sending");
        expect(text).toContain("never share your brainkey");
    });

    it("has no text that is a missing translation or a bare key", () => {
        page();
        const text = document.body.textContent!;
        expect(text).not.toMatch(/missing translation/i);
        expect(text).not.toContain("extension_guide.");
    });

    it("names the controls as the app shows them", () => {
        // the top bar's button, Settings -> Signing and its Connect / Disconnect, the account's mark: English in every locale
        const text = (localeEn as any).extension_guide;
        const all = Object.keys(text)
            .map(key => text[key])
            .join(" ");
        expect(all).toContain("“Connect extension”");
        expect(all).toContain("Settings → Signing");
        expect(all).toContain("“Connected as <account>”");
        expect(all).toContain("“Extension”");
        expect(all).toContain("“Disconnect”");
        expect((localeEn as any).externalSigner.status_connected).toBe(
            "Connected as %(account)s."
        );
    });

    it("links to the releases and the project page in a new tab, without handing over the page", () => {
        const view = page();
        const releases = view.getByText("Releases page (download)");
        const project = view.getByText("Project page");
        expect(releases.getAttribute("href")).toBe(
            "https://github.com/pi314x/bitshares-wallet-browser-extension/releases"
        );
        expect(project.getAttribute("href")).toBe(
            "https://pi314x.github.io/bitshares-wallet-browser-extension"
        );
        [releases, project].forEach(link => {
            expect(link.getAttribute("target")).toBe("_blank");
            expect(link.getAttribute("rel")).toBe("noopener noreferrer");
        });
    });

    it("links to Settings -> Signing", () => {
        const view = page();
        fireEvent.click(view.getByText("Settings → Signing"));
        expect(view.getByText("the signing settings")).toBeTruthy();
    });
});

describe("Wallet extension page: the status card", () => {
    it("says the extension was not found, and offers no Connect", () => {
        setStatus({status: "unavailable"});
        const view = page();
        expect(view.getByTestId("extension-status").textContent).toBe(
            "The BitShares wallet extension was not found in this browser."
        );
        expect(view.queryByText("Connect extension")).toBeNull();
    });

    it("says it is being looked for while it is not known", () => {
        setStatus({status: "unknown"});
        const view = page();
        expect(view.getByTestId("extension-status").textContent).toBe(
            "Looking for the extension..."
        );
        expect(view.queryByText("Connect extension")).toBeNull();
    });

    it("offers Connect when the extension is there and not connected", () => {
        const view = page();
        expect(view.getByTestId("extension-status").textContent).toBe(
            "The extension was found but is not connected."
        );
        expect(view.getByText("Connect extension")).toBeTruthy();
    });

    it("connects on Connect, and stays on the page when it worked", async () => {
        const connect = jest
            .spyOn(ExternalSignerActions, "connect")
            .mockResolvedValue(undefined as any);
        const view = page();
        await act(async () => {
            fireEvent.click(view.getByText("Connect extension"));
        });
        expect(connect).toHaveBeenCalledTimes(1);
        expect(view.queryByText("the signing settings")).toBeNull();
    });

    it("goes to Settings -> Signing when the connection fails, where the reason is said", async () => {
        jest.spyOn(ExternalSignerActions, "connect").mockImplementation(
            async () => {
                setStatus({status: "disconnected", error: "not on HTTPS"});
            }
        );
        const view = page();
        await act(async () => {
            fireEvent.click(view.getByText("Connect extension"));
        });
        expect(view.getByText("the signing settings")).toBeTruthy();
    });

    it("does not offer Connect twice while it is connecting", () => {
        setStatus({status: "connecting"});
        const view = page();
        const button = view
            .getByText("Connect extension")
            .closest("button") as HTMLButtonElement;
        expect(button.disabled).toBe(true);
        expect(view.getByTestId("extension-status").textContent).toBe(
            "Waiting for you to approve the connection in the extension..."
        );
    });

    it("says which account it is connected as, and no Connect", () => {
        setStatus({
            status: "connected",
            account: {accountName: "alice", accountId: "1.2.7"} as any,
            locked: false
        });
        const view = page();
        expect(view.getByTestId("extension-status").textContent).toBe(
            "Connected as alice."
        );
        expect(view.queryByText("Connect extension")).toBeNull();
        expect(
            view.queryByText(
                "The extension is locked. Unlock it before signing."
            )
        ).toBeNull();
    });

    it("warns when the connected extension is locked", () => {
        setStatus({
            status: "connected",
            account: {accountName: "alice", accountId: "1.2.7"} as any,
            locked: true
        });
        const view = page();
        expect(
            view.getByText("The extension is locked. Unlock it before signing.")
        ).toBeTruthy();
    });
});
