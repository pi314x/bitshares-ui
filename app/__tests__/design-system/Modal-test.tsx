import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Modal} from "../../design-system/Modal";

describe("design-system/Modal", () => {
    it("renders nothing when closed", () => {
        const {queryByRole} = render(
            <Modal open={false}>
                <p>Body</p>
            </Modal>
        );
        expect(queryByRole("dialog")).toBeNull();
    });

    it("renders its title, children and footer when open", () => {
        const {getByText, getByRole} = render(
            <Modal open title="Confirm" footer={<button>OK</button>}>
                <p>Are you sure?</p>
            </Modal>
        );
        expect(getByRole("dialog")).toBeTruthy();
        expect(getByText("Confirm")).toBeTruthy();
        expect(getByText("Are you sure?")).toBeTruthy();
        expect(getByText("OK")).toBeTruthy();
    });

    it("calls onClose when the close button is clicked", () => {
        const onClose = jest.fn();
        const {getByLabelText} = render(
            <Modal open onClose={onClose} title="Confirm">
                Body
            </Modal>
        );
        fireEvent.click(getByLabelText("Close"));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose on Escape", () => {
        const onClose = jest.fn();
        render(
            <Modal open onClose={onClose}>
                Body
            </Modal>
        );
        fireEvent.keyDown(document, {key: "Escape"});
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose on a backdrop click but not on a click inside the dialog", () => {
        const onClose = jest.fn();
        const {getByRole, getByText} = render(
            <Modal open onClose={onClose}>
                <button>Inside</button>
            </Modal>
        );
        fireEvent.mouseDown(getByText("Inside"));
        expect(onClose).not.toHaveBeenCalled();

        fireEvent.mouseDown(getByRole("dialog").parentElement as Element);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("hides the close button when closable is false", () => {
        const {queryByLabelText} = render(
            <Modal open onClose={() => {}} title="Confirm" closable={false}>
                Body
            </Modal>
        );
        expect(queryByLabelText("Close")).toBeNull();
    });

    it("does not render a close button without onClose", () => {
        const {queryByLabelText} = render(
            <Modal open title="Confirm">
                Body
            </Modal>
        );
        expect(queryByLabelText("Close")).toBeNull();
    });
});
