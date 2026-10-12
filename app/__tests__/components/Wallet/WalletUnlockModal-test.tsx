// Regression: opening the unlock modal threw "Cannot read properties of
// undefined (reading 'focus')" and unmounted the whole app. The port still
// treated its input refs as antd instances (`ref.input.focus()`, `.clear()`),
// but the design-system Input forwards the native <input>. Found by
// creating a local wallet in the built bundle and clicking "Locked".
jest.mock("../../../components/Utility/HelpContent", () => () => null);

import * as React from "react";
import {render, act, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {IntlProvider} from "react-intl";
import WalletUnlockModal from "../../../components/Wallet/WalletUnlockModal";
import {DisableChromeAutocomplete} from "../../../components/Wallet/WalletUnlockModalLib";
import WalletUnlockActions from "../../../actions/WalletUnlockActions";
import WalletUnlockStore from "../../../stores/WalletUnlockStore";
import {reduxStore} from "../../../store/reduxStore";
import {patchState} from "../../../store/slices/accountSlice";

function mount() {
    return render(
        <IntlProvider locale="en">
            <MemoryRouter>
                <WalletUnlockModal />
            </MemoryRouter>
        </IntlProvider>
    );
}

function open(passwordLogin: boolean, passwordAccount?: string) {
    // The unlock store reads `passwordLogin`; a saved account name makes the
    // password-login branch focus the password field instead of the account
    // field - each of the three branches had its own broken ref access.
    // Set directly on the store/slice (the public actions go through
    // Apis.instance(), which does not exist in a unit test).
    (WalletUnlockStore as any).onChangeSetting({
        setting: "passwordLogin",
        value: passwordLogin
    });
    reduxStore.dispatch(patchState({passwordAccount: passwordAccount || null}));
}

describe("WalletUnlockModal", () => {
    afterEach(() => {
        act(() => {
            (WalletUnlockActions as any).cancel();
        });
    });

    const cases: Array<[string, boolean, string | undefined]> = [
        ["local wallet login (password only)", false, undefined],
        ["password login without a saved account", true, undefined],
        ["password login with a saved account", true, "committee-account"]
    ];
    cases.forEach(([name, passwordLogin, account]) => {
        it(`opens without throwing - ${name}`, async () => {
            open(passwordLogin, account);
            const errors: any[] = [];
            const onError = (e: any) => errors.push(e.error || e);
            window.addEventListener("error", onError);
            mount();

            await act(async () => {
                (WalletUnlockActions as any).unlock().catch(() => {});
            });
            await act(async () => {
                await new Promise(r => setTimeout(r, 50));
            });

            expect(
                document.body.querySelector("input[type=password]")
            ).not.toBeNull();
            expect(errors).toEqual([]);
            window.removeEventListener("error", onError);
            expect(screen).toBeDefined();
            expect((WalletUnlockStore.getState() as any).resolve).toBeTruthy();
        });
    });
});

describe("DisableChromeAutocomplete", () => {
    // The global text-field styling gives every text input a minimum control
    // height; this autofill-trap input must stay a zero-height invisible
    // element, otherwise it shows up as a blank gap in the unlock dialog.
    it("overrides the global minimum field height", () => {
        const {container} = render(<DisableChromeAutocomplete />);
        const input = container.querySelector("input") as HTMLInputElement;
        expect(input.style.visibility).toBe("hidden");
        expect(input.style.height).toMatch(/^0(px)?$/);
        expect(input.style.minHeight).toMatch(/^0(px)?$/);
    });
});
