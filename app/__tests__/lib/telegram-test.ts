import {
    DEFAULT_TELEGRAM,
    MAX_LINES,
    MAX_QUEUE,
    SPACING_MS,
    TelegramEnv,
    clearTelegram,
    escapeHtml,
    findChatId,
    lastTelegramResult,
    loadTelegram,
    messageFor,
    parseTelegram,
    resetTelegramQueue,
    saveTelegram,
    sendTelegram,
    telegramNotify,
    validChatId,
    validToken
} from "../../lib/common/telegram";

// a token and a chat made up for the test (the shape only: nothing real)
const TOKEN = `123456789:${"A".repeat(35)}`;
const CHAT = "424242";

const on = (extra: any = {}) =>
    saveTelegram({
        ...DEFAULT_TELEGRAM,
        enabled: true,
        token: TOKEN,
        chatId: CHAT,
        ...extra
    });

interface Sent {
    url: string;
    body: any;
}

const network = (answer: any = {ok: true, result: {}}, status = 200) => {
    const sent: Sent[] = [];
    const env: TelegramEnv = {
        fetch: (url, init) => {
            sent.push({url, body: JSON.parse(init.body)});
            return Promise.resolve({
                ok: status < 400,
                status,
                json: () => Promise.resolve(answer)
            });
        },
        now: () => 1000
    };
    return {sent, env};
};

const flush = async (ms = 0) => {
    jest.advanceTimersByTime(ms);
    for (let i = 0; i < 20; i++) await Promise.resolve();
};

beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
    resetTelegramQueue();
});

afterEach(() => {
    jest.useRealTimers();
});

describe("the settings", () => {
    it("knows a token and a chat by their shape", () => {
        expect(validToken(TOKEN)).toBe(true);
        expect(validToken("123:short")).toBe(false);
        expect(validToken("")).toBe(false);
        expect(validToken(`${TOKEN} `)).toBe(false);
        expect(validChatId("424242")).toBe(true);
        expect(validChatId("-1001234567890")).toBe(true);
        expect(validChatId("@my_channel")).toBe(true);
        expect(validChatId("abc")).toBe(false);
        expect(validChatId("12 34")).toBe(false);
        expect(validChatId("")).toBe(false);
    });

    it("is off until it is set up, and does not trust what was kept", () => {
        expect(loadTelegram()).toEqual(DEFAULT_TELEGRAM);
        // on without a token or a chat is not on
        expect(parseTelegram({enabled: true}).enabled).toBe(false);
        expect(parseTelegram({enabled: true, token: TOKEN}).enabled).toBe(
            false
        );
        expect(
            parseTelegram({enabled: true, token: TOKEN, chatId: CHAT}).enabled
        ).toBe(true);
        // a token that is not one is not kept
        expect(parseTelegram({token: "<script>", chatId: CHAT}).token).toBe("");
        // a topic that is not a boolean is the default
        expect(
            parseTelegram({topics: {trade: "yes", other: true}}).topics
        ).toEqual({
            ...DEFAULT_TELEGRAM.topics,
            other: true
        });
        window.localStorage.setItem("__graphene__telegram", "{not json");
        expect(loadTelegram()).toEqual(DEFAULT_TELEGRAM);
    });

    it("keeps what is saved, and forgets it when cleared", () => {
        on({topics: {...DEFAULT_TELEGRAM.topics, pool: false}});
        const kept = loadTelegram();
        expect(kept.enabled).toBe(true);
        expect(kept.token).toBe(TOKEN);
        expect(kept.topics.pool).toBe(false);
        clearTelegram();
        expect(loadTelegram()).toEqual(DEFAULT_TELEGRAM);
    });
});

describe("the message", () => {
    it("escapes what Telegram would take for markup", () => {
        expect(escapeHtml("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
    });

    it("names the account, a line for each note, and links the transaction with the address the app is open at", () => {
        const text = messageFor(
            "uiuser",
            [
                {
                    topic: "pool",
                    title: "Pool swap",
                    description: "Swapped 1 BTS for 3 <USD>",
                    link: "/block/7000/3"
                },
                {topic: "trade", title: "Order filled"}
            ],
            "https://desk.example/"
        );
        expect(text.split("\n")).toEqual([
            "<i>uiuser</i>",
            "<b>Pool swap</b> - Swapped 1 BTS for 3 &lt;USD&gt;",
            "<b>Order filled</b>",
            '<a href="https://desk.example/block/7000/3">↗</a>'
        ]);
    });

    it("has no link without an address to make it with, or for something that is not a route", () => {
        const note = {topic: "pool" as const, title: "T", link: "/block/1/0"};
        expect(messageFor("a", [note], null)).not.toContain("<a ");
        expect(messageFor("a", [note], "javascript:alert(1)")).not.toContain(
            "<a "
        );
        expect(
            messageFor(
                "a",
                [{...note, link: "https://evil.example/"}],
                "https://x.example"
            )
        ).not.toContain("<a ");
        expect(
            messageFor(
                "a",
                [{...note, link: "//evil.example/"}],
                "https://x.example"
            )
        ).not.toContain("<a ");
    });

    it("keeps a message short: the lines over the limit are counted", () => {
        const notes = Array.from({length: MAX_LINES + 3}, (_, i) => ({
            topic: "trade" as const,
            title: `Trade ${i}`
        }));
        const lines = messageFor("a", notes, null).split("\n");
        expect(lines).toHaveLength(1 + MAX_LINES + 1);
        expect(lines[lines.length - 1]).toBe("... +3");
    });
});

describe("sending", () => {
    it("writes to the chat through Telegram's API, in HTML, with no preview", async () => {
        const {sent, env} = network();
        const result = await sendTelegram(
            {token: TOKEN, chatId: CHAT},
            "<b>hi</b>",
            env
        );
        expect(result).toEqual({ok: true});
        expect(sent).toHaveLength(1);
        expect(sent[0].url).toBe(
            `https://api.telegram.org/bot${TOKEN}/sendMessage`
        );
        expect(sent[0].body).toEqual({
            chat_id: CHAT,
            text: "<b>hi</b>",
            parse_mode: "HTML",
            disable_web_page_preview: true
        });
        expect(lastTelegramResult()).toEqual({at: 1000, ok: true});
    });

    it("says why when Telegram says no, and never puts the token in the reason", async () => {
        const {env} = network({ok: false, description: "Unauthorized"}, 401);
        const result = await sendTelegram(
            {token: TOKEN, chatId: CHAT},
            "x",
            env
        );
        expect(result).toEqual({ok: false, error: "Unauthorized"});
        expect(lastTelegramResult()).toEqual({
            at: 1000,
            ok: false,
            error: "Unauthorized"
        });
        // no network at all
        const down: TelegramEnv = {
            fetch: () =>
                Promise.reject(new Error(`failed to fetch bot${TOKEN}`)),
            now: () => 2000
        };
        const lost = await sendTelegram(
            {token: TOKEN, chatId: CHAT},
            "x",
            down
        );
        expect(lost).toEqual({ok: false, error: "network"});
        expect(JSON.stringify(lastTelegramResult())).not.toContain(TOKEN);
    });

    it("asks nothing of the network for a token or a chat that is not one", async () => {
        const {sent, env} = network();
        expect(
            await sendTelegram({token: "nope", chatId: CHAT}, "x", env)
        ).toEqual({
            ok: false,
            error: "token"
        });
        expect(
            await sendTelegram({token: TOKEN, chatId: "no"}, "x", env)
        ).toEqual({
            ok: false,
            error: "chat"
        });
        expect(sent).toHaveLength(0);
    });

    it("finds the chat that last wrote to the bot", async () => {
        const {sent, env} = network({
            ok: true,
            result: [
                {update_id: 1, message: {chat: {id: 111, first_name: "Old"}}},
                {
                    update_id: 2,
                    message: {chat: {id: -1001, title: "Desk group"}}
                },
                {update_id: 3, edited_message: {chat: {id: 5}}}
            ]
        });
        expect(await findChatId(TOKEN, env)).toEqual({
            ok: true,
            chatId: "-1001",
            title: "Desk group"
        });
        expect(sent[0].url).toContain("/getUpdates");
        const person = network({
            ok: true,
            result: [
                {
                    update_id: 1,
                    message: {
                        chat: {id: 7, first_name: "Ann", last_name: "Lee"}
                    }
                }
            ]
        });
        expect(await findChatId(TOKEN, person.env)).toEqual({
            ok: true,
            chatId: "7",
            title: "Ann Lee"
        });
        // nobody has written to the bot yet
        const none = network({ok: true, result: []});
        expect(await findChatId(TOKEN, none.env)).toEqual({
            ok: false,
            error: "no_message"
        });
    });
});

describe("telling the chat", () => {
    const note = (topic: any, title = "T") => ({
        topic,
        title,
        description: "d"
    });

    it("does nothing while it is not set up or switched off, and asks nothing of the network", async () => {
        const {sent, env} = network();
        telegramNotify("me", [note("trade")], env, null);
        await flush();
        on({enabled: false});
        telegramNotify("me", [note("trade")], env, null);
        await flush();
        expect(sent).toHaveLength(0);
    });

    it("sends the notes of the topics that are on as one message, and leaves the others", async () => {
        on({topics: {...DEFAULT_TELEGRAM.topics, pool: false}});
        const {sent, env} = network();
        telegramNotify(
            "me",
            [
                note("trade", "Order filled"),
                note("pool", "Pool swap"),
                note("other", "Vote")
            ],
            env,
            null
        );
        await flush();
        expect(sent).toHaveLength(1);
        const text: string = sent[0].body.text;
        expect(text).toContain("Order filled");
        expect(text).not.toContain("Pool swap");
        // "other" is off by default
        expect(text).not.toContain("Vote");
        // nothing of a topic that is on: nothing sent
        telegramNotify("me", [note("pool")], env, null);
        await flush();
        expect(sent).toHaveLength(1);
    });

    it("keeps a second between messages, and counts what a flood would have sent", async () => {
        on();
        const {sent, env} = network();
        for (let i = 0; i < MAX_QUEUE + 4; i++) {
            telegramNotify("me", [note("trade", `T${i}`)], env, null);
        }
        await flush();
        // the first goes at once, the next one a second later
        expect(sent).toHaveLength(1);
        await flush(SPACING_MS);
        expect(sent).toHaveLength(2);
        for (let i = 0; i < MAX_QUEUE + 4; i++) await flush(SPACING_MS);
        // the first (sent at once), the ten that fitted in the queue, and one line that counts the 3 left out
        const texts = sent.map(s => s.body.text as string);
        expect(texts.filter(t => t.includes("<b>T"))).toHaveLength(
            1 + MAX_QUEUE
        );
        expect(texts[texts.length - 1]).toBe("... +3");
        expect(texts).toHaveLength(1 + MAX_QUEUE + 1);
    });

    it("never throws, whatever the network does", async () => {
        on();
        const env: TelegramEnv = {
            fetch: () => {
                throw new Error("boom");
            },
            now: () => 1
        };
        expect(() =>
            telegramNotify("me", [note("trade")], env, null)
        ).not.toThrow();
        await flush();
    });
});
