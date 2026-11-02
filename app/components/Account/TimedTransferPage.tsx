import * as React from "react";
import {Link} from "react-router-dom";
import counterpart from "counterpart";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import {Alert} from "../../design-system/Alert";
import SametFundActions, {AccountInfo} from "../../actions/SametFundActions";
import {useLeave} from "../../next/desktopModal";
import TimedTransferForm from "./TimedTransferForm";
import styles from "../../next/PaymentPages.module.scss";

const TypedLink = Link as React.ComponentType<any>;

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`timed_transfer.${key}`, params);

// Timed transfer, as a page of its own (menu: Payments): what it is, the form as cards, and the summary with the
// button beside them. Nothing opens over anything: it is a page on a phone and on a desktop alike.
export default function TimedTransferPage() {
    const accountState = useReduxState<any>(selectAccountState);
    const accountName: string | null =
        accountState.currentAccount || accountState.passwordAccount || null;
    const [creator, setCreator] = React.useState<AccountInfo | null>(null);
    // a new form after a transfer was made
    const [round, setRound] = React.useState(0);
    const leave = useLeave();

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

    if (!accountName) {
        return (
            <div className={styles.page}>
                <Alert type="info" message={t("no_account")} />
            </div>
        );
    }
    if (!creator) return null;
    return (
        <TimedTransferForm
            key={round}
            creator={creator}
            onCancel={leave}
            onDone={() => setRound(r => r + 1)}
            claimLink={
                <TypedLink to={`/account/${accountName}/vesting`}>
                    {t("claim_link")}
                </TypedLink>
            }
        />
    );
}
