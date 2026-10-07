import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Table, TableColumn} from "../../design-system/Table";

interface Row {
    key: string;
    name: string;
    amount: number;
}

const rows: Row[] = [
    {key: "a", name: "BTS", amount: 3},
    {key: "b", name: "USD", amount: 1},
    {key: "c", name: "CNY", amount: 2}
];

const columns: TableColumn<Row>[] = [
    {key: "name", dataIndex: "name", title: "Name"},
    {
        key: "amount",
        dataIndex: "amount",
        title: "Amount",
        sorter: (a, b) => a.amount - b.amount
    }
];

describe("design-system/Table", () => {
    it("renders a header and a row per data entry", () => {
        const {getByText} = render(
            <Table columns={columns} dataSource={rows} pagination={false} />
        );
        expect(getByText("Name")).toBeTruthy();
        expect(getByText("BTS")).toBeTruthy();
        expect(getByText("USD")).toBeTruthy();
        expect(getByText("CNY")).toBeTruthy();
    });

    it("shows locale.emptyText when dataSource is empty", () => {
        const {getByText} = render(
            <Table
                columns={columns}
                dataSource={[]}
                pagination={false}
                locale={{emptyText: "Nothing here"}}
            />
        );
        expect(getByText("Nothing here")).toBeTruthy();
    });

    it("sorts by a clicked sortable column header, cycling ascend/descend/none", () => {
        const {getByText, getAllByRole} = render(
            <Table columns={columns} dataSource={rows} pagination={false} />
        );
        const getBodyText = () =>
            getAllByRole("row")
                .slice(1)
                .map(row => row.textContent);

        expect(getBodyText()).toEqual(["BTS3", "USD1", "CNY2"]);

        fireEvent.click(getByText("Amount"));
        expect(getBodyText()).toEqual(["USD1", "CNY2", "BTS3"]);

        fireEvent.click(getByText("Amount"));
        expect(getBodyText()).toEqual(["BTS3", "CNY2", "USD1"]);

        fireEvent.click(getByText("Amount"));
        expect(getBodyText()).toEqual(["BTS3", "USD1", "CNY2"]);
    });

    it("calls onChange with the sorter info when a header is clicked", () => {
        const onChange = jest.fn();
        const {getByText} = render(
            <Table
                columns={columns}
                dataSource={rows}
                pagination={false}
                onChange={onChange}
            />
        );
        fireEvent.click(getByText("Amount"));
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({current: 1}),
            {},
            {columnKey: "amount", field: "amount", order: "ascend"}
        );
    });

    it("paginates client-side and navigates with the next/prev buttons", () => {
        const {getByText, queryByText} = render(
            <Table
                columns={columns}
                dataSource={rows}
                pagination={{pageSize: 2}}
            />
        );
        expect(getByText("BTS")).toBeTruthy();
        expect(getByText("USD")).toBeTruthy();
        expect(queryByText("CNY")).toBeNull();

        fireEvent.click(getByText("›"));
        expect(getByText("CNY")).toBeTruthy();
        expect(queryByText("BTS")).toBeNull();

        fireEvent.click(getByText("‹"));
        expect(getByText("BTS")).toBeTruthy();
    });

    it("supports row selection with a controlled selectedRowKeys/onChange", () => {
        const onChange = jest.fn();
        const {getAllByRole} = render(
            <Table
                columns={columns}
                dataSource={rows}
                pagination={false}
                rowSelection={{selectedRowKeys: [], onChange}}
            />
        );
        const checkboxes = getAllByRole("checkbox") as HTMLInputElement[];
        // First checkbox is "select all"; the rest are per-row.
        fireEvent.click(checkboxes[1]);
        expect(onChange).toHaveBeenCalledWith(["a"], [rows[0]]);
    });

    it("disables a row's own selection checkbox per getCheckboxProps", () => {
        const onChange = jest.fn();
        const {getAllByRole} = render(
            <Table
                columns={columns}
                dataSource={rows}
                pagination={false}
                rowSelection={{
                    selectedRowKeys: [],
                    onChange,
                    getCheckboxProps: record => ({
                        disabled: record.key === "b"
                    })
                }}
            />
        );
        const checkboxes = getAllByRole("checkbox") as HTMLInputElement[];
        // First checkbox is "select all"; the rest are per-row (a, b, c).
        expect(checkboxes[1].disabled).toBe(false);
        expect(checkboxes[2].disabled).toBe(true);
        expect(checkboxes[3].disabled).toBe(false);
    });

    it("calls onRow's handlers for each rendered row", () => {
        const onRowClick = jest.fn();
        const {getByText} = render(
            <Table
                columns={columns}
                dataSource={rows}
                pagination={false}
                onRow={record => ({onClick: () => onRowClick(record.key)})}
            />
        );
        fireEvent.click(getByText("USD"));
        expect(onRowClick).toHaveBeenCalledWith("b");
    });

    it("carries the stable ds-table-* hooks Utility/CollapsibleTable.tsx targets", () => {
        const {container} = render(
            <Table
                columns={columns}
                dataSource={rows}
                footer={() => "footer content"}
                pagination={{pageSize: 1}}
            />
        );
        expect(container.querySelector(".ds-table-thead")).toBeTruthy();
        expect(container.querySelector(".ds-table-tbody")).toBeTruthy();
        expect(container.querySelector(".ds-table-footer")).toBeTruthy();
        expect(container.querySelector(".ds-table-pagination")).toBeTruthy();
    });
});
