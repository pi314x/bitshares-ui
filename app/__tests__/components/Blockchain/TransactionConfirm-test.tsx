import * as React from "react";
import {render, act} from "@testing-library/react";
// The operation renderer pulls in the whole component tree (and webpack-only
// `require.context` calls); the closed dialog never renders it.
jest.mock("components/Blockchain/Operation", () => () => null);
jest.mock("../../../components/Utility/HelpContent", () => () => null);
import TransactionConfirm from "../../../components/Blockchain/TransactionConfirm";

// Regression: with the dialog closed, an effect without dependencies set a new
// (equal) state after every render - "Maximum update depth exceeded".
describe("TransactionConfirm", () => {
    it("renders closed without an update loop", async () => {
        const errors: string[] = [];
        const spy = jest
            .spyOn(console, "error")
            .mockImplementation((...args: any[]) => {
                errors.push(args.map(String).join(" "));
            });
        const {rerender} = render(<TransactionConfirm />);
        // The loop starts with the first update after mount.
        rerender(<TransactionConfirm />);
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
        });
        spy.mockRestore();
        expect(errors.filter(e => /Maximum update depth/.test(e))).toEqual([]);
    });
});
