// One lock on the page's scroll for everything that covers the page: dialogs and the phone's menu
// drawer. Several can be open at once and they let go in any order, so the value the page had is
// saved by the FIRST lock and put back by the LAST release. (A lock that saved and restored the
// value per dialog saved "hidden" from the dialog beneath it, and the page stayed unscrollable
// after both were closed.)

let locks = 0;
let before = "";

/** Stops the page behind from scrolling; returns the function that lets go (safe to call twice). */
export function lockPageScroll(): () => void {
    if (locks === 0) {
        before = document.body.style.overflow;
        document.body.style.overflow = "hidden";
    }
    locks += 1;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        locks -= 1;
        if (locks === 0) document.body.style.overflow = before;
    };
}
