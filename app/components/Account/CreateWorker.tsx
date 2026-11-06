// TypeScript/functional-component port of the legacy CreateWorker.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's `connect
// (CreateWorker, {listenTo, getProps})` alt-react HOC is replaced by
// `useReduxState(selectAccountState)`.
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
import counterpart from "counterpart";
import {Notification} from "../../design-system/Notification";
import {PageHead} from "../../design-system/PageHead";
import {Card} from "../../design-system/Card";
import {Form} from "../../design-system/Form";
import {Input} from "../../design-system/Input";
import {Button} from "../../design-system/Button";
import {ButtonRow} from "../../design-system/ButtonRow";
import styles from "./CreateWorker.module.scss";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";

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

    const t = (key: string) =>
        counterpart.translate(`explorer.workers.${key}`) as string;

    return (
        <div className={styles.page}>
            <PageHead
                title={t("create")}
                lead={t("create_text_1")}
                note={t("create_text_2")}
            />
            <Card className={styles.card}>
                <Form
                    layout="vertical"
                    onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                        e.preventDefault();
                        onSubmit();
                    }}
                >
                    <Form.Item label={t("title")} help={t("name_text")}>
                        <Input
                            type="text"
                            onChange={e => mergeState({title: e.target.value})}
                        />
                    </Form.Item>
                    <div className={styles.dates}>
                        <Form.Item
                            label={counterpart.translate("account.votes.start")}
                        >
                            <Input
                                type="date"
                                onChange={e =>
                                    mergeState({
                                        start: new Date(e.target.value)
                                    })
                                }
                            />
                        </Form.Item>
                        <Form.Item
                            label={counterpart.translate("account.votes.end")}
                        >
                            <Input
                                type="date"
                                onChange={e =>
                                    mergeState({end: new Date(e.target.value)})
                                }
                            />
                        </Form.Item>
                    </div>
                    <p className={styles.help}>{t("date_text")}</p>
                    <Form.Item label={t("daily_pay")} help={t("pay_text")}>
                        <Input
                            type="number"
                            onChange={e => mergeState({pay: e.target.value})}
                        />
                    </Form.Item>
                    <Form.Item label={t("website")} help={t("url_text")}>
                        <Input
                            type="text"
                            onChange={e => mergeState({url: e.target.value})}
                        />
                    </Form.Item>
                    <Form.Item
                        label={t("vesting_pay")}
                        help={t("vesting_text")}
                    >
                        <Input
                            type="number"
                            defaultValue={state.vesting}
                            onChange={e =>
                                mergeState({vesting: parseInt(e.target.value)})
                            }
                        />
                    </Form.Item>
                    <ButtonRow>
                        <Button variant="accent" onClick={onSubmit}>
                            {counterpart.translate(
                                "account.perm.publish_prediction"
                            )}
                        </Button>
                    </ButtonRow>
                </Form>
            </Card>
        </div>
    );
}

function CreateWorkerContainer() {
    const accountState = useReduxState<any>(selectAccountState);
    return <CreateWorker currentAccount={accountState.currentAccount} />;
}

export default CreateWorkerContainer;
