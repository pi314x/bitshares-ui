// How to sign with the BitShares wallet browser extension (More -> Wallet extension): what it does, what it needs, how to
// install and connect it, how a transaction is signed, what does not work with it and how to stay safe. The text is
// fixed; only the first card is live, it says whether the extension is connected (the same words as Settings -> Signing)
// and connects it (the top bar's button does the same, and a failed connect leads to Settings -> Signing).
import * as React from "react";
import counterpart from "counterpart";
import {Link, useNavigate} from "react-router-dom";
import {Button} from "../../design-system/Button";
import {ButtonRow} from "../../design-system/ButtonRow";
import {PageHead} from "../../design-system/PageHead";
import {useReduxState} from "../../next/hooks/useReduxState";
import {connectFromChip} from "../../next/extensionChip";
import {selectExternalSigner} from "../../store/slices/externalSignerSlice";
import styles from "./ExtensionGuide.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`extension_guide.${key}`, params) as string;

const RELEASES =
    "https://github.com/pi314x/bitshares-wallet-browser-extension/releases";
const SITE = "https://pi314x.github.io/bitshares-wallet-browser-extension";

function Card(props: {title: string; children: React.ReactNode}) {
    return (
        <section className={styles.card}>
            <div className={styles.head}>
                <div className={styles.cardTitle} role="heading" aria-level={2}>
                    {props.title}
                </div>
            </div>
            <div className={styles.body}>{props.children}</div>
        </section>
    );
}

function List(props: {ordered?: boolean; keys: string[]}) {
    const Tag = props.ordered ? "ol" : "ul";
    return (
        <Tag className={styles.list}>
            {props.keys.map(key => (
                <li key={key}>{t(key)}</li>
            ))}
        </Tag>
    );
}

/** Whether the extension is connected, as Settings -> Signing says it, with the button that connects it. */
function Status() {
    const state = useReduxState(selectExternalSigner);
    const navigate = useNavigate();
    const connected = state.status === "connected" && !!state.account;
    const connecting = state.status === "connecting";
    // the extension was found and is not connected: the only state in which a click can connect it
    const canConnect = state.status === "disconnected" || connecting;
    return (
        <Card title={t("status_title")}>
            <p className={styles.status} data-testid="extension-status">
                {connected
                    ? (counterpart.translate(
                          "externalSigner.status_connected",
                          {
                              account: state.account!.accountName
                          }
                      ) as string)
                    : (counterpart.translate(
                          "externalSigner.status_" + state.status
                      ) as string)}
            </p>
            {connected && state.locked === true ? (
                <p className={styles.warning}>
                    {counterpart.translate("externalSigner.locked") as string}
                </p>
            ) : null}
            <ButtonRow>
                {canConnect ? (
                    <Button
                        variant="accent"
                        disabled={connecting}
                        onClick={() => {
                            void connectFromChip(navigate);
                        }}
                    >
                        {t("connect_button")}
                    </Button>
                ) : null}
                <Link className={styles.link} to="/settings/signing">
                    {t("settings_link")}
                </Link>
            </ButtonRow>
        </Card>
    );
}

export default function ExtensionGuide(): JSX.Element {
    return (
        <div className={styles.page}>
            <PageHead
                className={styles.pageHead}
                title={t("title")}
                lead={t("lead")}
            />
            <Status />
            <Card title={t("what_title")}>
                <List keys={["what_1", "what_2"]} />
            </Card>
            <Card title={t("need_title")}>
                <List keys={["need_1", "need_2", "need_3"]} />
            </Card>
            <Card title={t("install_title")}>
                <ol className={styles.list}>
                    <li>{t("install_1")}</li>
                    <li>
                        {t("install_load")}
                        <ul className={styles.list}>
                            <li>{t("install_chrome")}</li>
                            <li>{t("install_firefox")}</li>
                        </ul>
                    </li>
                    <li>{t("install_wallet")}</li>
                </ol>
                <div className={styles.links}>
                    <a
                        className={styles.link}
                        href={RELEASES}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {t("link_releases")}
                    </a>
                    <a
                        className={styles.link}
                        href={SITE}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {t("link_site")}
                    </a>
                </div>
            </Card>
            <Card title={t("connect_title")}>
                <List
                    ordered
                    keys={["connect_1", "connect_2", "connect_3", "connect_4"]}
                />
                <p className={styles.muted}>{t("connect_5")}</p>
            </Card>
            <Card title={t("sign_title")}>
                <List ordered keys={["sign_1", "sign_2", "sign_3"]} />
            </Card>
            <Card title={t("limits_title")}>
                <List keys={["limits_1", "limits_2", "limits_3", "limits_4"]} />
            </Card>
            <Card title={t("safe_title")}>
                <List keys={["safe_1", "safe_2", "safe_3", "safe_4"]} />
            </Card>
        </div>
    );
}
