import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {
    PortfolioRowActions,
    isAction
} from "../../components/Account/PortfolioRowActions";

describe("isAction", () => {
    it("is false for the empty cells of a row", () => {
        [null, undefined, false, "-"].forEach(cell =>
            expect(isAction(cell as any)).toBe(false)
        );
        expect(isAction(<a />)).toBe(true);
    });
});

describe("PortfolioRowActions", () => {
    it("shows the inline actions in the row and the others in a menu that names them", () => {
        const onDeposit = jest.fn();
        const {getByRole, getByText, queryByText, queryByRole} = render(
            <PortfolioRowActions
                menuLabel="More actions"
                inline={[
                    {
                        key: "send",
                        label: "Send",
                        node: <a data-testid="send">s</a>
                    }
                ]}
                menu={[
                    {
                        key: "deposit",
                        label: "Deposit",
                        node: <a onClick={onDeposit}>d</a>
                    },
                    {key: "withdraw", label: "Withdraw", node: "-"}
                ]}
            />
        );
        expect(queryByRole("menu")).toBeNull();
        fireEvent.click(getByRole("button", {name: "More actions"}));
        expect(getByRole("menu")).toBeTruthy();
        // an action the row does not have is not offered
        expect(queryByText("Withdraw")).toBeNull();
        // a click on the line is a click on the row's own link
        fireEvent.click(getByText("Deposit"));
        expect(onDeposit).toHaveBeenCalledTimes(1);
        expect(queryByRole("menu")).toBeNull();
    });

    it("shows no menu button when the row has nothing for it", () => {
        const {queryByRole} = render(
            <PortfolioRowActions
                menuLabel="More actions"
                inline={[]}
                menu={[{key: "x", label: "X", node: "-"}]}
            />
        );
        expect(queryByRole("button")).toBeNull();
    });

    it("closes on Escape", () => {
        const {getByRole, queryByRole} = render(
            <PortfolioRowActions
                menuLabel="More actions"
                inline={[]}
                menu={[{key: "x", label: "X", node: <a>x</a>}]}
            />
        );
        fireEvent.click(getByRole("button", {name: "More actions"}));
        expect(getByRole("menu")).toBeTruthy();
        fireEvent.keyDown(document, {key: "Escape"});
        expect(queryByRole("menu")).toBeNull();
    });
});
