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

    it("treats a null/undefined dataSource as empty instead of throwing", () => {
        // Htlc.tsx passes `null` while an account has no HTLCs; antd tolerated it,
        // and the first real-data boot of /htlc crashed the whole app without it.
        expect(() =>
            render(
                <Table columns={columns} dataSource={null} pagination={false} />
            )
        ).not.toThrow();
        expect(() =>
            render(
                <Table
                    columns={columns}
                    dataSource={undefined}
                    pagination={{pageSize: 5}}
                />
            )
        ).not.toThrow();
    });

    it("renders nothing for a placeholder `{}` column instead of throwing on the record object", () => {
        // Dashboard/MarketsTable builds `showFlip ? {...} : {}`; antd rendered an
        // empty cell, the first version here tried to render the whole record
        // as a React child and unmounted the app once the table had rows.
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        const cols = [...columns, {} as any];
        const {container} = render(
            <Table columns={cols} dataSource={rows} pagination={false} />
        );
        expect(container.querySelectorAll("tbody tr").length).toBe(rows.length);
        spy.mockRestore();
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

    describe("columns without a `key` (the balances table's)", () => {
        // antd knows such a column by its dataIndex; here every one of them
        // used to be the same column, so the first took every sort
        const keyless = ([
            {
                dataIndex: "name",
                title: "Name",
                sorter: (a: Row, b: Row) => (a.name < b.name ? -1 : 1)
            },
            {
                dataIndex: "amount",
                title: "Amount",
                sorter: (a: Row, b: Row) => a.amount - b.amount,
                defaultSortOrder: "descend" as const
            }
        ] as any) as TableColumn<Row>[];
        const bodyText = (all: HTMLElement[]) =>
            all.slice(1).map(row => row.textContent);

        it("applies the default sort to the column that asked for it", () => {
            const {getAllByRole} = render(
                <Table columns={keyless} dataSource={rows} pagination={false} />
            );
            // by amount, biggest first - not by name
            expect(bodyText(getAllByRole("row"))).toEqual([
                "BTS3",
                "CNY2",
                "USD1"
            ]);
        });

        it("sorts by the header that was clicked, and says which", () => {
            const onChange = jest.fn();
            const {getByText, getAllByRole} = render(
                <Table
                    columns={keyless}
                    dataSource={rows}
                    pagination={false}
                    onChange={onChange}
                />
            );
            fireEvent.click(getByText("Name"));
            expect(bodyText(getAllByRole("row"))).toEqual([
                "BTS3",
                "CNY2",
                "USD1"
            ]);
            expect(onChange).toHaveBeenCalledWith(
                expect.objectContaining({current: 1}),
                {},
                {columnKey: "name", field: "name", order: "ascend"}
            );
        });
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
