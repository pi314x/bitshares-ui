import * as React from "react";
import styles from "./Tabs.module.scss";

// Seventeenth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`/`Select`/`Icon`/`Notification`/`Table`/`Row`/`Col`/
// `Radio`/`Switch`/`Card`/`Popover`/`Checkbox`/`Alert`'s precedent.
// Replaces `bitshares-ui-style-guide`'s `Tabs`/`Tabs.TabPane` (antd v3) -
// not to be confused with this app's existing, separate
// `components/Utility/Tabs.tsx` (a custom foundation-style tab bar,
// ~7 importers, already dependency-free, nothing to replace there).
//
// Grepped every real call site before designing this (only 4, all
// routing-driven - each tab's `key`/`activeKey` is a route pathname, the
// tab bar doubles as in-page navigation): `activeKey` (controlled, the
// common case) or `defaultActiveKey` (uncontrolled, one real call site),
// `onChange(key)`, `className`, `style`. Every real call site passes
// `animated={false}` - accepted here for API compatibility but a no-op,
// since this design system has no animation primitives yet (the same
// gap already flagged in `Modal.tsx`). No `type="card"`, `tabPosition`,
// `tabBarExtraContent`, or `size` anywhere.
//
// `Tabs.TabPane` follows `Select.Option`'s established compound-component
// pattern: typed via `React.FC<TabPaneProps>` so JSX usage still
// type-checks against its real props, but never actually rendered -
// `Tabs` reads each `TabPane` child's `key`/`tab`/`children` directly
// and renders the tab bar and the active pane's content itself. One real
// call site destructures `const {TabPane} = Tabs` rather than writing
// `Tabs.TabPane` directly (`Modal/PoolStakeModal.tsx`) - supported
// identically, since it's the same property either way.
export interface TabPaneProps {
    tab: React.ReactNode;
    children?: React.ReactNode;
}

const TabPane: React.FC<TabPaneProps> = () => null;

interface TabEntry {
    key: string;
    tab: React.ReactNode;
    content: React.ReactNode;
}

function collectTabs(children: React.ReactNode): TabEntry[] {
    const tabs: TabEntry[] = [];
    React.Children.forEach(children, child => {
        if (!React.isValidElement(child) || child.type !== TabPane) return;
        const props = child.props as TabPaneProps;
        tabs.push({
            key: String(child.key),
            tab: props.tab,
            content: props.children
        });
    });
    return tabs;
}

export interface TabsProps {
    activeKey?: string;
    defaultActiveKey?: string;
    onChange?: (key: string) => void;
    /** Accepted for API compatibility (every real call site passes
     * `animated={false}`) but a no-op - see this file's header comment. */
    animated?: boolean;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

function TabsBase({
    activeKey,
    defaultActiveKey,
    onChange,
    className,
    style,
    children
}: TabsProps): JSX.Element {
    const tabs = collectTabs(children);
    const [uncontrolledKey, setUncontrolledKey] = React.useState(
        defaultActiveKey ?? tabs[0]?.key
    );
    const currentKey = activeKey !== undefined ? activeKey : uncontrolledKey;

    function select(key: string) {
        if (activeKey === undefined) setUncontrolledKey(key);
        if (onChange) onChange(key);
    }

    const active = tabs.find(t => t.key === currentKey);

    return (
        <div
            className={[styles.wrap, className].filter(Boolean).join(" ")}
            style={style}
        >
            <div className={styles.bar} role="tablist">
                {tabs.map(t => (
                    <button
                        type="button"
                        role="tab"
                        key={t.key}
                        aria-selected={t.key === currentKey}
                        className={[
                            styles.tab,
                            t.key === currentKey ? styles.active : ""
                        ]
                            .filter(Boolean)
                            .join(" ")}
                        onClick={() => select(t.key)}
                    >
                        {t.tab}
                    </button>
                ))}
            </div>
            <div className={styles.content}>{active?.content}</div>
        </div>
    );
}

export const Tabs = Object.assign(TabsBase, {TabPane});
