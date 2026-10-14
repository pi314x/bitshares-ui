import * as React from "react";
import styles from "./SubMenu.module.scss";

export interface SubMenuItem {
    key: string;
    label: React.ReactNode;
}

export interface SubMenuProps {
    items: SubMenuItem[];
    value: string;
    onChange: (key: string) => void;
    "aria-label"?: string;
}

// A second level of tabs inside a page (the voting page's Witnesses tab: vote,
// become a witness, update the witness): quieter than the page's own tab strip,
// same behaviour. It only chooses; the page shows what was chosen.
export function SubMenu({
    items,
    value,
    onChange,
    "aria-label": ariaLabel
}: SubMenuProps): JSX.Element {
    return (
        <div className={styles.menu} role="tablist" aria-label={ariaLabel}>
            {items.map(item => (
                <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={item.key === value}
                    className={`${styles.item} ${
                        item.key === value ? styles.active : ""
                    }`}
                    onClick={() => onChange(item.key)}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}
