import * as React from "react";
import {render, act} from "@testing-library/react";
// The operation renderer pulls in the whole component tree (and webpack-only
// `require.context` calls); the closed dialog never renders it.
jest.mock("components/Blockchain/Operation", () => () => null);
jest.mock("components/Blockchain/Transaction", () => () => null);
jest.mock("../../../components/Utility/HelpContent", () => () => null);
import TransactionConfirm from "../../../components/Blockchain/TransactionConfirm";
import TransactionConfirmStore from "../../../stores/TransactionConfirmStore";
import {reduxStore} from "../../../store/reduxStore";
import {
    confirm,
    wasBroadcast,
    wasIncluded
} from "../../../store/slices/transactionConfirmSlice";

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

    // The Send dialog resets the store as soon as the confirmation is closed (its listener); the
    // chain's answer "included" comes a few seconds later, onto the reset store. The dialog's
    // "transaction confirmed" notification is built from the transaction in the store: it read
    // `null.serialize()` in an effect and React unmounted the whole app (a blank page a few
    // seconds after a transfer; found on the testnet once the listener worked).
    it("survives the store being reset before the transaction is included", async () => {
        const fakeTransaction = {
            serialize: () => ({
                operations: [
                    [
                        0,
                        {
                            fee: {amount: 0, asset_id: "1.3.0"},
                            from: "1.2.1",
                            to: "1.2.2",
                            amount: {amount: 1, asset_id: "1.3.0"}
                        }
                    ]
                ]
            }),
            has_proposed_operation: () => false,
            update_head_block: () => Promise.resolve(),
            finalize: () => Promise.resolve()
        };
        const crashes: any[] = [];
        const onError = (e: any) => crashes.push(e.error || e);
        window.addEventListener("error", onError);
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        const view = render(<TransactionConfirm />);
        await act(async () => {
            reduxStore.dispatch(confirm({transaction: fakeTransaction}));
        });
        await act(async () => {
            reduxStore.dispatch(wasBroadcast());
        });
        // the confirmation is closed: the listener of the Send dialog resets the store
        await act(async () => {
            TransactionConfirmStore.reset();
        });
        // ... and then the chain says the transaction is included
        await act(async () => {
            reduxStore.dispatch(wasIncluded([{id: "1", block_num: 1}]));
            await new Promise(resolve => setTimeout(resolve, 50));
        });
        spy.mockRestore();
        window.removeEventListener("error", onError);
        TransactionConfirmStore.reset();
        expect(crashes).toEqual([]);
        // still mounted (an error in an effect unmounts the tree)
        expect(view.container.isConnected).toBe(true);
    });
});
