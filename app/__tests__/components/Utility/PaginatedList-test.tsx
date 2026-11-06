import * as React from "react";
import {render, screen, fireEvent} from "@testing-library/react";
import counterpart from "counterpart";
import PaginatedList from "../../../components/Utility/PaginatedList";

const rows = (n: number) =>
    Array.from({length: n}, (_, i) => ({key: `r${i}`, name: `row ${i + 1}`}));
const header = [{title: "Name", dataIndex: "name"}];

beforeAll(() => {
    (counterpart as any).registerTranslations("en", {
        utility: {
            total_x_operations: "%(count)s operations",
            per_page: "%(count)s / page"
        }
    });
    (counterpart as any).setLocale("en");
});

describe("PaginatedList", () => {
    it("shows a page of 20 rows by default and says how many pages there are", () => {
        render(<PaginatedList rows={rows(100)} header={header} />);
        expect(screen.getByText("row 20")).toBeTruthy();
        expect(screen.queryByText("row 21")).toBeNull();
        expect(screen.getByText("1 / 5")).toBeTruthy();
    });

    it("shows the page size it is given, and the next page after it", () => {
        render(
            <PaginatedList rows={rows(100)} header={header} pageSize={25} />
        );
        expect(screen.getByText("row 25")).toBeTruthy();
        expect(screen.queryByText("row 26")).toBeNull();
        expect(screen.getByText("1 / 4")).toBeTruthy();

        fireEvent.click(screen.getByText("›"));
        expect(screen.getByText("row 26")).toBeTruthy();
        expect(screen.queryByText("row 25")).toBeNull();
        expect(screen.getByText("2 / 4")).toBeTruthy();
    });

    it("lists the page size it is given among the sizes to choose", () => {
        render(
            <PaginatedList rows={rows(100)} header={header} pageSize={25} />
        );
        // the selected size is shown on the select; open it to see them all
        fireEvent.click(screen.getByText("25 / page"));
        expect(
            screen.getAllByRole("option").map(node => node.textContent)
        ).toEqual([
            "10 / page",
            "20 / page",
            "25 / page",
            "30 / page",
            "40 / page",
            "50 / page",
            "100 / page"
        ]);
    });

    it("offers no page of more than 100 rows, however long the list is", () => {
        render(
            <PaginatedList rows={rows(5000)} header={header} pageSize={25} />
        );
        fireEvent.click(screen.getByText("25 / page"));
        const options = screen
            .getAllByRole("option")
            .map(node => node.textContent);
        expect(options[options.length - 1]).toBe("100 / page");
        expect(options).not.toContain("5000 / page");
        // 100 is the most, and a longer list is read page by page
        fireEvent.click(screen.getByText("100 / page"));
        expect(screen.getByText("row 100")).toBeTruthy();
        expect(screen.queryByText("row 101")).toBeNull();
        expect(screen.getByText("1 / 50")).toBeTruthy();
    });

    it("keeps the whole list as the last choice where it is shorter than 100, and takes no more than 100 for a page asked for", () => {
        const {unmount} = render(
            <PaginatedList rows={rows(73)} header={header} pageSize={25} />
        );
        fireEvent.click(screen.getByText("25 / page"));
        const options = screen
            .getAllByRole("option")
            .map(node => node.textContent);
        expect(options[options.length - 1]).toBe("73 / page");
        unmount();
        // a page size above the most is the most
        render(
            <PaginatedList rows={rows(300)} header={header} pageSize={250} />
        );
        expect(screen.getByText("row 100")).toBeTruthy();
        expect(screen.queryByText("row 101")).toBeNull();
    });

    it("tells when the reader steps to another page or chooses another page size, and not before", () => {
        const onPage = jest.fn();
        render(
            <PaginatedList
                rows={rows(100)}
                header={header}
                pageSize={25}
                onPage={onPage}
            />
        );
        expect(onPage).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText("›"));
        expect(onPage).toHaveBeenLastCalledWith(2, 25);
        fireEvent.click(screen.getByText("25 / page"));
        fireEvent.click(screen.getByText("50 / page"));
        expect(onPage).toHaveBeenLastCalledWith(1, 50);
        expect(onPage).toHaveBeenCalledTimes(2);
    });

    it("names the page size in the language of the page", () => {
        (counterpart as any).registerTranslations("de", {
            utility: {per_page: "%(count)s / Seite"}
        });
        (counterpart as any).setLocale("de");
        try {
            render(
                <PaginatedList rows={rows(100)} header={header} pageSize={25} />
            );
            expect(screen.getByText("25 / Seite")).toBeTruthy();
        } finally {
            (counterpart as any).setLocale("en");
        }
    });
});
