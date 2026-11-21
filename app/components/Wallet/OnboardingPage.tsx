// The frame of the pages that create or restore a wallet or an account: a
// title (and a subtitle), one line of what is about to happen, and the form's
// card under them. Nothing in here touches a wallet, a password or a key: it
// only lays the existing pieces out (docs/UI_MIGRATION_PLAN.md §7.28).
import * as React from "react";
import styles from "./Onboarding.module.scss";

export interface OnboardingPageProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    /** What the page does, in a sentence or two. */
    intro?: React.ReactNode;
    /** Rendered under the card, quietly (links to the help). */
    more?: React.ReactNode;
    /** The card's actions, at its foot. Omit when the content has its own. */
    footer?: React.ReactNode;
    children?: React.ReactNode;
}

export function OnboardingPage({
    title,
    subtitle,
    intro,
    more,
    footer,
    children
}: OnboardingPageProps): JSX.Element {
    return (
        <div className={styles.page}>
            <div className={styles.head}>
                <h1 className={styles.title}>{title}</h1>
                {subtitle ? (
                    <h2 className={styles.subtitle}>{subtitle}</h2>
                ) : null}
                {intro ? <p className={styles.intro}>{intro}</p> : null}
            </div>
            <div className={styles.card}>
                <div className={styles.body}>{children}</div>
                {footer ? <div className={styles.footer}>{footer}</div> : null}
            </div>
            {more ? <p className={styles.more}>{more}</p> : null}
        </div>
    );
}
