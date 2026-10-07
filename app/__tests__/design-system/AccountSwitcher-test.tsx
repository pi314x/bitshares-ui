import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {AccountSwitcher} from "../../design-system/AccountSwitcher";

describe("design-system/AccountSwitcher", () => {
    it("shows the current account on the trigger and the account list closed by default", () => {
        const {getByText, queryByRole} = render(
            <AccountSwitcher
                currentAccount="init0"
                accounts={["init0", "init1"]}
                onSelect={() => {}}
            />
        );
        expect(getByText("init0")).toBeTruthy();
        expect(queryByRole("menu")).toBeNull();
    });

    it("opens the menu and calls onSelect with the clicked account", () => {
        const onSelect = jest.fn();
        const {getByText} = render(
            <AccountSwitcher
                currentAccount="init0"
                accounts={["init0", "init1"]}
                onSelect={onSelect}
            />
        );
        fireEvent.click(getByText("init0"));
        fireEvent.click(getByText("init1"));
        expect(onSelect).toHaveBeenCalledWith("init1");
    });

    it("shows a placeholder when there are no accounts", () => {
        const {getByText} = render(
            <AccountSwitcher
                currentAccount={null}
                accounts={[]}
                onSelect={() => {}}
            />
        );
        fireEvent.click(getByText("No account"));
        expect(getByText("No accounts")).toBeTruthy();
    });
});
