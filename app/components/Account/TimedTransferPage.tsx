import * as React from "react";
import {Link, useNavigate} from "react-router-dom";
import counterpart from "counterpart";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import {Alert} from "../../design-system/Alert";
import SametFundActions, {AccountInfo} from "../../actions/SametFundActions";
import {ModalAsPage} from "../../design-system/Modal";
import TimedTransferModal from "./TimedTransferModal";
import styles from "../../next/PaymentPages.module.scss";

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
    const navigate = useNavigate();
    const [creator, setCreator] = React.useState<AccountInfo | null>(null);
    // a new form after a transfer was made (the dialog is the page's own card)
    const [round, setRound] = React.useState(0);

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

    const leave = () => {
        if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
        } else {
            navigate("/", {replace: true});
        }
    };

    return (
        <div className={styles.page}>
            {accountName ? (
                creator ? (
                    <ModalAsPage>
                        <TimedTransferModal
                            key={round}
                            visible={true}
                            creator={creator}
                            onCancel={leave}
                            onDone={() => setRound(r => r + 1)}
                        />
                    </ModalAsPage>
                ) : null
            ) : (
                <Alert type="info" message={t("no_account")} />
            )}

            {accountName ? (
                <p className={styles.links}>
                    <TypedLink to={`/account/${accountName}/vesting`}>
                        {t("claim_link")}
                    </TypedLink>
                </p>
            ) : null}

            <p className={styles.intro}>{t("page_intro")}</p>
            <ol className={styles.steps}>
                <li>{t("step1")}</li>
                <li>{t("step2")}</li>
                <li>{t("step3")}</li>
            </ol>
        </div>
    );
}
