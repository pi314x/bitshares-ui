// The faucet tab of the settings showed the main chain's faucet on a test chain, where a
// registration goes to the test chain's own (found on the testnet run).
jest.mock("../../../components/Utility/HelpContent", () => () => null);

let mockOnTestnet = false;
jest.mock("../../../branding", () => ({
    ...jest.requireActual("../../../branding"),
    isTestnet: () => mockOnTestnet
}));

import * as React from "react";
import {render} from "@testing-library/react";
import {MemoryRouter, Routes, Route} from "react-router-dom";
import {IntlProvider} from "react-intl";
import Immutable from "immutable";
import counterpart from "counterpart";
import Settings from "../../../components/Settings/Settings";
import SettingsStore from "../../../stores/SettingsStore";
import localeEn from "../../../assets/locales/locale-en.json";

function faucetField(): string {
    const settings = (SettingsStore as any).getState().settings;
    const {container} = render(
        <IntlProvider locale="en">
            <MemoryRouter initialEntries={["/settings/faucet_address"]}>
                <Routes>
                    <Route
                        path="/settings/:tab"
                        element={
                            <Settings
                                settings={settings}
                                viewSettings={Immutable.Map()}
                                defaults={
                                    (SettingsStore as any).getState().defaults
                                }
                            />
                        }
                    />
                </Routes>
            </MemoryRouter>
        </IntlProvider>
    );
    const input = container.querySelector(
        "input[type=text]"
    ) as HTMLInputElement | null;
    return input ? input.value : "";
}

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

describe("the faucet tab of the settings", () => {
    it("shows the main chain's faucet on the main chain", () => {
        mockOnTestnet = false;
        expect(faucetField()).toBe("https://faucet.xbts.io");
    });

    it("shows the test chain's own faucet on a test chain", () => {
        mockOnTestnet = true;
        expect(faucetField()).toBe("https://testnet-faucet.xbts.io");
    });
});
