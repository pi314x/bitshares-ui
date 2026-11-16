// A dialog (or the phone's menu drawer) stops the page behind it from scrolling. Several can be open
// at once and they close in any order - the unlock prompt over the transaction to confirm, the
// transaction over the menu - so the page must scroll again when the LAST one is gone. A lock that
// saved and restored the previous value per dialog left the page stuck at "hidden" when they closed
// in the order they opened: nothing could be scrolled until the page was reloaded.
import * as React from "react";
import {render} from "@testing-library/react";
import {Modal, ModalAsPage} from "../../design-system/Modal";
import {lockPageScroll} from "../../design-system/scrollLock";

const overflow = () => document.body.style.overflow;

beforeEach(() => {
    document.body.style.overflow = "";
});

describe("the page's scroll lock", () => {
    it("locks while a dialog is open and unlocks when it closes", () => {
        const {rerender} = render(<Modal visible title="One" />);
        expect(overflow()).toBe("hidden");
        rerender(<Modal visible={false} title="One" />);
        expect(overflow()).toBe("");
    });

    it("unlocks when two dialogs close in the order they opened", () => {
        const both = (a: boolean, b: boolean) => (
            <div>
                <Modal visible={a} title="First" />
                <Modal visible={b} title="Second" />
            </div>
        );
        const {rerender} = render(both(true, false));
        rerender(both(true, true));
        expect(overflow()).toBe("hidden");
        // the first one closes while the second is still open: still locked
        rerender(both(false, true));
        expect(overflow()).toBe("hidden");
        rerender(both(false, false));
        expect(overflow()).toBe("");
    });

    it("unlocks when two dialogs close in the opposite order", () => {
        const both = (a: boolean, b: boolean) => (
            <div>
                <Modal visible={a} title="First" />
                <Modal visible={b} title="Second" />
            </div>
        );
        const {rerender} = render(both(true, true));
        rerender(both(true, false));
        expect(overflow()).toBe("hidden");
        rerender(both(false, false));
        expect(overflow()).toBe("");
    });

    it("unlocks after a dialog shown in the page turned into an overlay under another dialog", () => {
        // the transaction to confirm is part of the page; the unlock prompt opens over it, so the
        // transaction becomes an overlay too - and both go away in the order they came
        const screen = (unlock: boolean, confirm: boolean) => (
            <div>
                <ModalAsPage>
                    <Modal visible={confirm} title="Confirm" />
                </ModalAsPage>
                <Modal visible={unlock} title="Unlock" />
            </div>
        );
        const {rerender} = render(screen(false, true));
        expect(overflow()).not.toBe("hidden");
        rerender(screen(true, true));
        expect(overflow()).toBe("hidden");
        rerender(screen(false, true));
        rerender(screen(false, false));
        expect(overflow()).toBe("");
    });

    it("is shared by everything that covers the page, whatever order they let go", () => {
        const drawer = lockPageScroll();
        const {unmount} = render(<Modal visible title="Over the menu" />);
        expect(overflow()).toBe("hidden");
        // the menu closes first (a tap on a link), the dialog afterwards
        drawer();
        expect(overflow()).toBe("hidden");
        unmount();
        expect(overflow()).toBe("");
    });

    it("lets go of a lock once, however often it is called", () => {
        const first = lockPageScroll();
        const second = lockPageScroll();
        first();
        first();
        expect(overflow()).toBe("hidden");
        second();
        expect(overflow()).toBe("");
    });

    it("gives the page back the value it had before any lock", () => {
        document.body.style.overflow = "scroll";
        const release = lockPageScroll();
        expect(overflow()).toBe("hidden");
        release();
        expect(overflow()).toBe("scroll");
    });
});
