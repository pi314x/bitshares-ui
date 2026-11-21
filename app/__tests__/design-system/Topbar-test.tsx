import * as React from "react";
import * as fs from "fs";
import * as path from "path";
import {render, fireEvent, act} from "@testing-library/react";
import {Topbar} from "../../design-system/Topbar";

function renderTopbar(
    overrides: Partial<React.ComponentProps<typeof Topbar>> = {}
) {
    return render(
        <Topbar
            crumb="Dashboard"
            connectionStatus="open"
            activeNode="wss://node.xbts.io/ws"
            nodeSelector={<div>node selector</div>}
            currentAccount="init0"
            accounts={["init0", "init1"]}
            onSelectAccount={() => {}}
            locked={true}
            onToggleLock={() => {}}
            currentLocale="en"
            locales={["en", "de"]}
            onSelectLocale={() => {}}
            onShowSend={() => {}}
            onShowDeposit={() => {}}
            onShowWithdraw={() => {}}
            {...overrides}
        />
    );
}

describe("design-system/Topbar", () => {
    it("shows Connected when rpc_connection_status is open", () => {
        const {getByText} = renderTopbar();
        expect(getByText("Connected")).toBeTruthy();
        expect(getByText("init0")).toBeTruthy();
    });

    it("surfaces the raw status when not connected, instead of hiding it", () => {
        const {getByText} = renderTopbar({connectionStatus: "closed"});
        expect(getByText("closed")).toBeTruthy();
    });

    it("falls back to a connecting label when status is null", () => {
        const {getByText} = renderTopbar({connectionStatus: null});
        expect(getByText("Connecting…")).toBeTruthy();
    });

    it("shows the wallet lock state and toggles it on click", () => {
        const onToggleLock = jest.fn();
        const {getByText} = renderTopbar({locked: true, onToggleLock});
        fireEvent.click(getByText("Locked"));
        expect(onToggleLock).toHaveBeenCalledTimes(1);
    });

    it("puts the lock after the account menu", () => {
        const {getByText} = renderTopbar({
            locked: true,
            currentAccount: "init0"
        });
        const account = getByText("init0");
        const lock = getByText("Locked");
        // DOCUMENT_POSITION_FOLLOWING: the lock comes later in the document
        expect(
            account.compareDocumentPosition(lock) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it("puts what is passed as endChips at the far right, after the lock", () => {
        const {getByText} = renderTopbar({
            locked: true,
            endChips: <span>bell</span>
        });
        const lock = getByText("Locked");
        const bell = getByText("bell");
        expect(
            lock.compareDocumentPosition(bell) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it("switches accounts through the real AccountSwitcher, not a static label", () => {
        const onSelectAccount = jest.fn();
        const {getByText} = renderTopbar({
            currentAccount: "init0",
            accounts: ["init0", "init1"],
            onSelectAccount
        });
        fireEvent.click(getByText("init0"));
        fireEvent.click(getByText("init1"));
        expect(onSelectAccount).toHaveBeenCalledWith("init1");
    });

    it("opens the node picker panel with the active node and the given selector", () => {
        const {getByText, queryByText} = renderTopbar({
            activeNode: "wss://node.xbts.io/ws",
            nodeSelector: <div>the real NodeSelector</div>
        });
        expect(queryByText("the real NodeSelector")).toBeNull();
        fireEvent.click(getByText("Connected"));
        expect(getByText("wss://node.xbts.io/ws")).toBeTruthy();
        expect(getByText("the real NodeSelector")).toBeTruthy();
    });

    it("wires the send/deposit/withdraw buttons to their handlers", () => {
        const onShowSend = jest.fn();
        const onShowDeposit = jest.fn();
        const onShowWithdraw = jest.fn();
        const {getByText} = renderTopbar({
            onShowSend,
            onShowDeposit,
            onShowWithdraw
        });
        fireEvent.click(getByText("Send"));
        fireEvent.click(getByText("Deposit"));
        fireEvent.click(getByText("Withdraw"));
        expect(onShowSend).toHaveBeenCalledTimes(1);
        expect(onShowDeposit).toHaveBeenCalledTimes(1);
        expect(onShowWithdraw).toHaveBeenCalledTimes(1);
    });

    it("shows the extension action only when one is given, and runs it on click", () => {
        const {queryByText, rerender, getByText} = renderTopbar();
        expect(queryByText("Connect extension")).toBeNull();
        const onClick = jest.fn();
        const {getByText: byText} = renderTopbar({
            extensionAction: {label: "Connect extension", onClick}
        });
        fireEvent.click(byText("Connect extension"));
        expect(onClick).toHaveBeenCalledTimes(1);
        void rerender;
        void getByText;
    });

    describe("the balance", () => {
        // jsdom has no layout: the widths are given (`data-w` on an element, or on the first child of the balance's
        // wrapper), the bar's width is `bar`, and the wrappers `status` act as the `display: contents` they are in CSS
        const original = (global as any).ResizeObserver;
        const originalMutations = (global as any).MutationObserver;
        const rectOf = Element.prototype.getBoundingClientRect;
        const clientWidth = Object.getOwnPropertyDescriptor(
            HTMLElement.prototype,
            "clientWidth"
        );
        let notify: () => void = () => undefined;
        let mutated: () => void = () => undefined;
        let bar = 1000;
        beforeEach(() => {
            bar = 1000;
            // (this jsdom has no MutationObserver: the bar's call for "an item came or went" is made by hand)
            (global as any).MutationObserver = class {
                constructor(cb: () => void) {
                    mutated = cb;
                }
                observe() {
                    return undefined;
                }
                disconnect() {
                    return undefined;
                }
            };
            (global as any).ResizeObserver = class {
                constructor(cb: () => void) {
                    notify = cb;
                }
                observe() {
                    return undefined;
                }
                unobserve() {
                    return undefined;
                }
                disconnect() {
                    return undefined;
                }
            };
            Object.defineProperty(HTMLElement.prototype, "clientWidth", {
                configurable: true,
                get: () => bar
            });
            jest.spyOn(window, "getComputedStyle").mockImplementation(
                (el: Element) =>
                    (({
                        display: /status/.test(el.className.toString())
                            ? "contents"
                            : "block",
                        position: "static",
                        columnGap: "16px",
                        paddingLeft: "24px",
                        paddingRight: "24px"
                    } as unknown) as CSSStyleDeclaration)
            );
            Element.prototype.getBoundingClientRect = function(this: Element) {
                const own =
                    this.getAttribute("data-w") ||
                    (this.className.toString().includes("balance")
                        ? this.firstElementChild?.getAttribute("data-w")
                        : null);
                return {width: Number(own) || 0} as DOMRect;
            };
        });
        afterEach(() => {
            (global as any).ResizeObserver = original;
            (global as any).MutationObserver = originalMutations;
            Element.prototype.getBoundingClientRect = rectOf;
            if (clientWidth) {
                Object.defineProperty(
                    HTMLElement.prototype,
                    "clientWidth",
                    clientWidth
                );
            }
            jest.restoreAllMocks();
        });

        const wrapper = (container: HTMLElement) =>
            container.querySelector("[data-fits]") as HTMLElement;
        const balance = <span data-w="150">12 BTS</span>;

        it("shows it, in the row, while there is room", () => {
            const {container, getByText} = renderTopbar({balance});
            expect(getByText("12 BTS")).toBeTruthy();
            expect(wrapper(container).getAttribute("data-fits")).toBe("true");
            expect(wrapper(container).className).not.toContain("balanceOut");
        });

        it("puts it left of the account menu, after the chips", () => {
            const {getByText} = renderTopbar({
                balance,
                chips: <span data-w="10">a chip</span>
            });
            const follows = (a: HTMLElement, b: HTMLElement) =>
                !!(
                    a.compareDocumentPosition(b) &
                    Node.DOCUMENT_POSITION_FOLLOWING
                );
            expect(follows(getByText("a chip"), getByText("12 BTS"))).toBe(
                true
            );
            expect(follows(getByText("12 BTS"), getByText("init0"))).toBe(true);
            expect(follows(getByText("init0"), getByText("Locked"))).toBe(true);
        });

        it("takes it out of the row, invisible and out of reach, when the bar is too narrow for it", () => {
            bar = 300;
            const {container} = renderTopbar({balance});
            expect(wrapper(container).getAttribute("data-fits")).toBe("false");
            expect(wrapper(container).className).toContain("balanceOut");
        });

        it("counts what stands in the row: a chip of 600 takes 600 and its gap from the room", () => {
            const narrowestBar = (chips?: React.ReactNode) => {
                const fitsAt = (width: number) => {
                    bar = width;
                    const {container, unmount} = renderTopbar({balance, chips});
                    const fits =
                        wrapper(container).getAttribute("data-fits") === "true";
                    unmount();
                    return fits;
                };
                let low = 0; // does not fit
                let high = 4000; // fits
                while (high - low > 1) {
                    const mid = Math.floor((low + high) / 2);
                    if (fitsAt(mid)) high = mid;
                    else low = mid;
                }
                return high;
            };
            const without = narrowestBar();
            const withChip = narrowestBar(<span data-w="600">chip</span>);
            // the balance itself (150), a gap before it (16), a pixel of slack and the bar's padding are in both
            expect(without).toBeGreaterThan(150 + 16);
            expect(withChip - without).toBe(600 + 16);
        });

        it("comes back when the window grows, and goes again when it shrinks", () => {
            bar = 300;
            const {container} = renderTopbar({balance});
            expect(wrapper(container).getAttribute("data-fits")).toBe("false");
            bar = 1200;
            act(() => notify());
            expect(wrapper(container).getAttribute("data-fits")).toBe("true");
            bar = 250;
            act(() => notify());
            expect(wrapper(container).getAttribute("data-fits")).toBe("false");
        });

        it("goes when a chip that takes its room appears, and returns when it is gone", () => {
            bar = 700;
            const props = {
                crumb: "Dashboard",
                connectionStatus: "open",
                activeNode: null,
                nodeSelector: null,
                currentAccount: "init0",
                accounts: ["init0"],
                onSelectAccount: () => undefined,
                locked: true,
                onToggleLock: () => undefined,
                currentLocale: "en",
                locales: ["en"],
                onSelectLocale: () => undefined,
                balance
            };
            const {container, rerender} = render(<Topbar {...props} />);
            expect(wrapper(container).getAttribute("data-fits")).toBe("true");
            rerender(
                <Topbar {...props} chips={<span data-w="600">chip</span>} />
            );
            act(() => mutated());
            expect(wrapper(container).getAttribute("data-fits")).toBe("false");
            rerender(<Topbar {...props} />);
            act(() => mutated());
            expect(wrapper(container).getAttribute("data-fits")).toBe("true");
        });

        it("shows it where the browser cannot measure (no ResizeObserver)", () => {
            (global as any).ResizeObserver = undefined;
            bar = 100;
            const {getByText} = renderTopbar({balance});
            expect(getByText("12 BTS")).toBeTruthy();
        });

        it("without a balance the bar has no wrapper for it", () => {
            const {container} = renderTopbar();
            expect(container.querySelector("[data-fits]")).toBeNull();
        });

        it("takes a chip with nothing in it out of the row, so no double gap stands beside it", () => {
            // the view-mode notice is an empty wrapper for one's own account; as a flex item it would add its two gaps
            // between its neighbours (the rule itself is in Topbar.module.scss: jsdom has no layout)
            const rule = fs.readFileSync(
                path.join(__dirname, "../../design-system/Topbar.module.scss"),
                "utf8"
            );
            expect(rule).toMatch(/\.status > :empty \{\s*display: none;\s*\}/);
        });
    });
});

describe("design-system/Topbar chips", () => {
    // jsdom has no layout: the rules are read from the style sheets
    const read = (file: string) =>
        fs.readFileSync(path.join(__dirname, "../..", file), "utf8");

    it("gives the bar one height for its chips, and every chip takes it, so they stand in one line", () => {
        expect(read("design-system/Topbar.module.scss")).toMatch(
            /--chip-h: 32px;/
        );
        [
            [
                "design-system/AccountSwitcher.module.scss",
                /\.trigger \{[^}]*height: var\(--chip-h, auto\)/
            ],
            [
                "design-system/WalletLockButton.module.scss",
                /\.btn \{[^}]*height: var\(--chip-h, auto\)/
            ],
            [
                "components/Notifications/NotificationBell.module.scss",
                /\.bell \{[^}]*height: var\(--chip-h, auto\)/
            ],
            [
                "next/BalanceChip.module.scss",
                /\.chip \{[^}]*height: var\(--chip-h, auto\)/
            ],

            [
                "next/BackupNotice.module.scss",
                /\.chip \{[^}]*height: var\(--chip-h, auto\)/
            ],
            [
                "design-system/ExtensionChip.module.scss",
                /\.chip \{[^}]*height: var\(--chip-h, auto\)/
            ],
            [
                "components/Account/AccountBrowsingMode.module.scss",
                /\.chip \{[^}]*height: var\(--chip-h, auto\)/
            ]
        ].forEach(([file, rule]) => {
            expect(read(file as string)).toMatch(rule as RegExp);
        });
    });

    it("holds the account menu and the bell in flex boxes, not in blocks that wrap an inline button (their line box was the taller)", () => {
        expect(read("design-system/AccountSwitcher.module.scss")).toMatch(
            /\.wrap \{[^}]*display: flex/
        );
        expect(
            read("components/Notifications/NotificationBell.module.scss")
        ).toMatch(/\.wrap \{[^}]*display: flex/);
    });

    it("does not hide the balance on a phone: a phone held sideways has room (the fit decides)", () => {
        expect(read("design-system/Topbar.module.scss")).not.toMatch(
            /\.balance \{\s*display: none/
        );
    });
});
