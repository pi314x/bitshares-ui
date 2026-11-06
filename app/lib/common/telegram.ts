// Telegram messages about what happens to the user's accounts. The user makes a bot with @BotFather, puts its
// token and the chat to write to in Settings -> Notifications, and the app writes there when the chain records
// something for one of the accounts (and when a margin position gets close to a call).
//
// Everything is in the browser: the message goes from this page straight to api.telegram.org (a browser may
// call it), so it is sent while the app is open, and nothing is relayed through a server of ours. The token is
// kept in this browser only (localStorage). It can write to the chat and nothing else; no key of a wallet is
// ever in a message, only what the notification bell says: amounts, assets, pools, a link to the transaction.
//
// What touches the world (the network, the clock, the storage) is a parameter, so that this is tested without.

export type TelegramTopic = "trade" | "pool" | "transfer" | "risk" | "other";

export const TELEGRAM_TOPICS: TelegramTopic[] = [
    "trade",
    "pool",
    "transfer",
    "risk",
    "other"
];

export interface TelegramSettings {
    enabled: boolean;
    /** the bot's token, as @BotFather gives it ("123456789:AA...") */
    token: string;
    /** the chat the messages go to: a number (a person, a group: negative) or "@channelname" */
    chatId: string;
    topics: Record<TelegramTopic, boolean>;
}

export const DEFAULT_TELEGRAM: TelegramSettings = {
    enabled: false,
    token: "",
    chatId: "",
    topics: {
        trade: true,
        pool: true,
        transfer: true,
        risk: true,
        other: false
    }
};

const KEY = "__graphene__telegram";

export const validToken = (token: string): boolean =>
    /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(token);

export const validChatId = (chatId: string): boolean =>
    /^-?\d{1,20}$/.test(chatId) || /^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(chatId);

/** Settings as they were kept: anything off is put back to the default, nothing is trusted. */
export function parseTelegram(raw: any): TelegramSettings {
    const r = raw && typeof raw === "object" ? raw : {};
    const token = typeof r.token === "string" ? r.token.trim() : "";
    const chatId = typeof r.chatId === "string" ? r.chatId.trim() : "";
    const topics = {...DEFAULT_TELEGRAM.topics};
    TELEGRAM_TOPICS.forEach(topic => {
        if (r.topics && typeof r.topics[topic] === "boolean") {
            topics[topic] = r.topics[topic];
        }
    });
    return {
        // on only with something to send with
        enabled: r.enabled === true && validToken(token) && validChatId(chatId),
        token: validToken(token) ? token : "",
        chatId: validChatId(chatId) ? chatId : "",
        topics
    };
}

export function loadTelegram(): TelegramSettings {
    try {
        return parseTelegram(
            JSON.parse(window.localStorage.getItem(KEY) || "null")
        );
    } catch (e) {
        return parseTelegram(null);
    }
}

export function saveTelegram(settings: TelegramSettings): void {
    try {
        window.localStorage.setItem(
            KEY,
            JSON.stringify(parseTelegram(settings))
        );
    } catch (e) {
        // not kept
    }
    emit();
}

export function clearTelegram(): void {
    try {
        window.localStorage.removeItem(KEY);
    } catch (e) {
        // already gone
    }
    emit();
}

// ------------------------------------------------------------------------ what was sent last

export interface TelegramResult {
    at: number;
    ok: boolean;
    /** why it failed (Telegram's own words, never the token) */
    error?: string;
}

let last: TelegramResult | null = null;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach(listener => listener());
}

function record(result: TelegramResult) {
    last = result;
    emit();
}

export const lastTelegramResult = (): TelegramResult | null => last;

export function subscribeTelegram(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

// ------------------------------------------------------------------------------- the messages

/** Text for Telegram's HTML mode. */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

export interface TelegramNote {
    topic: TelegramTopic;
    title: string;
    description?: string;
    /** a page of the app (a route): it is made a link with the address the app is open at */
    link?: string;
}

/** The most lines in one message: the rest is counted. */
export const MAX_LINES = 8;

/**
 * One message for the notes that came together (the operations of one transaction, the ones that a look at
 * the history found at once): the account in bold, a line for each note, and the link of the first that has one.
 */
export function messageFor(
    account: string,
    notes: TelegramNote[],
    origin: string | null
): string {
    const lines = notes.slice(0, MAX_LINES).map(note => {
        const title = `<b>${escapeHtml(note.title)}</b>`;
        return note.description
            ? `${title} - ${escapeHtml(note.description)}`
            : title;
    });
    if (notes.length > MAX_LINES) {
        lines.push(`... +${notes.length - MAX_LINES}`);
    }
    const linked = notes.find(note => note.link && /^\/[^/\\]/.test(note.link));
    const text = [`<i>${escapeHtml(account)}</i>`, ...lines];
    if (linked && origin && /^https?:\/\//.test(origin)) {
        const url = `${origin.replace(/\/+$/, "")}${linked.link}`;
        text.push(`<a href="${escapeHtml(url).replace(/"/g, "&quot;")}">↗</a>`);
    }
    return text.join("\n");
}

export interface TelegramEnv {
    fetch: (
        url: string,
        init: any
    ) => Promise<{ok: boolean; status: number; json: () => Promise<any>}>;
    now: () => number;
}

const defaultEnv = (): TelegramEnv => ({
    fetch: (url, init) => window.fetch(url, init) as any,
    now: () => Date.now()
});

/** Asks Telegram for `method`; the answer's description (never the token) when it says no. */
async function call(
    settings: {token: string},
    method: string,
    body: any,
    env: TelegramEnv
): Promise<{ok: true; result: any} | {ok: false; error: string}> {
    if (!validToken(settings.token)) return {ok: false, error: "token"};
    try {
        const response = await env.fetch(
            `https://api.telegram.org/bot${settings.token}/${method}`,
            {
                method: "POST",
                headers: {"content-type": "application/json"},
                body: JSON.stringify(body)
            }
        );
        let answer: any = null;
        try {
            answer = await response.json();
        } catch (e) {
            answer = null;
        }
        if (response.ok && answer && answer.ok) {
            return {ok: true, result: answer.result};
        }
        const description =
            answer && typeof answer.description === "string"
                ? answer.description
                : `HTTP ${response.status}`;
        return {ok: false, error: description.slice(0, 200)};
    } catch (e) {
        // no network, blocked: the browser's own words do not hold the address
        return {ok: false, error: "network"};
    }
}

/** Writes `text` (HTML) to the chat of `settings`. */
export async function sendTelegram(
    settings: Pick<TelegramSettings, "token" | "chatId">,
    text: string,
    env: TelegramEnv = defaultEnv()
): Promise<{ok: true} | {ok: false; error: string}> {
    if (!validChatId(settings.chatId)) return {ok: false, error: "chat"};
    const result = await call(
        settings,
        "sendMessage",
        {
            chat_id: settings.chatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true
        },
        env
    );
    record({
        at: env.now(),
        ok: result.ok,
        ...(result.ok ? {} : {error: result.error})
    });
    return result.ok ? {ok: true} : result;
}

/** The chat that last wrote to the bot (the person who pressed Start): its id, or why there is none. */
export async function findChatId(
    token: string,
    env: TelegramEnv = defaultEnv()
): Promise<
    {ok: true; chatId: string; title: string} | {ok: false; error: string}
> {
    const result = await call({token}, "getUpdates", {limit: 20}, env);
    if (!result.ok) return result;
    const updates: any[] = Array.isArray(result.result) ? result.result : [];
    for (let i = updates.length - 1; i >= 0; i--) {
        const message =
            updates[i].message ||
            updates[i].channel_post ||
            updates[i].my_chat_member;
        const chat = message && message.chat;
        if (chat && typeof chat.id === "number") {
            const title =
                chat.title ||
                [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
                chat.username ||
                "";
            return {ok: true, chatId: String(chat.id), title};
        }
    }
    return {ok: false, error: "no_message"};
}

// ------------------------------------------------------------------------------- the queue

/** Telegram allows about one message a second to one chat: they go out this far apart (ms). */
export const SPACING_MS = 1100;
/** More than this waiting: the newest are counted instead of sent. */
export const MAX_QUEUE = 10;

interface Queued {
    text: string;
}

let queue: Queued[] = [];
let dropped = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let busy = false;

async function pump(env: TelegramEnv) {
    if (busy) return;
    busy = true;
    try {
        while (queue.length) {
            const settings = loadTelegram();
            if (!settings.enabled) {
                queue = [];
                dropped = 0;
                break;
            }
            const next = queue.shift() as Queued;
            await sendTelegram(settings, next.text, env);
            if (queue.length) {
                await new Promise(resolve => {
                    timer = setTimeout(resolve, SPACING_MS);
                });
            }
        }
        if (dropped > 0 && loadTelegram().enabled) {
            const settings = loadTelegram();
            const count = dropped;
            dropped = 0;
            await sendTelegram(settings, `... +${count}`, env);
        }
    } finally {
        busy = false;
        timer = null;
    }
}

/**
 * Tells the chat about `notes` of `account`, those of a topic that is turned on, as one message. Nothing
 * happens (and nothing is asked of the network) while Telegram is not set up. It never throws.
 */
export function telegramNotify(
    account: string,
    notes: TelegramNote[],
    env: TelegramEnv = defaultEnv(),
    origin: string | null = typeof window !== "undefined"
        ? window.location.origin
        : null
): void {
    try {
        const settings = loadTelegram();
        if (!settings.enabled) return;
        const wanted = notes.filter(note => settings.topics[note.topic]);
        if (!wanted.length) return;
        if (queue.length >= MAX_QUEUE) {
            dropped++;
            return;
        }
        queue.push({text: messageFor(account, wanted, origin)});
        pump(env).catch(() => undefined);
    } catch (e) {
        // a message that cannot be made is not worth a broken page
    }
}

/** For tests: forget what is waiting. */
export function resetTelegramQueue(): void {
    queue = [];
    dropped = 0;
    if (timer) clearTimeout(timer);
    timer = null;
    busy = false;
    last = null;
}
