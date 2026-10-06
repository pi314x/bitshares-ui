import * as React from "react";
import {NavLink, NavLinkProps} from "react-router-dom";
import styles from "./Rail.module.scss";
// The real BitShares brand mark (also used by the legacy Header via
// branding.js's getLogo()), not a placeholder letter.
import logo from "assets/logo-ico-blue.png";

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
                <img
                    className={styles.brandMark}
                    src={logo}
                    alt="BitShares"
                />
                <span className={styles.brandName}>BitShares</span>
            </div>

            {groups.map(group => (
                <div className={styles.group} key={group.label}>
                    <span className={styles.groupLabel}>{group.label}</span>
                    {group.items.map(item => (
                        <TypedNavLink
                            key={item.to}
                            to={item.to}
                            end={item.exact}
                            className={({isActive}: {isActive: boolean}) =>
                                isActive
                                    ? `${styles.navItem} ${styles.navItemActive}`
                                    : styles.navItem
                            }
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
