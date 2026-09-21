import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {NodePicker} from "../../design-system/NodePicker";

describe("design-system/NodePicker", () => {
    it("hides its panel until the trigger is clicked", () => {
        const {getByText, queryByText} = render(
            <NodePicker connected={true} label="Connected">
                <div>panel content</div>
            </NodePicker>
        );
        expect(queryByText("panel content")).toBeNull();
        fireEvent.click(getByText("Connected"));
        expect(getByText("panel content")).toBeTruthy();
    });
});
