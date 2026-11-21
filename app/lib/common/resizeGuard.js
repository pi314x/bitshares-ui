// While a window is being resized, CSS transitions run on every element that
// crosses a breakpoint (the navigation drawer sliding, panels fading) and read
// as flicker. This marks <html> as "resizing" during the drag and a short while
// after, and the stylesheet (design-system/theme.scss) turns transitions off for
// that time.
const SETTLE_MS = 150;

export function installResizeGuard(win = window, settleMs = SETTLE_MS) {
    const root = win.document.documentElement;
    let timer = null;
    const onResize = () => {
        root.classList.add("is-resizing");
        if (timer) win.clearTimeout(timer);
        timer = win.setTimeout(() => {
            root.classList.remove("is-resizing");
            timer = null;
        }, settleMs);
    };
    win.addEventListener("resize", onResize, {passive: true});
    return () => {
        win.removeEventListener("resize", onResize);
        if (timer) win.clearTimeout(timer);
        root.classList.remove("is-resizing");
    };
}

export default installResizeGuard;
