import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Modal} from "../../design-system/Modal";

describe("design-system/Modal", () => {
    it("renders nothing when closed", () => {
        const {queryByRole} = render(
            <Modal visible={false}>
                <p>Body</p>
            </Modal>
        );
        expect(queryByRole("dialog")).toBeNull();
    });

    it("renders its title, children and footer when visible", () => {
        const {getByText, getByRole} = render(
            <Modal visible title="Confirm" footer={<button>OK</button>}>
                <p>Are you sure?</p>
            </Modal>
        );
        expect(getByRole("dialog")).toBeTruthy();
        expect(getByText("Confirm")).toBeTruthy();
        expect(getByText("Are you sure?")).toBeTruthy();
        expect(getByText("OK")).toBeTruthy();
    });

    it("calls onCancel when the close button is clicked", () => {
        const onCancel = jest.fn();
        const {getByLabelText} = render(
            <Modal visible onCancel={onCancel} title="Confirm">
                Body
            </Modal>
        );
        fireEvent.click(getByLabelText("Close"));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel on Escape", () => {
        const onCancel = jest.fn();
        render(
            <Modal visible onCancel={onCancel}>
                Body
            </Modal>
        );
        fireEvent.keyDown(document, {key: "Escape"});
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onCancel on a backdrop click but not on a click inside the dialog", () => {
        const onCancel = jest.fn();
        const {getByRole, getByText} = render(
            <Modal visible onCancel={onCancel}>
                <button>Inside</button>
            </Modal>
        );
        fireEvent.mouseDown(getByText("Inside"));
        expect(onCancel).not.toHaveBeenCalled();

        fireEvent.mouseDown(getByRole("dialog").parentElement as Element);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("hides the close button when closable is false", () => {
        const {queryByLabelText} = render(
            <Modal visible onCancel={() => {}} title="Confirm" closable={false}>
                Body
            </Modal>
        );
        expect(queryByLabelText("Close")).toBeNull();
    });

    it("does not render a close button without onCancel", () => {
        const {queryByLabelText} = render(
            <Modal visible title="Confirm">
                Body
            </Modal>
        );
        expect(queryByLabelText("Close")).toBeNull();
    });

    it("applies wrapClassName to the backdrop and className to the dialog", () => {
        const {getByRole} = render(
            <Modal
                visible
                wrapClassName="custom-wrap"
                className="custom-dialog"
            >
                Body
            </Modal>
        );
        const dialog = getByRole("dialog");
        // The portal renders the backdrop as the dialog's direct parent
        // (same pattern the backdrop-click test above relies on).
        expect((dialog.parentElement as HTMLElement).className).toContain(
            "custom-wrap"
        );
        expect(dialog.className).toContain("custom-dialog");
    });
});
