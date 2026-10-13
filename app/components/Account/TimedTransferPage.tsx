import * as React from "react";
import {Link} from "react-router-dom";
import counterpart from "counterpart";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import {Button} from "../../design-system/Button";
import {Alert} from "../../design-system/Alert";
import SametFundActions, {AccountInfo} from "../../actions/SametFundActions";
import TimedTransferModal from "./TimedTransferModal";
import styles from "./TimedTransferPage.module.scss";

const TypedLink = Link as React.ComponentType<any>;

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`timed_transfer.${key}`, params);

// The same dialog as on the Vesting page, as a page of its own so it can be
// reached from the main menu: what a timed transfer is, how it works, and the
// button that opens the dialog for the selected account.
export default function TimedTransferPage() {
    const accountState = useReduxState<any>(selectAccountState);
    const accountName: string | null =
        accountState.currentAccount || accountState.passwordAccount || null;
    const [creator, setCreator] = React.useState<AccountInfo | null>(null);
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        setCreator(null);
        if (!accountName) return;
        let cancelled = false;
        SametFundActions.getAccountByName(accountName)
            .then(info => {
                if (!cancelled) setCreator(info);
            })
            .catch(() => {
                if (!cancelled) setCreator(null);
            });
        return () => {
            cancelled = true;
        };
    }, [accountName]);

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>{t("title")}</h1>
            <p className={styles.intro}>{t("page_intro")}</p>

            <ol className={styles.steps}>
                <li className={styles.step}>{t("step1")}</li>
                <li className={styles.step}>{t("step2")}</li>
                <li className={styles.step}>{t("step3")}</li>
            </ol>

            {accountName ? (
                <div className={styles.actions}>
                    <Button
                        variant="accent"
                        disabled={!creator}
                        onClick={() => setOpen(true)}
                    >
                        {t("open")}
                    </Button>
                    <TypedLink
                        className={styles.link}
                        to={`/account/${accountName}/vesting`}
                    >
                        {t("claim_link")}
                    </TypedLink>
                </div>
            ) : (
                <Alert type="info" message={t("no_account")} />
            )}

            <p className={styles.note}>{t("irreversible")}</p>

            {creator ? (
                <TimedTransferModal
                    visible={open}
                    creator={creator}
                    onCancel={() => setOpen(false)}
                    onDone={() => setOpen(false)}
                />
            ) : null}
        </div>
    );
}
