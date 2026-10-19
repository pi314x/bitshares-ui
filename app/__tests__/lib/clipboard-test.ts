import {
    canCopyImage,
    copyImage,
    copyText,
    saveImage
} from "../../lib/common/clipboard";

const setSecure = (value: boolean) =>
    Object.defineProperty(window, "isSecureContext", {
        value,
        configurable: true
    });
const setClipboard = (value: any) =>
    Object.defineProperty(navigator, "clipboard", {
        value,
        configurable: true
    });

afterEach(() => {
    setClipboard(undefined);
    setSecure(false);
    delete (window as any).ClipboardItem;
    delete (document as any).execCommand;
});

describe("copyText", () => {
    it("uses the clipboard API in a secure context", async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        setClipboard({writeText});
        setSecure(true);
        expect(await copyText("bts-address")).toBe(true);
        expect(writeText).toHaveBeenCalledWith("bts-address");
    });

    it("falls back to selecting a field where the API is missing (plain http)", async () => {
        const exec = jest.fn().mockReturnValue(true);
        (document as any).execCommand = exec;
        let copied = "";
        exec.mockImplementation(() => {
            const field = document.querySelector("textarea");
            copied = field ? field.value : "";
            return true;
        });
        expect(await copyText("0xabc")).toBe(true);
        expect(exec).toHaveBeenCalledWith("copy");
        expect(copied).toBe("0xabc");
        // the field it used is gone again
        expect(document.querySelector("textarea")).toBeNull();
    });

    it("falls back when the API refuses", async () => {
        setClipboard({writeText: jest.fn().mockRejectedValue(new Error("no"))});
        setSecure(true);
        (document as any).execCommand = jest.fn().mockReturnValue(true);
        expect(await copyText("x")).toBe(true);
    });

    it("says so when nothing worked", async () => {
        (document as any).execCommand = jest.fn().mockReturnValue(false);
        expect(await copyText("x")).toBe(false);
        (document as any).execCommand = jest.fn(() => {
            throw new Error("not allowed");
        });
        expect(await copyText("x")).toBe(false);
    });
});

describe("images", () => {
    it("cannot be copied without ClipboardItem or a secure context", () => {
        expect(canCopyImage()).toBe(false);
        setClipboard({write: jest.fn()});
        (window as any).ClipboardItem = jest.fn();
        expect(canCopyImage()).toBe(false); // not secure
        setSecure(true);
        expect(canCopyImage()).toBe(true);
    });

    it("are copied as a PNG where the browser can", async () => {
        const write = jest.fn().mockResolvedValue(undefined);
        setClipboard({write});
        setSecure(true);
        const items: any[] = [];
        (window as any).ClipboardItem = function(data: any) {
            items.push(data);
        };
        (global as any).fetch = jest
            .fn()
            .mockResolvedValue({blob: () => Promise.resolve("BLOB")});
        expect(await copyImage("data:image/png;base64,AAA", "qr.png")).toBe(
            "copied"
        );
        expect(write).toHaveBeenCalledTimes(1);
        expect(Object.keys(items[0])).toEqual(["image/png"]);
    });

    it("are saved as a file where they cannot be copied", async () => {
        let clicked: any = null;
        const click = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function() {
            clicked = {href: this.href, download: this.download};
        };
        expect(await copyImage("data:image/png;base64,AAA", "qr.png")).toBe(
            "saved"
        );
        HTMLAnchorElement.prototype.click = click;
        expect(clicked).toEqual({
            href: "data:image/png;base64,AAA",
            download: "qr.png"
        });
        expect(document.querySelector("a[download]")).toBeNull();
    });

    it("saveImage reports a failure", () => {
        const click = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function() {
            throw new Error("blocked");
        };
        expect(saveImage("data:,", "x.png")).toBe(false);
        HTMLAnchorElement.prototype.click = click;
    });
});
