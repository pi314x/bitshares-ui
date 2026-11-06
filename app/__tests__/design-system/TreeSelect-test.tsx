import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {TreeSelect, TreeSelectNode} from "../../design-system/TreeSelect";

const data: TreeSelectNode[] = [
    {
        title: "Europe (2)",
        value: "Europe",
        children: [
            {title: "wss://eu1", value: "wss://eu1"},
            {title: "wss://eu2", value: "wss://eu2"}
        ]
    },
    {
        title: "Asia (1)",
        value: "Asia",
        children: [{title: "wss://as1", value: "wss://as1"}]
    }
];

function open(container: HTMLElement) {
    fireEvent.click(container.querySelector('[role="combobox"]') as Element);
}

describe("design-system/TreeSelect", () => {
    it("shows the placeholder only while nothing is selected", () => {
        const {container, rerender} = render(
            <TreeSelect treeData={data} value={[]} searchPlaceholder="narrow" />
        );
        expect(
            (container.querySelector("input") as HTMLInputElement).placeholder
        ).toBe("narrow");
        rerender(
            <TreeSelect
                treeData={data}
                value={["Asia"]}
                searchPlaceholder="narrow"
            />
        );
        expect(
            (container.querySelector("input") as HTMLInputElement).placeholder
        ).toBe("");
    });

    it("treats a parent value as all its children checked and shows one tag (SHOW_PARENT)", () => {
        const {container, getByText} = render(
            <TreeSelect treeData={data} value={["Europe"]} />
        );
        expect(getByText(/Europe \(2\)/)).toBeTruthy();
        open(container);
        const eu1 = container.ownerDocument.querySelector(
            'input[aria-label="wss://eu1"]'
        );
        expect(eu1).toBeNull(); // collapsed by default
    });

    it("emits the parent alone once every child becomes checked, and children individually otherwise", () => {
        const onChange = jest.fn();
        const {container, getByLabelText} = render(
            <TreeSelect
                treeData={data}
                value={["wss://eu1"]}
                onChange={onChange}
            />
        );
        open(container);
        fireEvent.click(getByLabelText("Expand Europe (2)"));
        fireEvent.click(getByLabelText("wss://eu2"));
        expect(onChange).toHaveBeenLastCalledWith(["Europe"]);

        fireEvent.click(getByLabelText("Expand Asia (1)"));
        fireEvent.click(getByLabelText("wss://as1"));
        expect(onChange).toHaveBeenLastCalledWith(["wss://eu1", "Asia"]);
    });

    it("checking a parent selects all its children; unchecking removes them", () => {
        const onChange = jest.fn();
        const {container, getByLabelText, rerender} = render(
            <TreeSelect treeData={data} value={[]} onChange={onChange} />
        );
        open(container);
        fireEvent.click(getByLabelText("Europe (2)"));
        expect(onChange).toHaveBeenLastCalledWith(["Europe"]);
        rerender(
            <TreeSelect
                treeData={data}
                value={["Europe"]}
                onChange={onChange}
            />
        );
        fireEvent.click(getByLabelText("Europe (2)"));
        expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it("marks a partially-checked parent indeterminate", () => {
        const {container, getByLabelText} = render(
            <TreeSelect treeData={data} value={["wss://eu1"]} />
        );
        open(container);
        expect(
            (getByLabelText("Europe (2)") as HTMLInputElement).indeterminate
        ).toBe(true);
        expect((getByLabelText("Europe (2)") as HTMLInputElement).checked).toBe(
            false
        );
    });

    it("removes a selection with its tag's remove button", () => {
        const onChange = jest.fn();
        const {getByLabelText} = render(
            <TreeSelect
                treeData={data}
                value={["Europe", "wss://as1"]}
                onChange={onChange}
            />
        );
        fireEvent.click(getByLabelText("Remove Europe"));
        expect(onChange).toHaveBeenLastCalledWith(["Asia"]);
    });

    it("filters by node value, keeping ancestors and expanding them", () => {
        const {container, getByLabelText, queryByLabelText} = render(
            <TreeSelect treeData={data} value={[]} />
        );
        const input = container.querySelector("input") as HTMLInputElement;
        fireEvent.change(input, {target: {value: "as1"}});
        expect(getByLabelText("wss://as1")).toBeTruthy();
        expect(queryByLabelText("wss://eu1")).toBeNull();
        expect(queryByLabelText("Europe (2)")).toBeNull();
        fireEvent.change(input, {target: {value: "zzz"}});
        expect(container.textContent).toContain("Not Found");
    });

    it("keeps unknown persisted values instead of dropping them on the next change", () => {
        const onChange = jest.fn();
        const {container, getByLabelText} = render(
            <TreeSelect
                treeData={data}
                value={["wss://gone"]}
                onChange={onChange}
            />
        );
        open(container);
        fireEvent.click(getByLabelText("Asia (1)"));
        expect(onChange).toHaveBeenLastCalledWith(["Asia", "wss://gone"]);
    });

    it("closes the dropdown when clicking outside", () => {
        const {container} = render(<TreeSelect treeData={data} value={[]} />);
        open(container);
        expect(container.querySelector('[role="tree"]')).toBeTruthy();
        fireEvent.mouseDown(document.body);
        expect(container.querySelector('[role="tree"]')).toBeNull();
    });
});
