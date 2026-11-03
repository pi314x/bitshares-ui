import * as React from "react";
import {render, fireEvent, act, waitFor} from "@testing-library/react";
import counterpart from "counterpart";
import {Apis} from "bitsharesjs-ws";
import localeEn from "../../assets/locales/locale-en.json";
import ExternalSignerSettings from "../../components/Settings/ExternalSignerSettings";
import ExternalSignerActions from "../../actions/ExternalSignerActions";
import {reduxStore} from "../../store/reduxStore";
import {patchState} from "../../store/slices/accountSlice";
import {
    initialExternalSignerState,
    patchExternalSigner
} from "../../store/slices/externalSignerSlice";
import {makeFakeProvider, MAINNET} from "../utils/fakeProvider";

const win = window as any;

// jsdom 11 has no MutationObserver, which RTL's waitFor needs
beforeAll(() => {
    if (!(global as any).MutationObserver) {
        (global as any).MutationObserver = class {
            observe() {
                /* inert */
            }
            disconnect() {
                /* inert */
            }
            takeRecords() {
                return [];
            }
        };
    }
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    jest.spyOn(Apis as any, "instance").mockReturnValue({chain_id: MAINNET});
    win.bitsharesWallet = makeFakeProvider().provider;
    reduxStore.dispatch(
        patchExternalSigner({
            ...initialExternalSignerState,
            status: "disconnected"
        })
    );
    window.localStorage.clear();
});

afterEach(() => {
    jest.restoreAllMocks();
    delete win.bitsharesWallet;
});

describe("Settings -> Signing", () => {
    it("has no signing-method choice, only the connection", () => {
        const {queryByText, queryByLabelText, getByText} = render(
            <ExternalSignerSettings />
        );
        expect(queryByLabelText(/Local wallet/i)).toBeNull();
        expect(queryByLabelText(/Wallet extension/i)).toBeNull();
        expect(queryByText(/Signing method/i)).toBeNull();
        expect(getByText("Connect")).toBeTruthy();
    });

    it("connects the extension and says which account it is connected as", async () => {
        const {getByText, getByTestId} = render(<ExternalSignerSettings />);
        expect(getByTestId("signer-status").textContent).toMatch(
            /not connected/i
        );
        await act(async () => {
            fireEvent.click(getByText("Connect"));
        });
        await waitFor(() =>
            expect(getByTestId("signer-status").textContent).toBe(
                "Connected as alice."
            )
        );
        expect(getByText("Disconnect")).toBeTruthy();
        expect(ExternalSignerActions.isActive()).toBe(true);
    });

    it("says which of the two signs for the chosen account", async () => {
        const {getByText, getByTestId} = render(<ExternalSignerSettings />);
        await act(async () => {
            fireEvent.click(getByText("Connect"));
        });
        // the extension's account is the chosen one (the account sync, which
        // this component test does not start, does that after a connect)
        act(() => {
            reduxStore.dispatch(patchState({currentAccount: "alice"} as any));
        });
        await waitFor(() =>
            expect(getByTestId("signer-for").textContent).toBe(
                "Transactions for alice are signed by the wallet extension."
            )
        );
        act(() => {
            reduxStore.dispatch(
                patchState({currentAccount: "localwallet"} as any)
            );
        });
        expect(getByTestId("signer-for").textContent).toBe(
            "Transactions for localwallet are signed by the wallet stored in this browser."
        );
    });

    it("says so when the extension is not installed", async () => {
        delete win.bitsharesWallet;
        const {getByText, findByText} = render(<ExternalSignerSettings />);
        await act(async () => {
            fireEvent.click(getByText("Connect"));
        });
        expect(await findByText(/was not found in this browser/i)).toBeTruthy();
    });

    it("says what to do when Connect is pressed and there is no extension: pressing it did nothing visible before", async () => {
        delete win.bitsharesWallet;
        reduxStore.dispatch(
            patchExternalSigner({
                ...initialExternalSignerState,
                status: "unavailable"
            })
        );
        const {getByText, queryByText, findByText, getByTestId} = render(
            <ExternalSignerSettings />
        );
        // the status line says "not found" before anything is pressed, and the advice is not there yet
        expect(getByTestId("signer-status").textContent).toMatch(/not found/i);
        expect(
            queryByText(/Browser extensions are usually not available/i)
        ).toBeNull();
        await act(async () => {
            fireEvent.click(getByText("Connect"));
        });
        expect(
            await findByText(/Browser extensions are usually not available/i)
        ).toBeTruthy();
        expect(getByText("Connect")).toBeTruthy();
    });

    it("says before anything is pressed that the extension connects only to pages on HTTPS or localhost, where the page is not", () => {
        const secure = (value: boolean | undefined) =>
            Object.defineProperty(window, "isSecureContext", {
                value,
                configurable: true
            });
        try {
            secure(false);
            const insecure = render(<ExternalSignerSettings />);
            expect(
                insecure.getByText(/connects only to pages opened over HTTPS/i)
            ).toBeTruthy();
            // (with the address it was refused for)
            expect(insecure.container.textContent).toContain(
                window.location.origin
            );
            insecure.unmount();
            secure(true);
            const fine = render(<ExternalSignerSettings />);
            expect(
                fine.queryByText(/connects only to pages opened over HTTPS/i)
            ).toBeNull();
            fine.unmount();
            // a browser that does not say is not said to be insecure
            secure(undefined);
            const unknown = render(<ExternalSignerSettings />);
            expect(
                unknown.queryByText(/connects only to pages opened over HTTPS/i)
            ).toBeNull();
        } finally {
            delete (window as any).isSecureContext;
        }
    });

    it("shows the refusal of a page that is not on HTTPS after Connect is pressed", async () => {
        const fake = makeFakeProvider({connected: false});
        fake.provider.connect = async () => {
            throw new Error(
                "Connections from non-HTTPS origins are not supported"
            );
        };
        win.bitsharesWallet = fake.provider;
        const {getByText, findByText} = render(<ExternalSignerSettings />);
        await act(async () => {
            fireEvent.click(getByText("Connect"));
        });
        expect(
            await findByText(
                /The extension connects only to pages opened over HTTPS/i
            )
        ).toBeTruthy();
    });

    it("does not give that advice where the extension is there", async () => {
        const {getByText, queryByText, getByTestId} = render(
            <ExternalSignerSettings />
        );
        await act(async () => {
            fireEvent.click(getByText("Connect"));
        });
        await waitFor(() =>
            expect(getByTestId("signer-status").textContent).toBe(
                "Connected as alice."
            )
        );
        expect(
            queryByText(/Browser extensions are usually not available/i)
        ).toBeNull();
    });

    it("lists what is not supported with the extension", () => {
        const {getByText} = render(<ExternalSignerSettings />);
        expect(getByText(/memos/i)).toBeTruthy();
    });

    it("disconnects", async () => {
        const {getByText} = render(<ExternalSignerSettings />);
        await act(async () => {
            fireEvent.click(getByText("Connect"));
        });
        await act(async () => {
            fireEvent.click(getByText("Disconnect"));
        });
        expect(ExternalSignerActions.isActive()).toBe(false);
    });
});
