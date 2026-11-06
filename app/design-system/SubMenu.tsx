import * as React from "react";
import styles from "./SubMenu.module.scss";

export interface SubMenuItem {
    key: string;
    label: React.ReactNode;
    /** The walkthrough's text for this entry (`data-intro`). */
    dataIntro?: string;
}

export interface SubMenuProps {
    items: SubMenuItem[];
    value: string;
    onChange: (key: string) => void;
    "aria-label"?: string;
    /**
     * A switch that changes what a control shows (a time range, list or
     * graph), not a set of tabs: a group of pressed / not pressed buttons.
     * Looks the same as the tabs.
     */
    toggle?: boolean;
    /** No space under it: it sits in a toolbar or a card's head row. */
    flush?: boolean;
}

// A second level of tabs inside a page (the voting page's Witnesses tab: vote,
// become a witness, update the witness): quieter than the page's own tab strip,
// same behaviour. It only chooses; the page shows what was chosen. It is also
// the one look of every small segmented switch (`toggle`): the chart's time
// range, the pools' list / graph, the portfolio's Active / Visual.
export function SubMenu({
    items,
    value,
    onChange,
    "aria-label": ariaLabel,
    toggle,
    flush
}: SubMenuProps): JSX.Element {
    const row = React.useRef<HTMLDivElement>(null);
    // A row that is wider than the screen slides sideways. The chosen button is brought to the
    // middle of it (the row only: the page does not move), so that a tap on a button that was
    // half out of sight does not leave it there.
    React.useEffect(() => {
        const menu = row.current;
        if (!menu || typeof menu.scrollTo !== "function") return;
        if (menu.scrollWidth <= menu.clientWidth) return;
        const active = menu.querySelector<HTMLElement>(
            '[aria-selected="true"], [aria-pressed="true"]'
        );
        if (!active) return;
        menu.scrollTo({
            left:
                active.offsetLeft - (menu.clientWidth - active.offsetWidth) / 2,
            behavior: "smooth"
        });
    }, [value]);
    return (
        <div
            ref={row}
            className={`${styles.menu} ${flush ? styles.flush : ""}`}
            role={toggle ? "group" : "tablist"}
            aria-label={ariaLabel}
        >
            {items.map(item => (
                <button
                    key={item.key}
                    type="button"
                    {...(toggle
                        ? {"aria-pressed": item.key === value}
                        : {role: "tab", "aria-selected": item.key === value})}
                    className={`${styles.item} ${
                        item.key === value ? styles.active : ""
                    }`}
                    data-intro={item.dataIntro}
                    onClick={() => onChange(item.key)}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}
