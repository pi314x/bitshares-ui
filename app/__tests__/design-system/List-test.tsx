import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {List} from "../../design-system/List";

const rows = ["a", "b", "c", "d", "e"];

describe("design-system/List", () => {
    it("renders every item through renderItem when not paginated", () => {
        const {getByText} = render(
            <List
                dataSource={rows}
                renderItem={item => <List.Item>{item}</List.Item>}
            />
        );
        rows.forEach(r => expect(getByText(r)).toBeTruthy());
    });

    it("paginates client-side by pageSize and navigates with the pager", () => {
        const {getByText, queryByText} = render(
            <List
                dataSource={rows}
                pagination={{pageSize: 2}}
                renderItem={item => <List.Item>{item}</List.Item>}
            />
        );
        expect(getByText("a")).toBeTruthy();
        expect(queryByText("c")).toBeNull();
        fireEvent.click(getByText("›"));
        expect(getByText("c")).toBeTruthy();
        expect(queryByText("a")).toBeNull();
        expect(getByText("2 / 3")).toBeTruthy();
    });

    it("passes the absolute index to renderItem and clamps the page when data shrinks", () => {
        const renderItem = jest.fn((item: string) => (
            <List.Item>{item}</List.Item>
        ));
        const {getByText, rerender} = render(
            <List
                dataSource={rows}
                pagination={{pageSize: 2}}
                renderItem={renderItem}
            />
        );
        fireEvent.click(getByText("›"));
        fireEvent.click(getByText("›"));
        expect(renderItem).toHaveBeenCalledWith("e", 4);
        rerender(
            <List
                dataSource={["a", "b"]}
                pagination={{pageSize: 2}}
                renderItem={renderItem}
            />
        );
        expect(getByText("a")).toBeTruthy();
    });

    it("renders List.Item actions and List.Item.Meta title/description", () => {
        const {getByText} = render(
            <List
                dataSource={["x"]}
                renderItem={() => (
                    <List.Item actions={[<a key="go">Go</a>]}>
                        <List.Item.Meta title="Title" description="Desc" />
                    </List.Item>
                )}
            />
        );
        expect(getByText("Go")).toBeTruthy();
        expect(getByText("Title")).toBeTruthy();
        expect(getByText("Desc")).toBeTruthy();
    });
});
