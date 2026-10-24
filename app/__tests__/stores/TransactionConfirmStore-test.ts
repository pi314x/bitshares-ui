import TransactionConfirmStore from "../../stores/TransactionConfirmStore";
import {reduxStore} from "../../store/reduxStore";
import {close, confirm} from "../../store/slices/transactionConfirmSlice";

describe("TransactionConfirmStore.listen", () => {
    afterEach(() => TransactionConfirmStore.reset());

    // The Send dialog, the account creation and the invoice payment register a function that reads
    // `state.included` / `state.closed`. The facade called them without the state: they threw on
    // the next change of the store, inside Redux's dispatch, and the next transaction of the
    // session was stopped half way without a message (a Send, then any other transaction).
    it("hands the store's state to the listener", () => {
        const seen: any[] = [];
        const listener = (state: any) => seen.push(state);
        // a transaction is up for confirmation (the store is open), then it is closed
        reduxStore.dispatch(confirm({transaction: {}}));
        TransactionConfirmStore.listen(listener);
        reduxStore.dispatch(close());
        TransactionConfirmStore.unlisten(listener);
        expect(seen).toHaveLength(1);
        expect(seen[0]).toBe(TransactionConfirmStore.getState());
        expect(seen[0].closed).toBe(true);
    });

    it("does not call a listener that was removed", () => {
        const listener = jest.fn();
        reduxStore.dispatch(confirm({transaction: {}}));
        TransactionConfirmStore.listen(listener);
        TransactionConfirmStore.unlisten(listener);
        reduxStore.dispatch(close());
        expect(listener).not.toHaveBeenCalled();
    });

    it("lets a listener that reads the state run through a whole sequence", () => {
        // what SendModal's onTrxIncluded does: read `included` / `closed`, and stop listening
        const onIncluded = (state: any) => {
            if (state.included && state.broadcasted_transaction) {
                TransactionConfirmStore.unlisten(onIncluded);
            } else if (state.closed) {
                TransactionConfirmStore.unlisten(onIncluded);
                TransactionConfirmStore.reset();
            }
        };
        reduxStore.dispatch(confirm({transaction: {}}));
        TransactionConfirmStore.listen(onIncluded);
        expect(() => reduxStore.dispatch(close())).not.toThrow();
    });
});
