// Loading indicators. Originally a mechanical port of the legacy
// LoadingIndicator.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md); restyled onto the
// design tokens (LoadingIndicator.module.scss): "circle"/"circle-small" are an
// SVG ring, "three-bounce" three soft dots, anything else (the default and
// LoadingButton's "loading-overlay") a centred ring over the parent with the
// optional text, with the BitShares mark in the middle of the ring (LogoRing: the
// ring turns, the mark stands still). The legacy `progress` counter that always
// rendered "0" is gone.
//
// Not security-sensitive per AGENTS.md: purely presentational.
import * as React from "react";
import logo from "assets/logo-ico-blue.png";
import styles from "./LoadingIndicator.module.scss";

interface LoadingIndicatorProps {
    type?: string | null;
    loadingText?: string | null;
    children?: React.ReactNode;
}

export function Ring({small}: {small?: boolean}) {
    return (
        <svg
            className={`${styles.ring} ${
                small ? styles.ringSmall : ""
            } circle-wrapper`}
            viewBox="0 0 24 24"
            role="status"
            aria-label="Loading"
        >
            <circle className={styles.ringTrack} cx="12" cy="12" r="9" />
            <circle className={styles.ringArc} cx="12" cy="12" r="9" />
        </svg>
    );
}

/** The ring with the BitShares mark in its middle: for the page-level loaders (the
 * start-up screen, a panel that is loading), not for the small inline ones. The
 * size is `--logo-ring-size` (56px). The ring is a faint track and an arc with a
 * fading tail that turns by `transform` alone (the browser's compositor draws it,
 * so it stays smooth while the page is busy starting); the mark stands still. */
export function LogoRing() {
    const spin = React.useRef<HTMLSpanElement>(null);
    // The splash (index.hbs) was turning this ring before the app existed and noted when its
    // turn began (`window.__ringStart`, on the document's timeline). This ring takes up the
    // same turn, so that the hand-over does not make it jump back to the top. Before the
    // first paint, so that nobody sees the other angle.
    React.useLayoutEffect(() => {
        const element = spin.current;
        const start = (window as any).__ringStart;
        if (!element || typeof start !== "number" || !element.getAnimations) {
            return;
        }
        const animation = element.getAnimations()[0];
        if (animation) animation.startTime = start;
    }, []);
    return (
        <span className={styles.logoRing} role="status" aria-label="Loading">
            <span className={styles.logoTrack} aria-hidden="true" />
            <span ref={spin} className={styles.logoSpin} aria-hidden="true" />
            <img className={styles.logoMark} src={logo} alt="" />
        </span>
    );
}

export default function LoadingIndicator({
    type = null,
    loadingText = null,
    children
}: LoadingIndicatorProps) {
    switch (type) {
        case "three-bounce":
            return (
                <span
                    className={styles.dots}
                    role="status"
                    aria-label="Loading"
                >
                    <span />
                    <span />
                    <span />
                </span>
            );
        case "circle":
            return <Ring />;
        case "circle-small":
            return <Ring small />;
        default:
            return (
                <div className={styles.overlay}>
                    <LogoRing />
                    {loadingText && (
                        <p className={styles.text}>{loadingText}</p>
                    )}
                    {!!children && <div>{children}</div>}
                </div>
            );
    }
}
