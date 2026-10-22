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
    /** Closer buttons, for a row of four or more that must fit a phone. */
    compact?: boolean;
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
    flush,
    compact
}: SubMenuProps): JSX.Element {
    return (
        <div
            className={`${styles.menu} ${flush ? styles.flush : ""} ${
                compact ? styles.compact : ""
            }`}
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
