import * as React from "react";
import {Tabs} from "../../design-system/Tabs";
import styles from "./PhoneTradeLayout.module.scss";

export interface PhoneSection {
    key: string;
    label: React.ReactNode;
    content: React.ReactNode;
}

export interface PhoneTradeLayoutProps {
    /** Chart, depth, order book and market trades: one is shown at a time. */
    views: PhoneSection[];
    activeView: string;
    onView: (key: string) => void;
    /** The order form with its Buy / Sell switch, always on screen. */
    formTitle: React.ReactNode;
    form: React.ReactNode;
    /** The user's own open orders, trades and markets: one at a time. */
    own: PhoneSection[];
    activeOwn: string;
    onOwn: (key: string) => void;
}

function Switcher({
    sections,
    active,
    onChange
}: {
    sections: PhoneSection[];
    active: string;
    onChange: (key: string) => void;
}) {
    const current = sections.some(s => s.key === active)
        ? active
        : sections[0].key;
    return (
        <Tabs activeKey={current} onChange={onChange} animated={false}>
            {sections.map(section => (
                <Tabs.TabPane tab={section.label} key={section.key}>
                    <div className={styles.pane}>{section.content}</div>
                </Tabs.TabPane>
            ))}
        </Tabs>
    );
}

// The trade screen on a phone. The accordion this replaces hid everything
// behind eight closed headings; here the three things a trader looks at are
// each one card, in the order they are used: the market (chart, depth, book,
// trades), the order form, and the user's own orders and trades.
export function PhoneTradeLayout({
    views,
    activeView,
    onView,
    formTitle,
    form,
    own,
    activeOwn,
    onOwn
}: PhoneTradeLayoutProps): JSX.Element {
    return (
        <div className={styles.root}>
            <section className={styles.card}>
                <Switcher
                    sections={views}
                    active={activeView}
                    onChange={onView}
                />
            </section>
            <section className={styles.card}>
                <h2 className={styles.title}>{formTitle}</h2>
                <div className={styles.pane}>{form}</div>
            </section>
            <section className={styles.card}>
                <Switcher sections={own} active={activeOwn} onChange={onOwn} />
            </section>
        </div>
    );
}
