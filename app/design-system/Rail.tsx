import * as React from "react";
import {NavLink, NavLinkProps, useLocation} from "react-router-dom";
import styles from "./Rail.module.scss";
// The real BitShares brand mark (also used by the legacy Header via
// branding.js's getLogo()), not a placeholder letter.
import logo from "assets/logo-ico-blue.png";

const TypedNavLink = NavLink as React.ComponentType<NavLinkProps>;

export interface RailNavItem {
    label: string;
    /** The page this entry opens. Leave it out for an `action` entry. */
    to?: string;
    /**
     * An entry that does something instead of going somewhere (Send opens its
     * dialog): rendered as a button in the same style, never highlighted.
     */
    action?: string;
    exact?: boolean;
    /**
     * For an entry whose `to` redirects somewhere else (e.g. `/voting` ->
     * `/account/<name>/voting`): the current path counts as this entry when it
     * matches, instead of only when it equals `to`.
     */
    match?: RegExp;
}

export interface RailNavGroup {
    label: string;
    items: RailNavItem[];
}

export interface RailProps {
    groups: RailNavGroup[];
    footer?: React.ReactNode;
    /**
     * Phone width only: the rail is an off-canvas drawer there, and this is
     * whether it is open. Ignored on wider screens, where it is always visible.
     */
    open?: boolean;
    /** Called after a link was followed (the drawer closes itself with it). */
    onNavigate?: () => void;
    /** Called with an entry's `action` when it is chosen. */
    onAction?: (action: string) => void;
    /** Called by the drawer's close button. */
    onClose?: () => void;
    id?: string;
}

// Left navigation rail (reference "BitShares Desk" mockup). Unlike the
// mockup's static prototype, `to` is a real react-router path — this is
// meant to actually navigate the app, not toggle a fake in-page view.
export function Rail({
    groups,
    footer,
    open = false,
    onNavigate,
    onAction,
    onClose,
    id
}: RailProps): JSX.Element {
    const {pathname} = useLocation();
    return (
        <nav
            id={id}
            className={`${styles.rail}${open ? ` ${styles.railOpen}` : ""}`}
            aria-label="Main"
        >
            {onClose && (
                <button
                    type="button"
                    className={styles.close}
                    aria-label="Close menu"
                    onClick={onClose}
                >
                    ×
                </button>
            )}
            <div className={styles.brand}>
                <img className={styles.brandMark} src={logo} alt="BitShares" />
                <span className={styles.brandName}>BitShares</span>
            </div>

            {groups.map(group => (
                <div className={styles.group} key={group.label}>
                    <span className={styles.groupLabel}>{group.label}</span>
                    {group.items.map(item =>
                        item.action ? (
                            <button
                                type="button"
                                key={item.action}
                                className={styles.navItem}
                                onClick={() => {
                                    onAction && onAction(item.action as string);
                                    onNavigate && onNavigate();
                                }}
                            >
                                {item.label}
                            </button>
                        ) : (
                            <TypedNavLink
                                key={item.to}
                                to={item.to as string}
                                end={item.exact}
                                onClick={onNavigate}
                                className={({isActive}: {isActive: boolean}) =>
                                    (item.match
                                      ? item.match.test(pathname)
                                      : isActive)
                                        ? `${styles.navItem} ${styles.navItemActive}`
                                        : styles.navItem
                                }
                            >
                                {item.label}
                            </TypedNavLink>
                        )
                    )}
                </div>
            ))}

            {footer ? <div className={styles.footer}>{footer}</div> : null}
        </nav>
    );
}
