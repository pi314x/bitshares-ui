import * as React from "react";
import {render, fireEvent} from "@testing-library/react";

jest.mock("../../../components/Account/AccountSelector", () => () => null);
jest.mock("../../../components/Utility/AssetSelect", () => () => null);
jest.mock("lzma", () => ({
    compress: (data: string, level: number, cb: (result: any) => void) =>
        cb(data)
}));
jest.mock("common/base58", () => ({
    encode: (buf: Buffer) => buf.toString()
}));

import InvoiceRequest from "../../../components/Transfer/InvoiceRequest";

function makeAccount(name: string) {
    return {get: (key: string) => (key === "name" ? name : undefined)};
}

function fillOneLineItem(container: HTMLElement) {
    const textInputs = Array.from(
        container.querySelectorAll('input:not([type="number"])')
    ) as HTMLInputElement[];
    // Scalar text-input fields render first: memo, to_label (`note` is a
    // `<textarea>`, not matched here) - the line item's own label input
    // is the 3rd text input.
    fireEvent.change(textInputs[0], {target: {value: "memo text"}});
    fireEvent.change(textInputs[2], {target: {value: "Widget"}});

    const numberInputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(numberInputs[0], {target: {value: "2"}});
    fireEvent.change(numberInputs[1], {target: {value: "10"}});
}

function rowButtons(container: HTMLElement): HTMLButtonElement[] {
    return Array.from(
        container.querySelectorAll('button:not([type="submit"])')
    ) as HTMLButtonElement[];
}

describe("components/Transfer/InvoiceRequest", () => {
    it("disables submit until the memo and every line item field are filled", () => {
        const {container} = render(
            <InvoiceRequest
                currentAccount={makeAccount("alice")}
                validateFormat={() => true}
            />
        );
        const submit = container.querySelector(
            'button[type="submit"]'
        ) as HTMLButtonElement;
        expect(submit.disabled).toBe(true);

        const memoInput = container.querySelector(
            "input"
        ) as HTMLInputElement;
        fireEvent.change(memoInput, {target: {value: "memo text"}});
        // Line item still empty - submit stays disabled.
        expect(submit.disabled).toBe(true);
    });

    it("enables submit once filled, and submits the expected invoice shape", () => {
        const validateFormat = jest.fn(() => true);
        const {container} = render(
            <InvoiceRequest
                currentAccount={makeAccount("alice")}
                validateFormat={validateFormat}
            />
        );
        fillOneLineItem(container);

        const submit = container.querySelector(
            'button[type="submit"]'
        ) as HTMLButtonElement;
        expect(submit.disabled).toBe(false);

        fireEvent.click(submit);
        expect(validateFormat).toHaveBeenCalledWith(
            expect.objectContaining({
                to: "alice",
                memo: "memo text",
                line_items: [{label: "Widget", quantity: "2", price: "10"}]
            })
        );
    });

    it("adds and removes line item rows, keeping at least one", () => {
        const {container} = render(
            <InvoiceRequest
                currentAccount={makeAccount("alice")}
                validateFormat={() => true}
            />
        );
        // With a single row, its only icon button is "add" (it's also
        // the last/only row).
        fireEvent.click(rowButtons(container)[0]);
        expect(
            container.querySelectorAll('input[type="number"]').length
        ).toBe(4);

        // With 2 rows, the first row's button is now "remove" (no longer
        // the last row) - click it to drop back to 1 row.
        fireEvent.click(rowButtons(container)[0]);
        expect(
            container.querySelectorAll('input[type="number"]').length
        ).toBe(2);
    });
});
