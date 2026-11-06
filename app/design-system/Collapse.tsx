import * as React from "react";
import styles from "./Collapse.module.scss";

// Twenty-third component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Tabs`'s compound-
// component precedent. Replaces `bitshares-ui-style-guide`'s `Collapse`/
// `Collapse.Panel` (antd v3).
//
// Grepped every real call site before designing this (4: `Blockchain/
// Asset.tsx`, `Gateways/GatewaySelectorModal.tsx`, `QuickTrade/
// QuickTrade.tsx`, `Exchange/Exchange.tsx` - all deferred on this
// component since the call-site migration batch that found it). Every
// call site allows more than one panel open at once (never `accordion`
// mode) - `Exchange.tsx`'s is the only controlled one
// (`activeKey`/`onChange` both typed `string[]`, confirmed via its own
// `mobileKey: string[]` state and `onChangeMobilePanel = (val: string[])
// => setMobileKey(val)`); the other 3 are fully uncontrolled, starting
// fully collapsed (no call site passes `defaultActiveKey`). Real `Panel`
// props: `header` (string or arbitrary `ReactNode`), `extra`
// (`QuickTrade.tsx`, right-aligned content next to the header, never
// collapsed - antd's own documented behavior), `showArrow={false}`
// (`GatewaySelectorModal.tsx`, hides the expand caret entirely).
// `Asset.tsx` destructures `const {Panel} = Collapse` rather than
// writing `Collapse.Panel` directly, same as `Tabs.TabPane` already
// supports via `Tabs`'s own `Object.assign` - supported identically
// here. No real call site gives every `Panel` an explicit `key` (`Asset
// .tsx`'s panels have none at all) - each panel's open/closed state is
// tracked by its key when given, falling back to its position among its
// siblings otherwise (stable as long as the set of panels itself doesn't
// reorder, true at every real call site).
export interface CollapsePanelProps {
    header: React.ReactNode;
    extra?: React.ReactNode;
    showArrow?: boolean;
    className?: string;
    children?: React.ReactNode;
}

const Panel: React.FC<CollapsePanelProps> = () => null;

interface PanelEntry {
    key: string;
    header: React.ReactNode;
    extra: React.ReactNode;
    showArrow: boolean;
    className?: string;
    content: React.ReactNode;
}

function collectPanels(children: React.ReactNode): PanelEntry[] {
    const panels: PanelEntry[] = [];
    React.Children.forEach(children, (child, index) => {
        if (!React.isValidElement(child) || child.type !== Panel) return;
        const props = child.props as CollapsePanelProps;
        panels.push({
            key: child.key !== null ? String(child.key) : String(index),
            header: props.header,
            extra: props.extra,
            showArrow: props.showArrow !== false,
            className: props.className,
            content: props.children
        });
    });
    return panels;
}

export interface CollapseProps {
    activeKey?: string[];
    onChange?: (keys: string[]) => void;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

function CollapseBase({
    activeKey,
    onChange,
    className,
    style,
    children
}: CollapseProps): JSX.Element {
    const panels = collectPanels(children);
    const [uncontrolledKeys, setUncontrolledKeys] = React.useState<string[]>(
        []
    );
    const openKeys = activeKey !== undefined ? activeKey : uncontrolledKeys;

    function toggle(key: string) {
        const next = openKeys.includes(key)
            ? openKeys.filter(k => k !== key)
            : [...openKeys, key];
        if (activeKey === undefined) setUncontrolledKeys(next);
        if (onChange) onChange(next);
    }

    return (
        <div
            className={[styles.wrap, className].filter(Boolean).join(" ")}
            style={style}
        >
            {panels.map(panel => {
                const isOpen = openKeys.includes(panel.key);
                return (
                    <div
                        key={panel.key}
                        className={[styles.panel, panel.className]
                            .filter(Boolean)
                            .join(" ")}
                    >
                        <div
                            className={styles.header}
                            role="button"
                            onClick={() => toggle(panel.key)}
                        >
                            {panel.showArrow ? (
                                <span
                                    className={[
                                        styles.arrow,
                                        isOpen ? styles.arrowOpen : ""
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    aria-hidden="true"
                                >
                                    ▸
                                </span>
                            ) : null}
                            <span className={styles.headerText}>
                                {panel.header}
                            </span>
                            {panel.extra ? (
                                <span className={styles.extra}>
                                    {panel.extra}
                                </span>
                            ) : null}
                        </div>
                        {isOpen ? (
                            <div className={styles.content}>
                                {panel.content}
                            </div>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

export const Collapse = Object.assign(CollapseBase, {Panel});
