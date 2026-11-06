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

    it("marks an account with its badge in the menu", () => {
        const {getByText, getAllByRole} = render(
            <AccountSwitcher
                currentAccount="init0"
                accounts={["wallet-acct", "init0"]}
                badges={{"wallet-acct": "Extension"}}
                onSelect={() => {}}
            />
        );
        fireEvent.click(getByText("init0"));
        const items = getAllByRole("menuitem");
        expect(items[0].textContent).toBe("wallet-acctExtension");
        expect(items[1].textContent).toBe("init0");
    });

    it("lists followed accounts after the user's own and selects them", () => {
        const onSelect = jest.fn();
        const {getByText, getAllByRole} = render(
            <AccountSwitcher
                currentAccount="init0"
                accounts={["init0"]}
                followedAccounts={["friend"]}
                onSelect={onSelect}
            />
        );
        fireEvent.click(getByText("init0"));
        expect(getByText("Followed")).toBeTruthy();
        expect(getAllByRole("menuitem").map(i => i.textContent)).toEqual([
            "init0",
            "friend"
        ]);
        fireEvent.click(getByText("friend"));
        expect(onSelect).toHaveBeenCalledWith("friend");
    });

    it("offers to follow, then unfollow, the account being looked at", () => {
        const onToggle = jest.fn();
        const {getByText, rerender} = render(
            <AccountSwitcher
                currentAccount="stranger"
                accounts={["init0"]}
                onSelect={() => {}}
                follow={{following: false, onToggle}}
            />
        );
        fireEvent.click(getByText("stranger"));
        fireEvent.click(getByText("Follow stranger"));
        expect(onToggle).toHaveBeenCalledTimes(1);
        rerender(
            <AccountSwitcher
                currentAccount="stranger"
                accounts={["init0"]}
                onSelect={() => {}}
                follow={{following: true, onToggle}}
            />
        );
        fireEvent.click(getByText("stranger"));
        expect(getByText("Unfollow stranger")).toBeTruthy();
    });
});
