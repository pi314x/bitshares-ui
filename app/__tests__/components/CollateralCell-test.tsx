import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

jest.mock("../../components/Utility/LinkToAssetById", () => ({
    __esModule: true,
    default: ({asset}: {asset: string}) => <a>{asset}</a>
}));

import CollateralCell from "../../components/Account/CreditOffer/CollateralCell";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

describe("CollateralCell", () => {
    const items = ["1.3.0", "1.3.1", "1.3.2", "1.3.3", "1.3.4"].map(id => [
        id,
        {}
    ]);

    it("shows three assets and the rest on request", () => {
        const {queryByText, getByText} = render(
            <CollateralCell items={items} />
        );
        expect(queryByText("1.3.2")).not.toBeNull();
        expect(queryByText("1.3.3")).toBeNull();
        fireEvent.click(getByText("+2 more"));
        expect(queryByText("1.3.4")).not.toBeNull();
        fireEvent.click(getByText("Show fewer"));
        expect(queryByText("1.3.4")).toBeNull();
    });

    it("has no toggle for a short list", () => {
        const {queryByText} = render(
            <CollateralCell items={items.slice(0, 2)} />
        );
        expect(queryByText(/more/)).toBeNull();
    });
});
