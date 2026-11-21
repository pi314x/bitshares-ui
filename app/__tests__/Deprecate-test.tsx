// The deprecation page is only rendered on a retired deployment, so nothing in
// normal use (or the boot smoke test) ever shows it; this pins its two variants.
jest.mock("react-loadable", () => () => {
    const Settings = () => <div data-testid="settings">settings</div>;
    return Settings;
});
jest.mock("stores/WalletDb", () => ({
    __esModule: true,
    default: {getWallet: jest.fn()}
}));
jest.mock("../branding", () => ({
    getWalletURL: () => "https://wallet.example"
}));

import * as React from "react";
import {render, screen} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../assets/locales/locale-en.json";
import WalletDb from "stores/WalletDb";
import Deprecate from "../Deprecate";

const getWallet = (WalletDb as any).getWallet as jest.Mock;

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

describe("Deprecate", () => {
    it("links to the new wallet and skips settings when there is no local wallet", () => {
        getWallet.mockReturnValue(null);
        const {container} = render(<Deprecate />);
        const link = container.querySelector("a")!;
        expect(link.getAttribute("href")).toBe("https://wallet.example");
        expect(screen.queryByTestId("settings")).toBeNull();
    });

    it("also offers the settings page when a local wallet exists", () => {
        getWallet.mockReturnValue({});
        render(<Deprecate />);
        expect(screen.getByTestId("settings")).toBeTruthy();
    });
});
