import * as React from "react";
import {NavLink, NavLinkProps} from "react-router-dom";
import styles from "./Rail.module.scss";

// @types/react-router-dom v5's NavLink predates a `ReactElement`/JSX.Element
// `key` type tightening in newer TypeScript, so using it directly as a JSX
// component fails to typecheck (TS2786) even though it works fine at
// runtime. Re-typing it here is the standard workaround for this specific,
// known react-router-dom v5 + modern TS combination.
const TypedNavLink = NavLink as React.ComponentType<NavLinkProps>;

export interface RailNavItem {
    label: string;
    to: string;
    exact?: boolean;
}

export interface RailNavGroup {
    label: string;
    items: RailNavItem[];
}

export interface RailProps {
    groups: RailNavGroup[];
    footer?: React.ReactNode;
}

// Left navigation rail (reference "BitShares Desk" mockup). Unlike the
// mockup's static prototype, `to` is a real react-router path — this is
// meant to actually navigate the app, not toggle a fake in-page view.
export function Rail({groups, footer}: RailProps): JSX.Element {
    return (
        <nav className={styles.rail} aria-label="Main">
            <div className={styles.brand}>
                <div className={styles.brandMark} aria-hidden="true">
                    B
                </div>
                <span className={styles.brandName}>BitShares</span>
            </div>

            {groups.map(group => (
                <div className={styles.group} key={group.label}>
                    <span className={styles.groupLabel}>{group.label}</span>
                    {group.items.map(item => (
                        <TypedNavLink
                            key={item.to}
                            to={item.to}
                            exact={item.exact}
                            className={styles.navItem}
                            activeClassName={styles.navItemActive}
                        >
                            {item.label}
                        </TypedNavLink>
                    ))}
                </div>
            ))}

            {footer}
        </nav>
    );
}
