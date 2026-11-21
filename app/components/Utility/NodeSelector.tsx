// TypeScript/functional-component port of the legacy NodeSelector.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's `connect
// (NodeSelector, {listenTo, getProps})` alt-react HOC is replaced by
// `useReduxState(selectSettingsState)`, per this migration's established Alt.js
// -store adapter pattern (see app/next/hooks/useReduxState.ts).
//
// `state = {treeData: this._getTreeData()}` was computed once per
// instance (a class field initializer, evaluated in the constructor) -
// replicated with a `useState` lazy initializer. The empty
// `componentDidMount() {}` is dropped (confirmed dead - does nothing).
//
// UPDATE (docs/UI_MIGRATION_PLAN.md §7.3): moved off antd's `TreeSelect`
// onto the design-system one, which *is* the checkable/SHOW_PARENT mode
// this call site always used (so `treeCheckable`/`showCheckedStrategy`
// are gone as props, not just renamed). `getPopupContainer`/
// `dropdownPopupAlign` and the empty sibling `<div id="node-selector--
// drop-down">` that only ever existed to host antd's popup directly
// below the box are dropped: the design-system component positions its
// own dropdown below the box.
import * as React from "react";
import {TreeSelect} from "../../design-system/TreeSelect";
import {settingsAPIs, nodeRegions} from "api/apiConfig";
import SettingsActions from "../../actions/SettingsActions";
import counterpart from "counterpart";
import {Icon} from "../../design-system/Icon";
import {Tooltip} from "../../design-system/Tooltip";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectSettingsState} from "../../store/slices/settingsSlice";

function getTreeData() {
    const nodesPerRegion: {[region: string]: any} = {};
    settingsAPIs.WS_NODE_LIST.forEach((item: any) => {
        if (item.url.indexOf("fake.automatic-selection") !== -1) {
            return;
        }
        let region = item.region || "Unknown";
        if (item.url.indexOf("127.0.0.1") !== -1) {
            region = " Localhost";
        }
        if (item.url.indexOf("testnet") !== -1) {
            region = " " + region;
        }
        if (!nodesPerRegion[region]) {
            nodesPerRegion[region] = {
                title: region,
                key: region,
                value: region,
                children: []
            };
        }
        nodesPerRegion[region].children.push({
            title: item.url,
            key: item.url,
            value: item.url,
            item: item
        });
    });
    const sortedList = Object.values(nodesPerRegion).sort((a: any, b: any) => {
        const aIdx = nodeRegions.indexOf(a.title);
        const bIdx = nodeRegions.indexOf(b.title);
        if (aIdx !== -1 && bIdx !== -1) {
            return aIdx > bIdx ? 1 : bIdx > aIdx ? -1 : 0;
        }
        if (aIdx !== -1) {
            return -1;
        }
        if (bIdx !== -1) {
            return 1;
        }
        return a.title > b.title ? -1 : b.title > a.title ? 1 : 0;
    });
    sortedList.forEach((region: any) => {
        region.title = region.title + " (" + region.children.length + ")";
    });
    return sortedList;
}

interface NodeSelectorProps {
    onChange?: ((value: any) => void) | null;
    size?: string;
}

function NodeSelector({onChange, size}: NodeSelectorProps) {
    const [treeData] = React.useState(() => getTreeData());
    const settingsState = useReduxState<any>(selectSettingsState);
    const filteredApiServers = settingsState.settings.get(
        "filteredApiServers",
        []
    );

    const onChangeValue = (value: any) => {
        SettingsActions.changeSetting({
            setting: "filteredApiServers",
            value: value
        });
        if (!!onChange) {
            onChange(value);
        }
    };

    return (
        <React.Fragment>
            <div
                style={{
                    width: "100%",
                    minWidth: "250px"
                }}
            >
                <TreeSelect
                    key="nodeSelector"
                    treeData={treeData}
                    value={filteredApiServers}
                    onChange={onChangeValue}
                    searchPlaceholder={counterpart.translate(
                        "connection.narrow_down_nodes"
                    )}
                    size={size as any}
                    style={{width: "88%"}}
                />
                <Tooltip
                    title={counterpart.translate(
                        "connection.narrow_down_nodes_tooltip"
                    )}
                >
                    <Icon
                        style={{
                            fontSize: "1.3rem",
                            marginLeft: "0.5rem",
                            marginTop: "0.3rem"
                        }}
                        type={"question-circle"}
                    />
                </Tooltip>
            </div>
        </React.Fragment>
    );
}

export default NodeSelector;
