// TypeScript/functional-component port of the legacy CreateWorker.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's `connect
// (CreateWorker, {listenTo, getProps})` alt-react HOC is replaced by
// `useAltStore(AccountStore)`.
//
// Preserved verbatim (not "fixed"):
// - `shouldComponentUpdate` used the comma operator
//   (`return (np.currentAccount !== this.props.currentAccount,
//   !utils.are_equal_shallow(ns, this.state));`), which evaluates the
//   first expression and discards it, so the function actually only ever
//   returned the *second* expression - `currentAccount` prop changes
//   never factored into the (buggy) render-skip decision at all. Since
//   this was a pure perf guard either way (no `componentDidUpdate`
//   depended on it), it's simply dropped, per this migration's
//   established treatment of pure perf guards.
// - `console.log("state:", this.state);` at the top of `render()` - a
//   leftover debug log that fires on every render.
import * as React from "react";
import ApplicationApi from "api/ApplicationApi";
import AccountStore from "stores/AccountStore";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import {Notification} from "../../design-system/Notification";
import {useAltStore} from "../../next/hooks/useAltStore";

interface CreateWorkerState {
    title: string | null;
    start: Date;
    end: Date | null;
    pay: string | null;
    url: string;
    vesting: number;
}

function CreateWorker({currentAccount}: {currentAccount: any}) {
    const [state, setState] = React.useState<CreateWorkerState>({
        title: null,
        start: new Date(),
        end: null,
        pay: null,
        url: "http://",
        vesting: 7
    });

    const mergeState = (partial: Partial<CreateWorkerState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const onSubmit = () => {
        (ApplicationApi as any)
            .createWorker(state, currentAccount)
            .catch((error: any) => {
                console.log("error", error);
                const error_msg =
                    error.message &&
                    error.message.length &&
                    error.message.length > 0
                        ? error.message.split("stack")[0]
                        : "unknown error";

                Notification.error({
                    message: counterpart.translate(
                        "notifications.worker_create_failure",
                        {
                            error_msg: error_msg
                        }
                    )
                });
            });
    };

    console.log("state:", state);
    return (
        <div className="grid-block" style={{paddingTop: 20}}>
            <div className="grid-content large-9 large-offset-3 small-12">
                <Translate content="explorer.workers.create" component="h3" />
                <form style={{maxWidth: 800}}>
                    <Translate
                        content="explorer.workers.create_text_1"
                        component="p"
                    />
                    <Translate
                        content="explorer.workers.create_text_2"
                        component="p"
                    />

                    <label>
                        <Translate content="explorer.workers.title" />
                        <input
                            onChange={e => {
                                mergeState({title: e.target.value});
                            }}
                            type="text"
                        />
                    </label>
                    <Translate
                        content="explorer.workers.name_text"
                        component="p"
                    />
                    <div
                        style={{
                            width: "50%",
                            paddingRight: "2.5%",
                            display: "inline-block"
                        }}
                    >
                        <label>
                            <Translate content="account.votes.start" />
                            <input
                                onChange={e => {
                                    mergeState({
                                        start: new Date(e.target.value)
                                    });
                                }}
                                type="date"
                            />
                        </label>
                    </div>
                    <div
                        style={{
                            width: "50%",
                            paddingLeft: "2.5%",
                            display: "inline-block"
                        }}
                    >
                        <label>
                            <Translate content="account.votes.end" />
                            <input
                                onChange={e => {
                                    mergeState({end: new Date(e.target.value)});
                                }}
                                type="date"
                            />
                        </label>
                    </div>
                    <Translate content="explorer.workers.date_text" component="p" />

                    <label>
                        <Translate content="explorer.workers.daily_pay" />
                        <input
                            onChange={e => {
                                mergeState({pay: e.target.value});
                            }}
                            type="number"
                        />
                    </label>
                    <Translate content="explorer.workers.pay_text" component="p" />

                    <label>
                        <Translate content="explorer.workers.website" />
                        <input
                            onChange={e => {
                                mergeState({url: e.target.value});
                            }}
                            type="text"
                        />
                    </label>
                    <Translate content="explorer.workers.url_text" component="p" />

                    <label>
                        <Translate content="explorer.workers.vesting_pay" />
                        <input
                            defaultValue={state.vesting}
                            onChange={e => {
                                mergeState({
                                    vesting: parseInt(e.target.value)
                                });
                            }}
                            type="number"
                        />
                    </label>
                    <Translate
                        content="explorer.workers.vesting_text"
                        component="p"
                    />

                    <div className="button-group" onClick={onSubmit}>
                        <div className="button" {...({type: "submit"} as any)}>
                            Publish
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

function CreateWorkerContainer() {
    const accountState = useAltStore<any>(AccountStore);
    return <CreateWorker currentAccount={accountState.currentAccount} />;
}

export default CreateWorkerContainer;
