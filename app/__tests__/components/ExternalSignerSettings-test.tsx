import * as React from "react";
import {render, fireEvent, act, waitFor} from "@testing-library/react";
import counterpart from "counterpart";
import {Apis} from "bitsharesjs-ws";
import localeEn from "../../assets/locales/locale-en.json";
import ExternalSignerSettings from "../../components/Settings/ExternalSignerSettings";
import ExternalSignerActions from "../../actions/ExternalSignerActions";
import {reduxStore} from "../../store/reduxStore";
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
    it("shows only the choice while the local wallet is selected", () => {
        const {queryByText, getByLabelText} = render(
            <ExternalSignerSettings />
        );
        expect(queryByText("Connect")).toBeNull();
        expect(
            (getByLabelText(/Local wallet/i) as HTMLInputElement).checked
        ).toBe(true);
    });

    it("connects the extension and says which account it is connected as", async () => {
        const {getByLabelText, getByText, getByTestId} = render(
            <ExternalSignerSettings />
        );
        fireEvent.click(getByLabelText(/Wallet extension/i));
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

    it("says so when the extension is not installed", async () => {
        delete win.bitsharesWallet;
        const {getByLabelText, getByText, findByText} = render(
            <ExternalSignerSettings />
        );
        fireEvent.click(getByLabelText(/Wallet extension/i));
        await act(async () => {
            fireEvent.click(getByText("Connect"));
        });
        expect(await findByText(/was not found in this browser/i)).toBeTruthy();
    });

    it("lists what is not supported with the extension", () => {
        const {getByLabelText, getByText} = render(<ExternalSignerSettings />);
        fireEvent.click(getByLabelText(/Wallet extension/i));
        expect(getByText(/memos/i)).toBeTruthy();
    });

    it("goes back to the local wallet", () => {
        const {getByLabelText} = render(<ExternalSignerSettings />);
        fireEvent.click(getByLabelText(/Wallet extension/i));
        fireEvent.click(getByLabelText(/Local wallet/i));
        expect(ExternalSignerActions.getState().preference).toBe("local");
    });
});
