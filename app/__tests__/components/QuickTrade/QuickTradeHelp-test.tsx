import * as React from "react";
import {render, fireEvent, screen} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../../assets/locales/locale-en.json";
import QuickTradeHelp from "../../../components/QuickTrade/QuickTradeHelp";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

describe("QuickTradeHelp", () => {
    it("answers what instant trade is at once, and keeps the rest one tap away", () => {
        render(<QuickTradeHelp />);
        expect(document.body.textContent).toContain(
            "Instant trade sells one asset for another right now"
        );
        fireEvent.click(screen.getByText("How it works"));
        const text = document.body.textContent || "";
        [
            "Choose one amount",
            "All or nothing",
            "fill-or-kill",
            "The price is an average",
            "What it costs",
            "liquidity penalty",
            "If the market moves",
            "Not the same as Trade"
        ].forEach(part => expect(text).toContain(part));
    });
});
