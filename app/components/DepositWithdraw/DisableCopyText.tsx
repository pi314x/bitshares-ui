import * as React from "react";

export interface DisableCopyTextProps {
    /** Copying is blocked unless this is exactly `false`. */
    disableCopy?: boolean;
    /** Put this on the clipboard instead of the selected text. */
    replaceCopyText?: string;
    children?: React.ReactNode;
}

// Wraps its children in a <span> that intercepts the browser's copy event: the
// copy is cancelled, optionally after putting `replaceCopyText` on the
// clipboard (used so a deposit address cannot be copied with surrounding
// markup, or at all, from the gateway deposit screens).
function DisableCopyText({
    disableCopy,
    replaceCopyText,
    children
}: DisableCopyTextProps) {
    const ref = React.useRef<HTMLSpanElement>(null);
    // The listener is attached once; it reads the current props from here so a
    // changed `replaceCopyText` takes effect without re-attaching.
    const latest = React.useRef({disableCopy, replaceCopyText});
    latest.current = {disableCopy, replaceCopyText};

    React.useEffect(() => {
        const node = ref.current;
        if (!node) return;
        const handleCopy = (event: ClipboardEvent) => {
            const {disableCopy, replaceCopyText} = latest.current;
            if (disableCopy === false) return;
            if (replaceCopyText && event.clipboardData) {
                event.clipboardData.setData("text/plain", replaceCopyText);
            }
            event.preventDefault();
        };
        node.addEventListener("copy", handleCopy);
        return () => node.removeEventListener("copy", handleCopy);
    }, []);

    return <span ref={ref}>{children}</span>;
}

export default DisableCopyText;
