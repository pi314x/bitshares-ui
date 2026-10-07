import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Form} from "../../design-system/Form";

describe("design-system/Form", () => {
    it("calls onSubmit when submitted", () => {
        const onSubmit = jest.fn(e => e.preventDefault());
        const {getByText} = render(
            <Form onSubmit={onSubmit}>
                <button type="submit">Go</button>
            </Form>
        );
        fireEvent.click(getByText("Go"));
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("renders a Form.Item's label, children and help text", () => {
        const {getByText} = render(
            <Form>
                <Form.Item label="Account name" help="Must be unique">
                    <input value="init0" readOnly />
                </Form.Item>
            </Form>
        );
        expect(getByText("Account name:")).toBeTruthy();
        expect(getByText("Must be unique")).toBeTruthy();
    });

    it("omits the colon when colon is false", () => {
        const {getByText, queryByText} = render(
            <Form>
                <Form.Item label="Account name" colon={false}>
                    <input readOnly />
                </Form.Item>
            </Form>
        );
        expect(getByText("Account name")).toBeTruthy();
        expect(queryByText("Account name:")).toBeNull();
    });

    it("renders no label element at all when label is omitted", () => {
        const {container} = render(
            <Form>
                <Form.Item help="Just help text">
                    <input readOnly />
                </Form.Item>
            </Form>
        );
        expect(container.querySelector("label")).toBeNull();
    });
});
