import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

const mockSetCurrent = jest.fn();
let mockMyAccounts: string[] = ["mine"];

jest.mock("../../stores/AccountStore", () => ({
    __esModule: true,
    default: {
        getMyAccounts: () => mockMyAccounts,
        getState: () => ({currentAccount: "someone-else"})
    }
}));
jest.mock("../../actions/AccountActions", () => ({
    __esModule: true,
    default: {
        setCurrentAccount: {defer: (name: string) => mockSetCurrent(name)}
    }
}));
jest.mock("../../actions/SettingsActions", () => ({
    __esModule: true,
    default: {changeSetting: jest.fn()}
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    useReduxState: (selector: any) =>
        String(selector).indexOf("currentAccount") !== -1 ||
        selector.name === "selectAccountState"
            ? {currentAccount: "someone-else"}
            : {settings: {get: () => true}}
}));

import AccountBrowsingMode from "../../components/Account/AccountBrowsingMode";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

describe("AccountBrowsingMode as a chip", () => {
    it("is an icon button named View Mode, and switches back to the user's own account", () => {
        mockMyAccounts = ["mine"];
        const {getByRole} = render(<AccountBrowsingMode chip />);
        const chip = getByRole("button", {name: "View Mode"});
        expect(chip.textContent).toBe("");
        fireEvent.click(chip);
        expect(mockSetCurrent).toHaveBeenCalledWith("mine");
    });

    it("is not there for the user's own account", () => {
        mockMyAccounts = ["someone-else"];
        const {queryByRole} = render(<AccountBrowsingMode chip />);
        expect(queryByRole("button", {name: "View Mode"})).toBeNull();
    });
});
