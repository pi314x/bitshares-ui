// TypeScript/functional-component port of the legacy NodeSelector.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's `connect
// (NodeSelector, {listenTo, getProps})` alt-react HOC is replaced by
// `useAltStore(SettingsStore)`, per this migration's established Alt.js
// -store adapter pattern (see app/next/hooks/useAltStore.ts).
//
// `state = {treeData: this._getTreeData()}` was computed once per
// instance (a class field initializer, evaluated in the constructor) -
// replicated with a `useState` lazy initializer. The empty
// `componentDidMount() {}` is dropped (confirmed dead - does nothing).
import * as React from "react";
import {TreeSelect} from "antd";
import {settingsAPIs, nodeRegions} from "api/apiConfig";
import SettingsStore from "../../stores/SettingsStore";
import SettingsActions from "../../actions/SettingsActions";
import counterpart from "counterpart";
import {Icon, Tooltip} from "bitshares-ui-style-guide";
import {useAltStore} from "../../next/hooks/useAltStore";

const {SHOW_PARENT} = TreeSelect;

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
    const settingsState = useAltStore<any>(SettingsStore);
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

    const tProps = {
        treeData,
        value: filteredApiServers,
        onChange: onChangeValue,
        treeCheckable: true,
        showCheckedStrategy: SHOW_PARENT,
        searchPlaceholder: counterpart.translate(
            "connection.narrow_down_nodes"
        ), // narrow_down_nodes_tooltip
        size,
        style: {
            width: "88%"
        },
        key: "nodeSelector",
        getPopupContainer: () => {
            return document.getElementById("node-selector--drop-down");
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
                    {...(tProps as any)}
                    dropdownPopupAlign={{
                        points: ["tl", "bl"],
                        offset: [0, 4],
                        overflow: false
                    }}
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
                <div
                    id="node-selector--drop-down"
                    className="node-selector--drop-down"
                />
            </div>
        </React.Fragment>
    );
}

export default NodeSelector;
