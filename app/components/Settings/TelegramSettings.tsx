// Settings -> Notifications: the Telegram bot the app writes to when something happens in the user's wallets
// (see lib/common/telegram.ts for what is sent and how). The token and the chat are saved with "Save"; the
// switch and the topics are kept at once. Nothing is sent until a valid token and chat are saved and the
// switch is on.
import * as React from "react";
import counterpart from "counterpart";
import {Button} from "../../design-system/Button";
import {Checkbox} from "../../design-system/Checkbox";
import {Input} from "../../design-system/Input";
import {Switch} from "../../design-system/Switch";
import {
    TELEGRAM_TOPICS,
    TelegramSettings as Settings,
    TelegramTopic,
    clearTelegram,
    findChatId,
    lastTelegramResult,
    loadTelegram,
    saveTelegram,
    sendTelegram,
    subscribeTelegram,
    validChatId,
    validToken
} from "../../lib/common/telegram";
import styles from "./TelegramSettings.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`telegram.${key}`, params) as string;

/** Telegram's own words for a failure, or ours for the three that are the browser's. */
function reasonText(error: string): string {
    return ["token", "chat", "network", "no_message"].includes(error)
        ? t(`error_${error}`)
        : error;
}

type Note = {kind: "ok" | "bad"; text: string} | null;

export default function TelegramSettings() {
    const [saved, setSaved] = React.useState<Settings>(() => loadTelegram());
    const [token, setToken] = React.useState(saved.token);
    const [chat, setChat] = React.useState(saved.chatId);
    const [note, setNote] = React.useState<Note>(null);
    const [busy, setBusy] = React.useState(false);
    const last = React.useSyncExternalStore(
        subscribeTelegram,
        lastTelegramResult,
        () => null
    );

    const tokenOk = validToken(token.trim());
    const chatOk = validChatId(chat.trim());
    const ready = saved.token !== "" && saved.chatId !== "";
    const dirty = token.trim() !== saved.token || chat.trim() !== saved.chatId;

    const keep = (next: Settings) => {
        saveTelegram(next);
        setSaved(loadTelegram());
    };

    const save = () => {
        if (!tokenOk) return setNote({kind: "bad", text: t("error_token")});
        if (!chatOk) return setNote({kind: "bad", text: t("error_chat")});
        keep({...saved, token: token.trim(), chatId: chat.trim()});
        setNote({kind: "ok", text: t("saved")});
    };

    const find = async () => {
        if (!tokenOk) return setNote({kind: "bad", text: t("error_token")});
        setBusy(true);
        const found = await findChatId(token.trim());
        setBusy(false);
        if (found.ok) {
            setChat(found.chatId);
            setNote({
                kind: "ok",
                text: t("found_chat", {title: found.title || found.chatId})
            });
        } else {
            setNote({kind: "bad", text: reasonText(found.error)});
        }
    };

    const test = async () => {
        if (!tokenOk) return setNote({kind: "bad", text: t("error_token")});
        if (!chatOk) return setNote({kind: "bad", text: t("error_chat")});
        setBusy(true);
        const result = await sendTelegram(
            {token: token.trim(), chatId: chat.trim()},
            t("test_message")
        );
        setBusy(false);
        setNote(
            result.ok
                ? {kind: "ok", text: t("test_sent")}
                : {kind: "bad", text: reasonText(result.error)}
        );
    };

    const remove = () => {
        clearTelegram();
        const empty = loadTelegram();
        setSaved(empty);
        setToken("");
        setChat("");
        setNote(null);
    };

    const topicChanged = (topic: TelegramTopic, on: boolean) =>
        keep({...saved, topics: {...saved.topics, [topic]: on}});

    return (
        <div className={styles.panel}>
            <p className={styles.intro}>{t("intro")}</p>
            <p className={styles.step}>{t("step_bot")}</p>
            <p className={styles.step}>{t("step_chat")}</p>

            <div className={styles.fields}>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="telegram-token">
                        {t("token")}
                    </label>
                    <Input
                        id="telegram-token"
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        value={token}
                        onChange={(e: any) => setToken(e.target.value)}
                        aria-label={t("token")}
                    />
                </div>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="telegram-chat">
                        {t("chat")}
                    </label>
                    <div className={styles.row}>
                        <Input
                            id="telegram-chat"
                            autoComplete="off"
                            spellCheck={false}
                            value={chat}
                            onChange={(e: any) => setChat(e.target.value)}
                            aria-label={t("chat")}
                        />
                        <Button disabled={busy || !tokenOk} onClick={find}>
                            {t("find_chat")}
                        </Button>
                    </div>
                </div>
            </div>

            <div className={styles.actions}>
                <Button
                    variant="accent"
                    disabled={busy || !dirty || !tokenOk || !chatOk}
                    onClick={save}
                >
                    {t("save")}
                </Button>
                <Button disabled={busy || !tokenOk || !chatOk} onClick={test}>
                    {t("test")}
                </Button>
                <Button
                    disabled={busy || (!ready && token === "" && chat === "")}
                    onClick={remove}
                >
                    {t("remove")}
                </Button>
            </div>
            {note ? (
                <p
                    className={`${styles.note} ${
                        note.kind === "ok" ? styles.ok : styles.bad
                    }`}
                    role="status"
                >
                    {note.text}
                </p>
            ) : null}

            {ready ? (
                <div className={styles.switchRow}>
                    <Switch
                        checked={saved.enabled}
                        onChange={on => keep({...saved, enabled: on})}
                    />
                    <span>{t("enabled")}</span>
                </div>
            ) : (
                <p className={styles.note}>{t("needs_saved")}</p>
            )}

            <p className={styles.heading}>{t("topics")}</p>
            <div className={styles.topics}>
                {TELEGRAM_TOPICS.map(topic => (
                    <Checkbox
                        key={topic}
                        checked={saved.topics[topic]}
                        onChange={event =>
                            topicChanged(topic, event.target.checked)
                        }
                    >
                        {t(`topic_${topic}`)}
                    </Checkbox>
                ))}
            </div>

            {last ? (
                <p
                    className={`${styles.note} ${
                        last.ok ? styles.ok : styles.bad
                    }`}
                >
                    {last.ok
                        ? t("last_ok", {
                              time: new Date(last.at).toLocaleTimeString(
                                  undefined,
                                  {
                                      hourCycle: "h23"
                                  }
                              )
                          })
                        : t("last_failed", {
                              reason: reasonText(last.error || "")
                          })}
                </p>
            ) : null}

            <p className={styles.privacy}>{t("privacy")}</p>
        </div>
    );
}
