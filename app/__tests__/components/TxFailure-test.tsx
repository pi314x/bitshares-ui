// A failed transaction in words: the common cases (an order the book could not fill whole, a floor that was missed)
// get a sentence that says nothing was spent, and the node's own text stays under "Show details"; any other error
// is shown as it came.
import * as React from "react";
import {fireEvent, render} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";
import {TxFailure} from "../../components/Utility/TxFailure";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

const KILLED =
    '3050101 - Execution error: Killing limit order due to unable to fill: Killing limit order {"seller":"1.2.9"} due to unable to fill';

describe("TxFailure", () => {
    it("leads with a sentence for an order that could not be filled, and keeps the node's text under Show details", () => {
        const {getByText, queryByText} = render(<TxFailure error={KILLED} />);
        expect(getByText(/Nothing was spent/)).toBeTruthy();
        // the node's text is not on the screen until it is asked for
        expect(queryByText(KILLED)).toBeNull();
        fireEvent.click(getByText("Show details"));
        expect(getByText(KILLED)).toBeTruthy();
        fireEvent.click(getByText("Hide details"));
        expect(queryByText(KILLED)).toBeNull();
    });

    it("shows an error that is none of the common cases as it came, with no details to open", () => {
        const {getByText, queryByText} = render(
            <TxFailure error="network down" />
        );
        expect(getByText("network down")).toBeTruthy();
        expect(queryByText("Show details")).toBeNull();
    });

    it("starts a new failure with its details closed", () => {
        const {getByText, queryByText, rerender} = render(
            <TxFailure error={KILLED} />
        );
        fireEvent.click(getByText("Show details"));
        expect(getByText(KILLED)).toBeTruthy();
        const other = KILLED.replace("1.2.9", "1.2.10");
        rerender(<TxFailure error={other} />);
        expect(queryByText(other)).toBeNull();
        expect(getByText("Show details")).toBeTruthy();
    });
});
