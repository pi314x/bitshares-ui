import * as React from "react";
import {act, fireEvent, render} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";
import TelegramSettings from "../../components/Settings/TelegramSettings";
import {loadTelegram, resetTelegramQueue} from "../../lib/common/telegram";

// a token and a chat made up for the test (the shape only: nothing real)
const TOKEN = `123456789:${"A".repeat(35)}`;

const mockFetch = jest.fn();

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    window.localStorage.clear();
    resetTelegramQueue();
    mockFetch.mockReset();
    (window as any).fetch = (...args: any[]) => mockFetch(...args);
});

const answer = (body: any, ok = true, status = 200) =>
    mockFetch.mockImplementationOnce(() =>
        Promise.resolve({ok, status, json: () => Promise.resolve(body)})
    );

const type = (container: HTMLElement, label: string, text: string) =>
    fireEvent.change(
        container.querySelector(`input[aria-label="${label}"]`) as HTMLElement,
        {target: {value: text}}
    );

const button = (name: string) =>
    Array.from(document.body.querySelectorAll("button")).find(
        b => (b.textContent || "").trim() === name
    ) as HTMLButtonElement;

const settle = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
    });

describe("Settings -> Notifications (Telegram)", () => {
    it("explains the two steps, keeps the token hidden, and the privacy of it", () => {
        const {container} = render(<TelegramSettings />);
        const text = container.textContent || "";
        expect(text).toContain("@BotFather");
        expect(text).toContain("press Find my chat");
        expect(text).toContain("never a key");
        expect(
            (container.querySelector(
                'input[aria-label="Bot token"]'
            ) as HTMLInputElement).type
        ).toBe("password");
        // nothing can be switched on before a token and a chat are saved
        expect(text).toContain("Save a token and a chat first.");
        expect(document.querySelector("[role='switch']")).toBeNull();
    });

    it("saves only a token and a chat that are one, then offers the switch", () => {
        const {container} = render(<TelegramSettings />);
        expect(button("Save").disabled).toBe(true);
        type(container, "Bot token", "not a token");
        type(container, "Chat ID", "424242");
        expect(button("Save").disabled).toBe(true);
        type(container, "Bot token", TOKEN);
        expect(button("Save").disabled).toBe(false);
        fireEvent.click(button("Save"));
        expect(loadTelegram()).toMatchObject({
            token: TOKEN,
            chatId: "424242",
            enabled: false
        });
        expect(container.textContent).toContain("Saved.");
        expect(container.textContent).toContain(
            "Send notifications to Telegram"
        );
        // saved: nothing left to save
        expect(button("Save").disabled).toBe(true);
    });

    it("keeps the switch and every topic at once", () => {
        const {container} = render(<TelegramSettings />);
        type(container, "Bot token", TOKEN);
        type(container, "Chat ID", "424242");
        fireEvent.click(button("Save"));
        const toggle = document.querySelector("[role='switch']") as HTMLElement;
        fireEvent.click(toggle);
        expect(loadTelegram().enabled).toBe(true);
        const topic = (label: string) =>
            Array.from(container.querySelectorAll("label"))
                .find(l => (l.textContent || "").includes(label))!
                .querySelector("input") as HTMLInputElement;
        // what is on by default, and what is not
        expect(topic("Liquidity pools").checked).toBe(true);
        expect(topic("Everything else").checked).toBe(false);
        fireEvent.click(topic("Liquidity pools"));
        fireEvent.click(topic("Everything else"));
        expect(loadTelegram().topics.pool).toBe(false);
        expect(loadTelegram().topics.other).toBe(true);
    });

    it("finds the chat that wrote to the bot and puts it in the field", async () => {
        const {container} = render(<TelegramSettings />);
        type(container, "Bot token", TOKEN);
        answer({
            ok: true,
            result: [
                {update_id: 1, message: {chat: {id: 777, first_name: "Ann"}}}
            ]
        });
        await act(async () => {
            fireEvent.click(button("Find my chat"));
        });
        await settle();
        expect(
            (container.querySelector(
                'input[aria-label="Chat ID"]'
            ) as HTMLInputElement).value
        ).toBe("777");
        expect(container.textContent).toContain("Found the chat with Ann.");
        expect(mockFetch.mock.calls[0][0]).toBe(
            `https://api.telegram.org/bot${TOKEN}/getUpdates`
        );
    });

    it("says what to do when the bot has no message yet", async () => {
        const {container} = render(<TelegramSettings />);
        type(container, "Bot token", TOKEN);
        answer({ok: true, result: []});
        await act(async () => {
            fireEvent.click(button("Find my chat"));
        });
        await settle();
        expect(container.textContent).toContain("The bot has no message yet");
    });

    it("sends a test message with what is in the fields, and says it, or says what Telegram answered", async () => {
        const {container} = render(<TelegramSettings />);
        type(container, "Bot token", TOKEN);
        type(container, "Chat ID", "424242");
        answer({ok: true, result: {}});
        await act(async () => {
            fireEvent.click(button("Send a test message"));
        });
        await settle();
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.chat_id).toBe("424242");
        expect(body.text).toContain("Telegram is connected");
        expect(container.textContent).toContain("Test message sent");
        // nothing was saved by testing
        expect(loadTelegram().token).toBe("");
        answer(
            {ok: false, description: "Bad Request: chat not found"},
            false,
            400
        );
        await act(async () => {
            fireEvent.click(button("Send a test message"));
        });
        await settle();
        expect(container.textContent).toContain("Bad Request: chat not found");
        // and the token is nowhere in what is shown
        expect(container.textContent).not.toContain(TOKEN);
    });

    it("removes what was saved", () => {
        window.localStorage.setItem(
            "__graphene__telegram",
            JSON.stringify({enabled: true, token: TOKEN, chatId: "424242"})
        );
        const {container} = render(<TelegramSettings />);
        expect(
            (container.querySelector(
                'input[aria-label="Chat ID"]'
            ) as HTMLInputElement).value
        ).toBe("424242");
        fireEvent.click(button("Remove"));
        expect(loadTelegram().token).toBe("");
        expect(loadTelegram().enabled).toBe(false);
        expect(
            (container.querySelector(
                'input[aria-label="Bot token"]'
            ) as HTMLInputElement).value
        ).toBe("");
    });
});
