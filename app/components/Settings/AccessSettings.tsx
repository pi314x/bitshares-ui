// TypeScript/functional-component port of the legacy AccessSettings.jsx
// (the Settings screen's node picker - active node, available/personal/
// hidden/testnet node lists, latency re-check). Phase 2,
// docs/UI_MIGRATION_PLAN.md. Only changes which RPC node the app talks
// to; no wallet or signing state involved.
//
// This file exported three classes: `AutoSelectionNode`, `ApiNode`
// (neither exported from the module - internal to this file only, so
// their full usage is fully visible here) and the default-exported
// `AccessSettings`.
//
// Confirmed dead, dropped (verified by reading this file AND both of its
// callers app-wide, grepped for `<AccessSettings` - `Settings.tsx` and
// `SyncError.jsx` - neither ever passes a `popup` prop):
// - The `popup` prop on `AccessSettings` and both the popup-branch JSX in
//   its own render and the `popup={props.popup}` it threaded down to
//   `ApiNode`/`AutoSelectionNode` - always `undefined`/falsy everywhere
//   in the app, so the `props.popup ? (...) : (...)` ternary in all
//   three components always took the non-popup branch. Only the
//   non-popup branch is ported; the popup-only JSX (compact popup list
//   variant, `popupCount`, the popup limit-to-5 slice) is gone.
// - The `faucet` and `onChange` props on `AccessSettings` - both passed
//   by every caller, neither ever read anywhere in this file.
// - `ApiNode.defaultProps = {node: {}}` - `ApiNode` is only ever
//   instantiated from this file's own `renderNode()`, which already
//   guards `if (node == null) return null;` before rendering it, so
//   `node` is always defined when `ApiNode` actually renders.
//
// The legacy `_recalculateLatency`'s `this.forceUpdate()` (after
// `routerTransitioner.doLatencyUpdate(...)` resolves) is load-bearing,
// not redundant: `backgroundPinging` reads
// `routerTransitioner.isBackgroundPingingInProgress()` fresh on every
// render, a value with no store/state backing it at all, so nothing else
// would ever trigger a re-render to pick up its new value once pinging
// finishes. Replicated with the standard hooks forceUpdate substitute (a
// dummy `useState` setter called with a new object).
//
// SyncError.jsx's own usage of the (separately already-ported)
// `WebsocketAddModal` never passes it a `changeConnection` prop, even
// though `WebsocketAddModal.onRemoveSubmit` calls
// `changeConnection(...)` when the removed node was the active one -
// this is a pre-existing latent crash in that specific caller (removing
// the active node from the SyncError screen), present before this port
// and not something this AccessSettings.jsx port touches or fixes.
import * as React from "react";
import Translate from "react-translate-component";
import SettingsActions from "actions/SettingsActions";
import SettingsStore from "stores/SettingsStore";
import willTransitionTo, {routerTransitioner} from "../../routerTransition";
import cnames from "classnames";
import Icon from "../Icon/Icon";
import LoadingButton from "../Utility/LoadingButton";
import {Switch, Button} from "bitshares-ui-style-guide";
import NodeSelector from "../Utility/NodeSelector";
import counterpart from "counterpart";
import {useAltStore} from "../../next/hooks/useAltStore";

const autoSelectionUrl = "wss://fake.automatic-selection.com";

function isTestNet(url: string) {
    return !__TESTNET__ && url.indexOf("testnet") !== -1;
}

function activateNode(url: string) {
    SettingsActions.changeSetting({
        setting: "apiServer",
        value: url
    });
    if (
        (SettingsStore as any).getSetting("activeNode") !=
        (SettingsStore as any).getSetting("apiServer")
    ) {
        setTimeout(() => {
            willTransitionTo(false);
        }, 50);
    }
}

function AutoSelectionNode({
    isActive,
    connectedNode,
    totalNodes
}: {
    isActive: boolean;
    connectedNode: any;
    totalNodes: number;
}) {
    return (
        <div className="auto-node">
            <div>
                <Switch
                    checked={isActive}
                    onChange={
                        connectedNode != null
                            ? () =>
                                  activateNode(
                                      isActive
                                          ? connectedNode.url
                                          : autoSelectionUrl
                                  )
                            : () => {}
                    }
                />
                <Translate
                    component="div"
                    style={{paddingLeft: "1rem", paddingTop: "0.2rem"}}
                    content="settings.automatic"
                    totalNodes={totalNodes}
                />
            </div>
            <div style={{float: "right", marginBottom: "0.5rem"}}>
                <NodeSelector />
            </div>
        </div>
    );
}

function getPing(node: any) {
    if (isTestNet(node.url)) {
        return {toString: null, color: null, rating: null};
    }
    if (!node.ping) {
        return {toString: null, color: "high", rating: "node_down"};
    }
    if (node.ping == Infinity) {
        return {toString: null, color: "high", rating: "node_down"};
    }
    if (node.ping == -1) {
        return {toString: null, color: "high", rating: "skipped"};
    }
    let color, rating;
    const pingInMs = node.ping;
    if (pingInMs < 400) {
        color = "low";
        rating = "low_latency";
    } else if (pingInMs >= 400 && pingInMs < 800) {
        color = "medium";
        rating = "medium_latency";
    } else {
        color = "high";
        rating = "high_latency";
    }

    return {
        toString:
            pingInMs >= 1000
                ? +(pingInMs / 1000).toFixed(2) + "s"
                : pingInMs + "ms",
        color: color,
        rating: rating
    };
}

function ApiNode({
    node,
    isActive,
    showRemoveNodeModal
}: {
    node: any;
    isActive: boolean;
    showRemoveNodeModal: (url: string, name: string) => void;
}) {
    const ping = getPing(node);
    const url = node.url;
    const canBeHidden = !isActive;
    const canBeRemoved = !node.default && !isActive;
    const hidden = !!node.hidden;

    const location =
        !!node.location &&
        typeof node.location === "object" &&
        "translate" in node.location
            ? counterpart.translate(node.location.translate)
            : node.location;

    let title = !!location ? location : "";
    if (!!node.country) {
        title = node.country + (!!title ? " - " + title : "");
    }
    if (!!node.region) {
        title = node.region + (!!title ? " - " + title : "");
    }

    return (
        <div className="api-node">
            <div className="api-node-left">
                <p className="api-node-title">{title}</p>
                {!!node.operator && (
                    <p className="api-node-operator">
                        {node.operator}
                        &nbsp;&nbsp;&nbsp;
                    </p>
                )}
                <p
                    className="api-node-url"
                    id={isActive ? "active_node" : undefined}
                >
                    {url}
                </p>
            </div>
            <div>
                <div className="api-status">
                    <span className={ping.color || undefined}>
                        {!!ping.rating && (
                            <Translate content={`settings.${ping.rating}`} />
                        )}
                        {!!ping.toString && <p>{ping.toString}</p>}
                    </span>
                </div>
            </div>
            <div style={{marginTop: "-5px"}}>
                {canBeHidden && (
                    <a
                        onClick={
                            hidden
                                ? () => SettingsActions.showWS(url)
                                : () => SettingsActions.hideWS(url)
                        }
                    >
                        <Icon
                            className={"shuffle"}
                            name={hidden ? "eye-striked" : "eye"}
                            title={
                                hidden ? "icons.eye_striked" : "icons.eye"
                            }
                            size="1_5x"
                        />
                    </a>
                )}
                {canBeRemoved && (
                    <a onClick={() => showRemoveNodeModal(url, title)}>
                        <Icon
                            name={"times"}
                            title="icons.times"
                            size="1_5x"
                        />
                    </a>
                )}
                <div className="api-status">
                    {!isActive ? (
                        <a id={url} onClick={() => activateNode(url)}>
                            <Icon
                                className={ping.color + " default-icon"}
                                name={"disconnected"}
                                title="icons.connect"
                                size="1_5x"
                            />
                            <Icon
                                className={ping.color + " hover-icon"}
                                name={"connect"}
                                title="icons.connect"
                                size="1_5x"
                            />
                        </a>
                    ) : (
                        <Icon
                            className={ping.color}
                            name={"connected"}
                            title="icons.connected"
                            size="2x"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

interface AccessSettingsProps {
    nodes: any[];
    showAddNodeModal: () => void;
    showRemoveNodeModal: (url: string, name: string) => void;
}

export default function AccessSettings({
    nodes,
    showAddNodeModal,
    showRemoveNodeModal
}: AccessSettingsProps) {
    const settingsState = useAltStore<any>(SettingsStore);
    const selectedNode = settingsState.settings.get("apiServer");
    const connectedNodeUrl = settingsState.settings.get("activeNode");
    const apiLatencies = settingsState.apiLatencies;

    const [activeTab, setActiveTab] = React.useState("available_nodes");
    const [, forceRerender] = React.useState({});

    function getNode(node: any) {
        const nodeWrapper: any = {
            ping: apiLatencies[node.url]
        };
        Object.keys(node).forEach(key => {
            nodeWrapper[key] = node[key];
        });
        return nodeWrapper;
    }

    function getConnectedNode() {
        const connectedURL = connectedNodeUrl || autoSelectionUrl;
        const found = nodes.find((node: any) => node.url == connectedURL);
        return found ? getNode(found) : null;
    }

    function nodeIsPersonal(node: any) {
        return !node.default && !node.hidden && !isTestNet(node.url);
    }

    function connectedNodeIsPersonal() {
        if (!connectedNodeUrl) {
            return false;
        }
        const cn = nodes.find((node: any) => node.url == connectedNodeUrl);
        return cn && nodeIsPersonal(cn);
    }

    function getMainNetNodes() {
        return nodes.filter((a: any) => !isTestNet(a.url));
    }

    function renderNode(node: any, currentConnectedNode: any) {
        if (node == null) return null;
        return (
            <ApiNode
                node={node}
                key={node.url}
                showRemoveNodeModal={showRemoveNodeModal}
                isActive={
                    currentConnectedNode !== null &&
                    node.url == currentConnectedNode.url
                }
            />
        );
    }

    function renderAutoSelection(currentConnectedNode: any) {
        return (
            <AutoSelectionNode
                key={autoSelectionUrl}
                isActive={selectedNode === autoSelectionUrl}
                connectedNode={currentConnectedNode}
                totalNodes={getMainNetNodes().length}
            />
        );
    }

    function recalculateLatency(event: any, feedback: () => void) {
        routerTransitioner.doLatencyUpdate(true, false, 1).finally(() => {
            forceRerender({});
            feedback();
        });
    }

    const connectedNode = getConnectedNode();

    const allNodesExceptConnected = nodes
        .map((node: any) => getNode(node))
        .filter((node: any) => {
            return (
                (connectedNode == null || node.url !== connectedNode.url) &&
                node.url !== autoSelectionUrl
            );
        })
        .sort((a: any, b: any) => {
            const isTestnet = isTestNet(a.url);
            if (!!a.ping && !!b.ping) {
                return a.ping - b.ping;
            } else if (!a.ping && !b.ping) {
                if (isTestnet) return -1;
                return 1;
            } else if (!!a.ping && !b.ping) {
                return -1;
            } else if (!!b.ping && !a.ping) {
                return 1;
            }
            return 0;
        });

    let nodesToShow: any[];
    let onlyPersonalNodeActive = false;
    if (activeTab === "my_nodes") {
        nodesToShow = allNodesExceptConnected.filter((node: any) =>
            nodeIsPersonal(node)
        );
        onlyPersonalNodeActive =
            !!connectedNodeIsPersonal() && nodesToShow.length === 0;
    } else if (activeTab === "available_nodes") {
        nodesToShow = allNodesExceptConnected.filter(
            (node: any) => node.default && !node.hidden && !isTestNet(node.url)
        );
    } else if (activeTab === "testnet_nodes") {
        nodesToShow = allNodesExceptConnected.filter((node: any) =>
            isTestNet(node.url)
        );
    } else {
        nodesToShow = allNodesExceptConnected.filter(
            (node: any) => node.hidden && !isTestNet(node.url)
        );
    }

    const backgroundPinging =
        !!routerTransitioner &&
        (routerTransitioner as any).isBackgroundPingingInProgress();

    return (
        <div style={{paddingTop: "1em"}}>
            {renderAutoSelection(connectedNode)}
            <div style={{clear: "both"}} />
            <div className="active-node">
                <LoadingButton
                    style={{float: "right"}}
                    isLoading={backgroundPinging}
                    caption="settings.ping"
                    loadingType="inside-feedback-resize"
                    loadingMessage="settings.pinging"
                    onClick={recalculateLatency}
                />
                <Translate
                    component="h4"
                    style={{marginLeft: "1rem"}}
                    content="settings.active_node"
                />
                {renderNode(connectedNode, connectedNode)}
            </div>
            <div
                className="nodes"
                style={{
                    position: "relative",
                    marginBottom: "2em"
                }}
            >
                <div className="grid-block shrink" style={{marginLeft: 0}}>
                    {[
                        "available_nodes",
                        "my_nodes",
                        "hidden_nodes",
                        "testnet_nodes"
                    ].map(key => {
                        return (
                            <div
                                key={key}
                                className={cnames("nodes-header clickable", {
                                    inactive: activeTab !== key
                                })}
                                onClick={() => setActiveTab(key)}
                            >
                                <Translate content={"settings." + key} />
                            </div>
                        );
                    })}
                </div>
                {activeTab === "my_nodes" && (
                    <div
                        style={{paddingLeft: "1rem", paddingBottom: "1rem"}}
                    >
                        <Button type="primary" onClick={showAddNodeModal}>
                            <Translate
                                id="add"
                                component="span"
                                content="settings.add_api"
                            />
                        </Button>
                    </div>
                )}
                {activeTab === "testnet_nodes" && (
                    <Translate
                        component="p"
                        content={"settings.testnet_nodes_disclaimer"}
                    />
                )}
                {nodesToShow.map((node: any) => renderNode(node, connectedNode))}
                {onlyPersonalNodeActive ? (
                    <div className="api-node">
                        <p
                            className="api-node-title"
                            style={{padding: "1rem"}}
                        >
                            <Translate content="settings.personal_active" />
                        </p>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
