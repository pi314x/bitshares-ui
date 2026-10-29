// Putting text or an image on the clipboard where the browser allows it.
//
// `navigator.clipboard` exists only in a secure context (https, localhost), and the
// wallet is also served over plain http, so text falls back to the old way: select a
// text field and `execCommand("copy")` - written so that it also works on iOS Safari,
// which wants an editable element, a real range and a user gesture. An image can only
// go to the clipboard through `ClipboardItem`; where that is missing the caller saves
// the file instead (the result says which happened).

export async function copyText(text: string): Promise<boolean> {
    try {
        if (
            typeof navigator !== "undefined" &&
            navigator.clipboard &&
            navigator.clipboard.writeText &&
            typeof window !== "undefined" &&
            window.isSecureContext
        ) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) {
        // fall through to the old way (permission refused, no focus)
    }
    return copyTextOldWay(text);
}

function copyTextOldWay(text: string): boolean {
    if (typeof document === "undefined" || !document.body) return false;
    const field = document.createElement("textarea");
    field.value = text;
    // out of sight and out of the layout, but selectable
    field.setAttribute("aria-hidden", "true");
    field.style.position = "fixed";
    field.style.top = "0";
    field.style.left = "0";
    field.style.width = "1px";
    field.style.height = "1px";
    field.style.padding = "0";
    field.style.border = "0";
    field.style.opacity = "0";
    field.style.fontSize = "16px"; // no zoom on iOS
    document.body.appendChild(field);
    const selection =
        typeof document.getSelection === "function"
            ? document.getSelection()
            : null;
    const previous =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    let ok = false;
    try {
        field.focus({preventScroll: true} as any);
        field.select();
        field.setSelectionRange(0, text.length);
        ok = document.execCommand("copy");
    } catch (e) {
        ok = false;
    }
    document.body.removeChild(field);
    if (selection && previous) {
        selection.removeAllRanges();
        selection.addRange(previous);
    }
    return ok;
}

export type ImageCopyResult = "copied" | "saved" | "failed";

/** Whether this browser can put an image on the clipboard. */
export function canCopyImage(): boolean {
    return (
        typeof navigator !== "undefined" &&
        !!navigator.clipboard &&
        typeof (navigator.clipboard as any).write === "function" &&
        typeof (window as any).ClipboardItem === "function" &&
        window.isSecureContext
    );
}

/**
 * The bytes of a base64 data URL as a Blob. Decoded here, not with `fetch(dataUrl)`:
 * the page's content security policy does not let a fetch reach `data:` (connect-src),
 * and the copy then fell back to saving the file.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
    const comma = dataUrl.indexOf(",");
    const header = comma === -1 ? "" : dataUrl.slice(0, comma);
    const body = comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
    const type = (/^data:([^;,]+)/.exec(header) || [])[1] || "image/png";
    const binary =
        header.indexOf(";base64") !== -1
            ? atob(body)
            : decodeURIComponent(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], {type});
}

/**
 * Copy a PNG (a data URL) to the clipboard; where that cannot be done, save it as a
 * file named `fileName`. The blob is handed over as a promise inside the
 * `ClipboardItem`, which is what Safari needs to keep the user gesture.
 */
export async function copyImage(
    dataUrl: string,
    fileName: string
): Promise<ImageCopyResult> {
    if (canCopyImage()) {
        try {
            const Item = (window as any).ClipboardItem;
            const blob = Promise.resolve().then(() => dataUrlToBlob(dataUrl));
            await (navigator.clipboard as any).write([
                new Item({"image/png": blob})
            ]);
            return "copied";
        } catch (e) {
            // fall through to saving the file
        }
    }
    return saveImage(dataUrl, fileName) ? "saved" : "failed";
}

export function saveImage(dataUrl: string, fileName: string): boolean {
    try {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
    } catch (e) {
        return false;
    }
}
