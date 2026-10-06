// Redux-backed replacement for the Alt.js TransactionConfirmActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves the exact
// method names and action-creator logic the original ran (including
// `broadcast()`'s multi-step async dispatch sequence), dispatching
// straight into `transactionConfirmSlice` instead of going through Alt's
// dispatcher/`bindActions` convention-based auto-binding - every call
// site (`confirm`/`broadcast`/`wasBroadcast`/`wasIncluded`/`close`/
// `error`/`togglePropose`/`proposeFeePayingAccount`) keeps working
// completely unchanged.
//
// Cross-store notification (the one deviation from the simple
// per-store template): the original `TransactionConfirmStore` auto-bound
// every one of this file's actions to an identically-named `onXxx`
// handler via Alt's `bindActions` convention. Separately,
// `BalanceClaimActiveStore` used `bindListeners` to *also* bind its own
// `onTransactionBroadcasted` handler to this same `wasBroadcast` action
// (`onTransactionBroadcasted: TransactionConfirmActions.wasBroadcast`).
// Alt's real dispatcher fired every listener bound to an action
// regardless of which store "owned" it; now that `wasBroadcast()`
// dispatches directly into `transactionConfirmSlice` instead, that
// implicit second listener is gone unless reproduced explicitly. The
// original `onTransactionBroadcasted` handler is not a pure state
// transition - it calls `refreshBalances()`, which does an async
// chain/DB lookup and then its own further `setState` calls - so it
// cannot be expressed as a plain reducer case dispatched alongside
// `wasBroadcast`'s own slice update. Instead, `wasBroadcast()` below
// calls `balanceClaimActiveStore.onTransactionBroadcasted()` directly -
// the exact same method the migrated `BalanceClaimActiveStore` facade
// uses internally to reproduce the original handler - making the
// cross-store notification explicit in code, in place of Alt's implicit
// `bindListeners` wiring. (In this codebase `wasBroadcast`/`wasIncluded`
// are themselves never invoked from any call site today - grep-verified
// - so this path is currently dead in practice, but the behavior is
// reproduced faithfully regardless.)
import {ChainConfig} from "bitsharesjs-ws";
import counterpart from "counterpart";
import ZfApi from "common/zfApi";
import {reduxStore} from "../store/reduxStore";
import {
    confirm as confirmAction,
    close as closeAction,
    broadcastPatch,
    wasBroadcast as wasBroadcastAction,
    wasIncluded as wasIncludedAction,
    setError,
    togglePropose as toggleProposeAction,
    proposeFeePayingAccount as proposeFeePayingAccountAction
} from "../store/slices/transactionConfirmSlice";
import balanceClaimActiveStore from "../stores/BalanceClaimActiveStore";

class TransactionConfirmActionsFacade {
    confirm(
        transaction: any,
        resolve?: (...args: any[]) => void,
        reject?: (...args: any[]) => void
    ) {
        reduxStore.dispatch(confirmAction({transaction, resolve, reject}));
        return {transaction, resolve, reject};
    }

    broadcast(
        transaction: any,
        resolve?: (...args: any[]) => void,
        reject?: (...args: any[]) => void
    ) {
        reduxStore.dispatch(
            broadcastPatch({broadcasting: true, closed: true})
        );

        const broadcast_timeout = setTimeout(() => {
            reduxStore.dispatch(
                broadcastPatch({
                    broadcast: false,
                    broadcasting: false,
                    error: counterpart.translate("trx_error.expire"),
                    closed: false
                })
            );
            if (reject) reject();
        }, ChainConfig.expire_in_secs * 2000);

        transaction
            .broadcast(() => {
                reduxStore.dispatch(
                    broadcastPatch({broadcasting: false, broadcast: true})
                );
            })
            .then((res: any) => {
                clearTimeout(broadcast_timeout);
                reduxStore.dispatch(
                    broadcastPatch({
                        error: null,
                        broadcasting: false,
                        broadcast: true,
                        included: true,
                        trx_id: res[0].id,
                        trx_block_num: res[0].block_num,
                        broadcasted_transaction: true
                    })
                );
                if (resolve) resolve(res);
            })
            .catch((error: any) => {
                console.error(error);
                clearTimeout(broadcast_timeout);
                // messages of length 1 are local exceptions (use the 1st line)
                // longer messages are remote API exceptions (use the 1st line)
                let message = "An error occured while broadcasting";
                let jsonError: any = {};

                // try to break down the error in human readable pieces
                let splitError = error.message.split("\n");
                let data, code;
                if (splitError.length == 1) {
                    message = splitError[0];
                } else if (splitError.length > 1) {
                    try {
                        jsonError = JSON.parse(splitError[1]);
                        data = jsonError.data;
                        code = jsonError.code;
                        message = jsonError.message;
                    } catch (err) {
                        // try to convert to JSON what's possible
                        splitError = splitError.map((text: string) => {
                            try {
                                const json_part = JSON.stringify(
                                    JSON.parse(
                                        text.substring(
                                            text.indexOf("{"),
                                            text.lastIndexOf("}") + 1
                                        )
                                    ),
                                    null,
                                    4
                                );
                                return (
                                    text.substring(0, text.indexOf("{")) +
                                    "\n" +
                                    json_part +
                                    "\n" +
                                    text.substring(
                                        text.lastIndexOf("}") + 1,
                                        text.length
                                    )
                                );
                            } catch (err) {
                                // nuthin
                                return text;
                            }
                        });
                        code = splitError[0];
                        data = splitError
                            .slice(1, splitError.length)
                            .join("\n");
                    }
                }
                reduxStore.dispatch(
                    broadcastPatch({
                        broadcast: false,
                        broadcasting: false,
                        error: message,
                        closed: false,
                        error_code: code,
                        error_data: data
                    })
                );
                if (reject) reject();
            });
    }

    wasBroadcast(res: any) {
        reduxStore.dispatch(wasBroadcastAction());
        // See this file's header: reproduces BalanceClaimActiveStore's
        // cross-binding to this action, explicitly.
        balanceClaimActiveStore.onTransactionBroadcasted();
        return res;
    }

    wasIncluded(res: any) {
        reduxStore.dispatch(wasIncludedAction(res));
        return res;
    }

    close(reject?: (...args: any[]) => void) {
        // Matches the original exactly: called unconditionally, not
        // guarded, since every known call site always provides it.
        (reject as any)();
        ZfApi.publish("transaction_confirm_actions", "close");
        reduxStore.dispatch(closeAction());
        return true;
    }

    error(msg: any) {
        reduxStore.dispatch(setError({error: msg}));
        return {error: msg};
    }

    togglePropose() {
        reduxStore.dispatch(toggleProposeAction());
        return true;
    }

    proposeFeePayingAccount(fee_paying_account: any) {
        reduxStore.dispatch(proposeFeePayingAccountAction(fee_paying_account));
        return fee_paying_account;
    }
}

export default new TransactionConfirmActionsFacade();
