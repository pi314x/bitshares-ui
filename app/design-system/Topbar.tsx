import * as React from "react";
import styles from "./Topbar.module.scss";
import {AccountSwitcher} from "./AccountSwitcher";
import {WalletLockButton} from "./WalletLockButton";
import {NodePicker} from "./NodePicker";
import {LocaleSwitcher} from "./LocaleSwitcher";
import {Button} from "./Button";
import {ExtensionChip} from "./ExtensionChip";

export interface TopbarProps {
    crumb: string;
    /** BlockchainStore's `rpc_connection_status` ("open" | "closed" | "reconnect" | "error" | null). */
    connectionStatus: string | null;
    /** SettingsStore's `activeNode` setting, e.g. "wss://node.xbts.io/ws". */
    activeNode: string | null;
    /** The legacy Utility/NodeSelector component — see NodePicker's comment. */
    nodeSelector: React.ReactNode;
    currentAccount: string | null;
    accounts: string[];
    onSelectAccount: (accountName: string) => void;
    accountBadges?: Record<string, string>;
    /** The connection chip lives in the status bar at the bottom instead. */
    hideConnection?: boolean;
    /** The language menu lives elsewhere (the left menu's footer). */
    hideLocale?: boolean;
    /** "Log out" in the account menu. */
    onLogout?: () => void;
    /** Accounts the user follows, and follow/unfollow of the current one. */
    followedAccounts?: string[];
    follow?: {following: boolean; onToggle: () => void};
    /** WalletUnlockStore's `locked`, or null before it's known. */
    locked: boolean | null;
    onToggleLock: () => void;
    /** Overrides the lock button's text; see WalletLockButton. */
    lockLabel?: string | null;
    currentLocale: string | null;
    locales: string[];
    onSelectLocale: (locale: string) => void;
    /** Optional: the shell offers these in the menu (Payments) instead. */
    onShowSend?: () => void;
    onShowDeposit?: () => void;
    onShowWithdraw?: () => void;
    /**
     * One-click opt-in to a detected wallet browser extension (shown only while
     * it is installed and not the signer). Omit it and nothing shows.
     */
    extensionAction?: {label: string; onClick: () => void; disabled?: boolean};
    /** Small chips shown before the account (view-only notice, backup). */
    chips?: React.ReactNode;
    /** What sits at the far right, after the lock (the notification bell). */
    endChips?: React.ReactNode;
    /**
     * A figure left of the account menu, shown only while the bar has room for it: with it, the row must
     * still fit on one line (it never wraps the bar onto a second row; a phone held upright has no room for it,
     * held sideways it has).
     */
    balance?: React.ReactNode;
    /** Phone width: opens the navigation drawer; omit it and no menu button shows. */
    onOpenNav?: () => void;
    navOpen?: boolean;
    navId?: string;
}

/** The flex items of the bar's row in order, looking through `display: contents` wrappers; `skip` is left out. */
function rowItems(
    parent: Element,
    skip: Element | null,
    items: HTMLElement[] = []
): HTMLElement[] {
    for (const child of Array.from(parent.children) as HTMLElement[]) {
        if (child === skip) continue;
        const style = window.getComputedStyle(child);
        if (
            style.display === "none" ||
            style.position === "absolute" ||
            style.position === "fixed"
        ) {
            continue;
        }
        if (style.display === "contents") rowItems(child, skip, items);
        else items.push(child);
    }
    return items;
}

/**
 * What an item of the row needs: its width, or more when its content overflows it (`scrollWidth`: the wallet chips, squeezed
 * on a phone). An item that grows into the free room (the title on a phone) is as wide as the room, not as its text: it
 * counts as its text is wide.
 */
function naturalWidth(el: HTMLElement): number {
    const width = el.getBoundingClientRect().width;
    const grows = parseFloat(window.getComputedStyle(el).flexGrow) > 0;
    if (grows && typeof document.createRange === "function") {
        const range = document.createRange();
        range.selectNodeContents(el);
        if (typeof range.getBoundingClientRect === "function") {
            return range.getBoundingClientRect().width;
        }
    }
    return Math.max(width, el.scrollWidth);
}

/**
 * Whether `own` fits into the bar's row beside what is in it: the widths of the other items, the gaps, and `own`
 * with one more gap must come to no more than the row's inner width - which is when the row does not break
 * onto a second line (and, on a phone, when the title is not cut short for it). It is a sum of widths, not a look at
 * the layout with `own` in it, so the answer is the same whether `own` is in the row or not, and cannot flip back and
 * forth.
 *
 * An item counts with the width of what it holds (`scrollWidth`): on a phone the title shrinks to an ellipsis and the
 * group of wallet chips is a box of its own that may be squeezed, and what matters is the room that all of it needs. That
 * group holds `own` (the phone's row has no `display: contents` wrapper): it counts without `own`, and `own` adds the
 * gap inside the group instead of the bar's.
 */
function fitsInRow(header: HTMLElement, own: HTMLElement): boolean {
    const style = window.getComputedStyle(header);
    const gap = parseFloat(style.columnGap) || 0;
    const inner =
        header.clientWidth -
        (parseFloat(style.paddingLeft) || 0) -
        (parseFloat(style.paddingRight) || 0);
    const ownWidth = own.getBoundingClientRect().width;
    const inFlow = window.getComputedStyle(own).position !== "absolute";
    const items = rowItems(header, own);
    let ownGap = gap;
    let used = gap * Math.max(0, items.length - 1);
    items.forEach(el => {
        let width = naturalWidth(el);
        if (el.contains(own)) {
            const inside =
                parseFloat(window.getComputedStyle(el).columnGap) || 0;
            ownGap = inside;
            if (inFlow) width -= ownWidth + inside;
        }
        used += width;
    });
    // 1px of slack: the browser breaks a line at a sub-pixel more than this sum
    return used + ownGap + ownWidth + 1 <= inner;
}

/**
 * Keeps `fits` up to date: whether `own` has room in the bar's row. Re-measured when the bar, `own` or any item
 * of the row changes its size, and when an item comes or goes (a chip appears: the extension to connect, a
 * backup reminder). Where the browser cannot observe sizes (tests) it stays true.
 */
function useFitsInRow(
    headerRef: React.RefObject<HTMLElement>,
    ownRef: React.RefObject<HTMLElement>,
    enabled: boolean
): boolean {
    const [fits, setFits] = React.useState(true);
    React.useLayoutEffect(() => {
        const header = headerRef.current;
        const own = ownRef.current;
        if (
            !enabled ||
            !header ||
            !own ||
            typeof ResizeObserver !== "function"
        ) {
            return undefined;
        }
        const observed = new Set<Element>();
        const resizes = new ResizeObserver(() => measure());
        // only what is new is observed: observing again reports again, and that would never stop
        const watch = () => {
            const now = new Set<Element>([
                header,
                own,
                ...rowItems(header, own)
            ]);
            observed.forEach(el => {
                if (!now.has(el)) {
                    resizes.unobserve(el);
                    observed.delete(el);
                }
            });
            now.forEach(el => {
                if (!observed.has(el)) {
                    resizes.observe(el);
                    observed.add(el);
                }
            });
        };
        function measure() {
            setFits(fitsInRow(header!, own!));
            watch();
        }
        const mutations =
            typeof MutationObserver === "function"
                ? new MutationObserver(measure)
                : null;
        if (mutations) {
            mutations.observe(header, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }
        measure();
        return () => {
            resizes.disconnect();
            if (mutations) mutations.disconnect();
        };
    }, [headerRef, ownRef, enabled]);
    return fits;
}

export function Topbar({
    crumb,
    connectionStatus,
    activeNode,
    nodeSelector,
    currentAccount,
    accounts,
    onSelectAccount,
    accountBadges,
    onLogout,
    followedAccounts,
    follow,
    hideConnection = false,
    hideLocale = false,
    locked,
    onToggleLock,
    lockLabel,
    currentLocale,
    locales,
    onSelectLocale,
    onShowSend,
    onShowDeposit,
    onShowWithdraw,
    extensionAction,
    chips,
    endChips,
    balance,
    onOpenNav,
    navOpen = false,
    navId
}: TopbarProps): JSX.Element {
    const connected = connectionStatus === "open";
    const headerRef = React.useRef<HTMLElement>(null);
    const balanceRef = React.useRef<HTMLDivElement>(null);
    const balanceFits = useFitsInRow(headerRef, balanceRef, !!balance);
    return (
        <header className={styles.topbar} ref={headerRef}>
            {onOpenNav && (
                <button
                    type="button"
                    className={styles.menuBtn}
                    aria-label="Menu"
                    aria-expanded={navOpen}
                    aria-controls={navId}
                    onClick={onOpenNav}
                >
                    <span className={styles.menuBars} aria-hidden="true" />
                </button>
            )}
            <span className={styles.crumb}>{crumb}</span>
            <span className={styles.spacer} />
            {(onShowSend || onShowDeposit || onShowWithdraw) && (
                <div className={styles.actions}>
                    {onShowSend && <Button onClick={onShowSend}>Send</Button>}
                    {onShowDeposit && (
                        <Button onClick={onShowDeposit}>Deposit</Button>
                    )}
                    {onShowWithdraw && (
                        <Button onClick={onShowWithdraw}>Withdraw</Button>
                    )}
                </div>
            )}
            <div className={styles.status}>
                {hideConnection ? null : (
                    <NodePicker
                        connected={connected}
                        label={
                            connected
                                ? "Connected"
                                : connectionStatus || "Connecting…"
                        }
                    >
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--muted)",
                                marginBottom: 8
                            }}
                        >
                            {activeNode || "No node selected"}
                        </div>
                        {nodeSelector}
                    </NodePicker>
                )}
                {hideLocale ? null : (
                    <LocaleSwitcher
                        currentLocale={currentLocale}
                        locales={locales}
                        onSelect={onSelectLocale}
                    />
                )}
                {chips}
                {extensionAction && (
                    <ExtensionChip
                        label={extensionAction.label}
                        onClick={extensionAction.onClick}
                        disabled={extensionAction.disabled}
                    />
                )}
                {/* a chip like the others, left of the account menu; out of the row (invisible, still measured) when it would not fit */}
                {balance && (
                    <div
                        className={`${styles.balance} ${
                            balanceFits ? "" : styles.balanceOut
                        }`}
                        ref={balanceRef}
                        data-fits={balanceFits ? "true" : "false"}
                    >
                        {balance}
                    </div>
                )}
                <AccountSwitcher
                    currentAccount={currentAccount}
                    accounts={accounts}
                    onSelect={onSelectAccount}
                    badges={accountBadges}
                    onLogout={onLogout}
                    followedAccounts={followedAccounts}
                    follow={follow}
                />
                {/* the lock follows the account it unlocks */}
                <WalletLockButton
                    locked={locked}
                    onToggle={onToggleLock}
                    label={lockLabel}
                />
                {endChips}
            </div>
        </header>
    );
}
