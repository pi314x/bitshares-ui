import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import CollapsibleTable from "../../../components/Utility/CollapsibleTable";

interface Row {
    key: string;
    name: string;
}

const rows: Row[] = [{key: "a", name: "BTS"}];
const columns = [{key: "name", dataIndex: "name", title: "Header"}];

describe("components/Utility/CollapsibleTable", () => {
    it("starts uncollapsed by default and toggles on header click", () => {
        const {container, getByText} = render(
            <CollapsibleTable columns={columns} dataSource={rows} pagination={false} />
        );
        const table = container.querySelector(".collapsible-table") as HTMLElement;
        expect(table.className).toContain("collapsible-table-uncollapsed");

        fireEvent.click(getByText("Header"));
        expect(table.className).toContain("collapsible-table-collapsed");
        expect(table.className).not.toContain("uncollapsed");

        fireEvent.click(getByText("Header"));
        expect(table.className).toContain("collapsible-table-uncollapsed");
    });

    it("starts collapsed when isCollapsed is passed", () => {
        const {container} = render(
            <CollapsibleTable
                columns={columns}
                dataSource={rows}
                pagination={false}
                isCollapsed={true}
            />
        );
        const table = container.querySelector(".collapsible-table") as HTMLElement;
        expect(table.className).toContain("collapsible-table-collapsed");
    });

    it("does not toggle when the select-all checkbox is clicked", () => {
        const onChange = jest.fn();
        const {container} = render(
            <CollapsibleTable
                columns={columns}
                dataSource={rows}
                pagination={false}
                rowSelection={{selectedRowKeys: [], onChange}}
            />
        );
        const table = container.querySelector(".collapsible-table") as HTMLElement;
        expect(table.className).toContain("collapsible-table-uncollapsed");

        const checkbox = container.querySelector(
            'input[aria-label="Select all"]'
        ) as HTMLInputElement;
        fireEvent.click(checkbox);
        expect(table.className).toContain("collapsible-table-uncollapsed");
    });

    it("calls an externally passed onHeaderRow's own onClick alongside the toggle", () => {
        const innerOnClick = jest.fn();
        const {getByText} = render(
            <CollapsibleTable
                columns={columns}
                dataSource={rows}
                pagination={false}
                onHeaderRow={() => ({onClick: innerOnClick})}
            />
        );
        fireEvent.click(getByText("Header"));
        expect(innerOnClick).toHaveBeenCalled();
    });
});
