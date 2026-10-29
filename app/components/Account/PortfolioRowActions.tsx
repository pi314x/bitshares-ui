// The actions of one balance row (docs/UI_MIGRATION_PLAN.md §7.26). The table
// used to have a column for each of Send, Deposit, Withdraw, Trade, Borrow,
// Settle, Burn and Hide, which made it wider than any panel. Send and Trade
// stay one click away (when there is room); the rest are in a "..." menu that
// names each action. The actions themselves are the row's existing cells (their
// handlers and modals are untouched): the menu only presents them.
import * as React from "react";
import {createPortal} from "react-dom";
import styles from "./PortfolioRowActions.module.scss";

export interface RowAction {
    key: string;
    label: string;
    /** The row's own cell for this action: a link or button, or "-" / empty. */
    node: React.ReactNode;
}

/** A cell that carries an action (not "-", not empty). */
export function isAction(node: React.ReactNode): boolean {
    return (
        node !== null && node !== undefined && node !== false && node !== "-"
    );
}

const MENU_WIDTH = 200;

export function PortfolioRowActions({
    inline,
    menu,
    menuLabel
}: {
    /** Shown in the row when there is room (Send, Trade). */
    inline: RowAction[];
    /** In the menu: named, one per line. */
    menu: RowAction[];
    menuLabel: string;
}) {
    const [open, setOpen] = React.useState(false);
    const [at, setAt] = React.useState<{top: number; left: number} | null>(
        null
    );
    const button = React.useRef<HTMLButtonElement>(null);
    const panel = React.useRef<HTMLDivElement>(null);

    const present = menu.filter(item => isAction(item.node));

    const close = React.useCallback(() => setOpen(false), []);

    React.useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                (panel.current && panel.current.contains(target)) ||
                (button.current && button.current.contains(target))
            ) {
                return;
            }
            close();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        window.addEventListener("scroll", close, true);
        window.addEventListener("resize", close);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("resize", close);
        };
    }, [open, close]);

    function toggle() {
        if (open) return close();
        const rect = button.current!.getBoundingClientRect();
        // right edge of the menu on the button's right edge, below it; above it
        // when the window has no room underneath
        const height = present.length * 36 + 8;
        const below = rect.bottom + 4 + height <= window.innerHeight;
        setAt({
            top: below ? rect.bottom + 4 : Math.max(8, rect.top - 4 - height),
            left: Math.max(8, rect.right - MENU_WIDTH)
        });
        setOpen(true);
    }

    return (
        <span className={styles.actions}>
            {inline
                .filter(item => isAction(item.node))
                .map(item => (
                    <span
                        key={item.key}
                        className={styles.inline}
                        title={item.label}
                    >
                        {item.node}
                    </span>
                ))}
            {present.length ? (
                <>
                    <button
                        ref={button}
                        type="button"
                        className={styles.more}
                        aria-haspopup="menu"
                        aria-expanded={open}
                        aria-label={menuLabel}
                        title={menuLabel}
                        onClick={toggle}
                    >
                        <span aria-hidden="true">⋯</span>
                    </button>
                    {open && at
                        ? createPortal(
                              <div
                                  ref={panel}
                                  role="menu"
                                  className={styles.menu}
                                  style={{
                                      top: at.top,
                                      left: at.left,
                                      width: MENU_WIDTH
                                  }}
                              >
                                  {present.map(item => (
                                      <MenuRow
                                          key={item.key}
                                          action={item}
                                          onDone={close}
                                      />
                                  ))}
                              </div>,
                              document.body
                          )
                        : null}
                </>
            ) : null}
        </span>
    );
}

// A row of the menu: the label, and the row's own link underneath it. A click
// anywhere on the line is a click on that link (its handler opens the modal).
function MenuRow({action, onDone}: {action: RowAction; onDone: () => void}) {
    const ref = React.useRef<HTMLDivElement>(null);
    return (
        <div
            ref={ref}
            role="menuitem"
            tabIndex={0}
            className={styles.item}
            onClick={e => {
                const link = ref.current
                    ? ref.current.querySelector<HTMLElement>("a, button")
                    : null;
                // a click that already is on the link goes through by itself
                if (link && !link.contains(e.target as Node)) link.click();
                onDone();
            }}
            onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const link = ref.current
                        ? ref.current.querySelector<HTMLElement>("a, button")
                        : null;
                    if (link) link.click();
                    onDone();
                }
            }}
        >
            <span className={styles.glyph}>{action.node}</span>
            <span className={styles.label}>{action.label}</span>
        </div>
    );
}
