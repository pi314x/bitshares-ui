// Every page opens at its top. The window keeps the scroll position of the page it came from (and the browser
// restores one on a reload or "back"), so a page that opened after a long one started at its bottom or somewhere in
// the middle - or, when it was short while it loaded, at the bottom of that, which it kept as it grew. The position
// is set when the page changes, before the page is painted.
// Not when a dialog opens over the page (the caller passes the page that is shown, not the dialog's path), and not
// for an address with a `#`: that one points at a place in the page.
import * as React from "react";

export interface ScrollToTopProps {
    /** the path of the page that is shown */
    pathname: string;
    /** the `#` part of the address: the page scrolls to that place, not to its top */
    hash?: string;
}

export default function ScrollToTop({pathname, hash}: ScrollToTopProps): null {
    // the position is ours to set: a reload or "back" must not bring the old one back
    React.useEffect(() => {
        try {
            if ("scrollRestoration" in window.history) {
                window.history.scrollRestoration = "manual";
            }
        } catch (e) {
            // not allowed here: the effect below still sets the top on every page
        }
    }, []);

    // (the hash is read when the page changes, not a reason to scroll by itself)
    React.useLayoutEffect(() => {
        if (hash) return;
        if (typeof window.scrollTo === "function") window.scrollTo(0, 0);
    }, [pathname]);

    return null;
}
