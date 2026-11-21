// A visible last resort. When the app crashes while rendering, React unmounts
// the whole tree and what is left is an empty dark page - on a phone, with no
// developer tools, that is indistinguishable from "nothing happened". This puts
// the error on screen (message, where it came from, and a copy button) so it
// can be reported and fixed.
//
// Plain DOM, no React, no stylesheet of the app: it must work when those are
// the thing that failed.
const MAX_ERRORS = 5;
const recorded = [];

function describe(error) {
    if (!error) return "Unknown error";
    if (typeof error === "string") return error;
    const name = error.name && error.name !== "Error" ? error.name + ": " : "";
    const message = error.message || String(error);
    return name + message;
}

export function recordError(error, extra) {
    if (recorded.length >= MAX_ERRORS) return;
    const stack = (error && error.stack) || "";
    recorded.push(
        [
            describe(error),
            extra,
            stack
                .split("\n")
                .slice(0, 8)
                .join("\n")
        ]
            .filter(Boolean)
            .join("\n")
    );
}

export function recordedErrors() {
    return recorded.slice();
}

export function showFatalError(doc = document) {
    if (doc.getElementById("fatal-error")) return;
    const text = recorded.length
        ? recorded.join("\n\n---\n\n")
        : "No error was reported by the browser.";
    const dark = doc.documentElement.getAttribute("data-theme") !== "light";
    const box = doc.createElement("div");
    box.id = "fatal-error";
    box.setAttribute("role", "alert");
    box.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;overflow:auto;padding:24px 20px;" +
        "box-sizing:border-box;font:14px/1.5 system-ui,-apple-system,sans-serif;" +
        (dark
            ? "background:#0b0f14;color:#e9eef5;"
            : "background:#fff;color:#111827;");
    const title = doc.createElement("h1");
    title.textContent = "BitShares could not start";
    title.style.cssText = "font-size:20px;margin:0 0 8px;";
    const hint = doc.createElement("p");
    hint.textContent =
        "Something went wrong while loading the wallet. Your keys and wallets were not touched. " +
        "Please reload; if it happens again, send the text below.";
    hint.style.cssText = "margin:0 0 16px;opacity:.8;max-width:60ch;";
    const pre = doc.createElement("pre");
    pre.textContent =
        text + "\n\n" + (doc.defaultView || window).navigator.userAgent;
    pre.style.cssText =
        "white-space:pre-wrap;word-break:break-word;font:12px/1.45 ui-monospace,Menlo,monospace;" +
        "padding:12px;border-radius:8px;margin:0 0 16px;" +
        (dark ? "background:#11171f;" : "background:#f3f4f6;");
    const reload = doc.createElement("button");
    reload.textContent = "Reload";
    reload.style.cssText =
        "font:inherit;padding:10px 18px;margin-right:10px;border-radius:8px;border:0;" +
        "background:#16b8f3;color:#0b0f14;font-weight:600;";
    reload.onclick = () => (doc.defaultView || window).location.reload();
    const copy = doc.createElement("button");
    copy.textContent = "Copy details";
    copy.style.cssText =
        "font:inherit;padding:10px 18px;border-radius:8px;border:1px solid #627085;" +
        "background:transparent;color:inherit;";
    copy.onclick = () => {
        try {
            (doc.defaultView || window).navigator.clipboard.writeText(
                pre.textContent
            );
            copy.textContent = "Copied";
        } catch (e) {
            const range = doc.createRange();
            range.selectNodeContents(pre);
            const selection = (doc.defaultView || window).getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    };
    box.appendChild(title);
    box.appendChild(hint);
    box.appendChild(pre);
    box.appendChild(reload);
    box.appendChild(copy);
    doc.body.appendChild(box);
}

/**
 * Listen for uncaught errors and show the screen above when the page is left
 * empty after one: React unmounts the tree on an error nothing caught, so an
 * empty `#content` a moment later means the app is gone, not just that a
 * background task failed.
 */
export function installFatalErrorScreen(win = window, settleMs = 1500) {
    const check = () => {
        const content = win.document.getElementById("content");
        const empty = !content || content.childElementCount === 0;
        if (empty && recorded.length) showFatalError(win.document);
    };
    const onError = event => {
        recordError(
            event.error || event.message,
            event.filename ? `${event.filename}:${event.lineno}` : ""
        );
        win.setTimeout(check, settleMs);
    };
    const onRejection = event => {
        recordError(event.reason, "unhandled promise rejection");
        win.setTimeout(check, settleMs);
    };
    win.addEventListener("error", onError);
    win.addEventListener("unhandledrejection", onRejection);
    return () => {
        win.removeEventListener("error", onError);
        win.removeEventListener("unhandledrejection", onRejection);
    };
}
