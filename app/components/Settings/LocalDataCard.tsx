// Settings -> Accounts: what this device holds for the wallet, read live - the wallet
// (and whether it is locked), the keys stored in this browser, the accounts, the
// extension, the saved preferences. The start-up screen lists the same things while
// it reads them. Counts and names only.
import * as React from "react";
import counterpart from "counterpart";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectWalletManagerState} from "../../store/slices/walletManagerSlice";
import {selectPrivateKeyState} from "../../store/slices/privateKeySlice";
import {selectWalletUnlockState} from "../../store/slices/walletUnlockSlice";
import {selectAccountState} from "../../store/slices/accountSlice";
import {selectSettingsState} from "../../store/slices/settingsSlice";
import {selectExternalSigningActive} from "../../store/slices/externalSignerSlice";
import {reduxStore} from "../../store/reduxStore";
import {localFacts} from "../../lib/common/localData";
import {Button} from "../../design-system/Button";
import DeleteLocalDialog from "./DeleteLocalDialog";
import styles from "./LocalDataCard.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`settings.local_data.${key}`, params) as string;

export default function LocalDataCard() {
    const [deleting, setDeleting] = React.useState(false);
    const walletManager = useReduxState<any>(selectWalletManagerState);
    const privateKeys = useReduxState<any>(selectPrivateKeyState);
    const unlock = useReduxState<any>(selectWalletUnlockState);
    const account = useReduxState<any>(selectAccountState);
    const settings = useReduxState<any>(selectSettingsState);
    const extensionOn = selectExternalSigningActive(reduxStore.getState());

    const facts = localFacts({
        walletNames: walletManager.wallet_names
            ? walletManager.wallet_names.toArray()
            : [],
        currentWallet: walletManager.current_wallet || null,
        passwordLogin: !!settings.settings.get("passwordLogin"),
        locked: !!unlock.locked,
        keyCount: privateKeys.keys ? privateKeys.keys.size : 0,
        linkedAccounts: account.linkedAccounts
            ? account.linkedAccounts.size
            : 0,
        hiddenAccounts: account.myHiddenAccounts
            ? account.myHiddenAccounts.size
            : 0,
        currentAccount: account.currentAccount || null,
        extensionConnected: !!extensionOn,
        language: settings.settings.get("locale") || null,
        theme:
            (settings.settings.get("themes") || "").replace("Theme", "") ||
            null,
        node: settings.settings.get("activeNode") || null
    });

    return (
        <section className={styles.card} aria-label={t("title")}>
            <h3 className={styles.title}>{t("title")}</h3>
            <dl className={styles.list}>
                {facts.map(fact => (
                    <div key={fact.id} className={styles.row}>
                        <dt className={styles.label}>
                            {t(`label_${fact.id}`)}
                        </dt>
                        <dd
                            className={`${styles.value} ${
                                fact.tone === "ok"
                                    ? styles.ok
                                    : fact.tone === "warn"
                                    ? styles.warn
                                    : ""
                            }`}
                        >
                            {t(fact.value, fact.params)}
                        </dd>
                    </div>
                ))}
            </dl>
            <p className={styles.note}>{t("note")}</p>
            <div className={styles.danger}>
                <Button onClick={() => setDeleting(true)}>
                    {t("delete.button")}
                </Button>
                <span className={styles.dangerHint}>{t("delete.hint")}</span>
            </div>
            <DeleteLocalDialog
                visible={deleting}
                onCancel={() => setDeleting(false)}
            />
        </section>
    );
}
