import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import DisableCopyText from "../../../components/DepositWithdraw/DisableCopyText";

function copy(element: HTMLElement) {
    const setData = jest.fn();
    // fireEvent returns false when a listener called preventDefault()
    const notCancelled = fireEvent.copy(element, {clipboardData: {setData}});
    return {cancelled: !notCancelled, setData};
}

describe("DisableCopyText", () => {
    it("renders its children inside a span", () => {
        const {container} = render(<DisableCopyText>BTS123</DisableCopyText>);
        expect(container.querySelector("span")!.textContent).toBe("BTS123");
    });

    it("cancels the copy event by default", () => {
        const {container} = render(<DisableCopyText>secret</DisableCopyText>);
        const {cancelled, setData} = copy(container.querySelector("span")!);
        expect(cancelled).toBe(true);
        expect(setData).not.toHaveBeenCalled();
    });

    it("puts the replacement text on the clipboard instead", () => {
        const {container} = render(
            <DisableCopyText replaceCopyText="use the copy button">
                address
            </DisableCopyText>
        );
        const {cancelled, setData} = copy(container.querySelector("span")!);
        expect(cancelled).toBe(true);
        expect(setData).toHaveBeenCalledWith(
            "text/plain",
            "use the copy button"
        );
    });

    it("lets the copy through only when disableCopy is exactly false", () => {
        const {container} = render(
            <DisableCopyText disableCopy={false} replaceCopyText="x">
                address
            </DisableCopyText>
        );
        const {cancelled, setData} = copy(container.querySelector("span")!);
        expect(cancelled).toBe(false);
        expect(setData).not.toHaveBeenCalled();
    });

    it("follows prop changes without re-attaching the listener", () => {
        const {container, rerender} = render(
            <DisableCopyText replaceCopyText="one">a</DisableCopyText>
        );
        const span = container.querySelector("span")!;
        rerender(<DisableCopyText replaceCopyText="two">a</DisableCopyText>);
        expect(copy(span).setData).toHaveBeenCalledWith("text/plain", "two");
        rerender(<DisableCopyText disableCopy={false}>a</DisableCopyText>);
        expect(copy(span).cancelled).toBe(false);
    });

    it("stops listening after unmount", () => {
        const {container, unmount} = render(
            <DisableCopyText>a</DisableCopyText>
        );
        const span = container.querySelector("span")!;
        unmount();
        expect(copy(span).cancelled).toBe(false);
    });
});
