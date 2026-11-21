import * as React from "react";
import {render} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";
import {gatewaySelector} from "../../lib/common/assetGatewayMixin";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

const gatewayStatus = {
    PIRATE: {id: "PIRATE", name: "PirateCash", options: {enabled: true}},
    XBTSX: {id: "XBTSX", name: "XBTS Native Chains", options: {enabled: true}}
};

describe("gatewaySelector", () => {
    it("shows the gateway that was chosen, by its name, not the placeholder", () => {
        const element = (gatewaySelector as any)({
            selectedGateway: "PIRATE",
            gatewayStatus,
            nAvailableGateways: 2,
            error: false,
            onGatewayChanged: () => {}
        });
        const {getByRole, queryByText} = render(
            <MemoryRouter>{element}</MemoryRouter>
        );
        expect(getByRole("button").textContent).toContain("PirateCash");
        expect(queryByText("Please select a gateway operator")).toBeNull();
    });

    it("shows the placeholder while none is chosen", () => {
        const element = (gatewaySelector as any)({
            selectedGateway: null,
            gatewayStatus,
            nAvailableGateways: 2,
            error: false,
            onGatewayChanged: () => {}
        });
        const {getByText} = render(<MemoryRouter>{element}</MemoryRouter>);
        expect(getByText("Please select a gateway operator")).toBeTruthy();
    });
});
