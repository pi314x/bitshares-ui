// TypeScript/functional-component port of the legacy Tabs.jsx (exports
// `{Tabs, Tab}`) (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no
// logic changes.
//
// Structural change (not a behavior change): the original's `connect
// (Tabs, {listenTo, getProps})` alt-react HOC is replaced by
// `useAltStore(SettingsStore)`, per this migration's established
// Alt.js-store adapter pattern.
//
// `UNSAFE_componentWillReceiveProps` (syncs `state.activeTab` to
// `viewSettings.get(setting)` whenever that resolved value changes) is
// replicated with a `useEffect` keyed on the resolved value, skipped on
// the first (mount) run via a ref guard - mount's initial `activeTab` is
// already correctly computed by the `useState` lazy initializer below,
// so re-running the same sync on mount would be redundant (though
// harmless either way, since it would only ever recompute the same
// initial value); the guard keeps the semantics exact rather than
// "probably fine".
//
// `componentDidMount`'s resize-listener registration + `_setDimensions`
// (updates `state.width` only when it actually changed) is replicated
// with a mount-only `useEffect` and a functional `setWidth` update.
//
// `Renders a tab layout, handling switching and optionally persists the
// currently open tab using the SettingsStore`
//
//  props:
//     setting: unique name to be used to remember the active tab of this tabs layout,
//     tabsClass: optional classes for the tabs container div
//     contentClass: optional classes for the content container div
//
//  Usage:
//
//  <Tabs setting="mySetting">
//      <Tab title="locale.string.title1">Tab 1 content</Tab>
//      <Tab title="locale.string.title2">Tab 2 content</Tab>
//  </Tabs>
import * as React from "react";
import cnames from "classnames";
import SettingsActions from "actions/SettingsActions";
import SettingsStore from "stores/SettingsStore";
import counterpart from "counterpart";
import {withRouter} from "react-router-dom";
import {useAltStore} from "../../next/hooks/useAltStore";

interface TabProps {
    changeTab?: (index: number, isLinkTo: string) => void;
    isActive?: boolean;
    index?: number;
    className?: string;
    isLinkTo?: string;
    subText?: any;
    title?: any;
    updatedTab?: boolean;
    disabled?: boolean;
    collapsed?: boolean;
    children?: React.ReactNode;
}

function Tab({
    isActive = false,
    index = 0,
    changeTab,
    title: titleProp,
    className = "",
    updatedTab,
    disabled,
    subText: subTextProp = null,
    isLinkTo = "",
    collapsed
}: TabProps) {
    const c = cnames({"is-active": isActive}, className);

    let title = titleProp;
    if (typeof title === "string" && title.indexOf(".") > 0) {
        title = counterpart.translate(title);
    }

    // dont string concetenate subText directly within the rendering, subText can be an object without toString
    // implementation, but valid DOM (meaning, don't do subText + "someString"
    let subText = subTextProp;

    if (collapsed) {
        // if subText is empty, dont render it, we dont want empty brackets added
        if (typeof subText === "string") {
            subText = subText.trim();
        }
        if (title.type === "span") {
            title = title.props.children[2];
        }
        return (
            <option value={index} data-is-link-to={isLinkTo}>
                {title}
                {updatedTab ? "*" : ""}
                {subText && " ("}
                {subText && subText}
                {subText && ")"}
            </option>
        );
    }
    return (
        <li
            className={c}
            onClick={
                !disabled && changeTab
                    ? changeTab.bind(null, index, isLinkTo)
                    : undefined
            }
        >
            <a>
                <span className="tab-title">
                    {title}
                    {updatedTab ? "*" : ""}
                </span>
                {subText && <div className="tab-subtext">{subText}</div>}
            </a>
        </li>
    );
}

interface TabsCoreProps {
    setting?: string;
    defaultActiveTab?: number;
    segmented?: boolean;
    contentClass?: string;
    tabsClass?: string;
    style?: React.CSSProperties;
    className?: string;
    actionButtons?: React.ReactNode;
    onChangeTab?: (value: any) => void;
    children?: React.ReactNode;
    viewSettings: any;
    history: any;
}

function TabsCore({
    setting,
    defaultActiveTab = 0,
    segmented = true,
    contentClass = "",
    tabsClass,
    style = {},
    className,
    actionButtons,
    onChangeTab,
    children,
    viewSettings,
    history
}: TabsCoreProps) {
    const [activeTab, setActiveTab] = React.useState<any>(() =>
        setting ? viewSettings.get(setting, defaultActiveTab) : defaultActiveTab
    );
    const [width, setWidth] = React.useState(window.innerWidth);

    const settingValue = setting ? viewSettings.get(setting) : undefined;
    const isFirstRenderRef = React.useRef(true);
    React.useEffect(() => {
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false;
            return;
        }
        setActiveTab(settingValue);
    }, [settingValue]);

    React.useEffect(() => {
        const setDimensions = () => {
            const newWidth = window.innerWidth;
            setWidth(prevWidth => (newWidth !== prevWidth ? newWidth : prevWidth));
        };
        setDimensions();
        window.addEventListener("resize", setDimensions, {
            capture: false,
            passive: true
        } as any);
        return () => {
            window.removeEventListener("resize", setDimensions as any);
        };
    }, []);

    const changeTab = (value: any, isLinkTo: string) => {
        if (value === activeTab) return;
        // Persist current tab if desired

        if (isLinkTo !== "") {
            history.push(isLinkTo);
        }

        if (setting) {
            SettingsActions.changeViewSetting({
                [setting]: value
            });
        }
        setActiveTab(value);

        if (onChangeTab) onChangeTab(value);
    };

    const collapseTabs = width < 900 && React.Children.count(children) > 2;

    let activeContent: React.ReactNode = null;

    const tabs = (React.Children.map(children, (child: any, index) => {
        if (!child) {
            return null;
        }
        if (collapseTabs && child.props.disabled) return null;
        const isActive = index === activeTab;
        if (isActive) {
            activeContent = child.props.children;
        }

        return React.cloneElement(child, {
            collapsed: collapseTabs,
            isActive,
            changeTab: changeTab,
            index: index
        });
    }) || []).filter((a: any) => a !== null);

    if (!activeContent) {
        activeContent = tabs[0].props.children;
    }

    return (
        <div className={cnames(!!actionButtons ? "with-buttons" : "", className)}>
            <div className="service-selector">
                <ul
                    style={style}
                    className={cnames("button-group no-margin", tabsClass, {
                        segmented
                    })}
                >
                    {collapseTabs ? (
                        <li
                            style={{
                                paddingLeft: 10,
                                paddingRight: 10,
                                minWidth: "15rem"
                            }}
                        >
                            <select
                                value={activeTab}
                                style={{marginTop: 10, marginBottom: 10}}
                                className="bts-select"
                                onChange={e => {
                                    const ind = parseInt(e.target.value, 10);
                                    changeTab(
                                        ind,
                                        (e.target as any)[ind].attributes[
                                            "data-is-link-to"
                                        ].value
                                    );
                                }}
                            >
                                {tabs}
                            </select>
                        </li>
                    ) : (
                        tabs
                    )}
                    {actionButtons ? (
                        <li className="tabs-action-buttons">{actionButtons}</li>
                    ) : null}
                </ul>
            </div>
            <div className={cnames("tab-content", contentClass)}>
                {activeContent}
            </div>
        </div>
    );
}

interface TabsProps extends Omit<TabsCoreProps, "viewSettings" | "history"> {
    history?: any;
}

function TabsContainer(props: TabsProps) {
    const settingsState = useAltStore<any>(SettingsStore);
    return <TabsCore {...(props as any)} viewSettings={settingsState.viewSettings} />;
}

const Tabs = withRouter(TabsContainer as any) as React.ComponentType<any>;

export {Tabs, Tab};
