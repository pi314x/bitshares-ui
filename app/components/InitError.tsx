// TypeScript/functional-component port of the legacy InitError.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `ApplicationApi`, `.add_type_operation`, `process_transaction`
// - none appear. This screen only lets the user pick/add an API node
// during the app's initial connection phase.
//
// `connect(InitError, {listenTo: [BlockchainStore, SettingsStore],
// getProps})` - unlike the sibling `SyncError.tsx`, every field returned
// by `getProps()` here (`rpc_connection_status`, `apis`, `apiServer`,
// `defaultConnection`) is genuinely read somewhere in the file (grepped) -
// replicated with `useAltStore(BlockchainStore)` +
// `useAltStore(SettingsStore)`.
//
// `UNSAFE_componentWillReceiveProps` (dispatches `SettingsActions
// .showWS(nextProps.apiServer)` when the connection just opened and
// `apiServer` changed) becomes a mount-skip `useEffect` keyed on
// `[apiServer]` - reading `rpc_connection_status` directly inside the
// effect body gives the same "current, post-commit" value the original's
// `nextProps.rpc_connection_status` read, since the effect closure
// captures the latest render's props.
//
// Dropped as confirmed dead (grepped): `ref="ws_modal"` on
// `WebsocketAddModal` - `this.refs.ws_modal` is never read anywhere in
// this file (distinct from the identically-named but genuinely-dead ref
// in the sibling `SyncError.tsx`, whose own dead `triggerModal` methods
// were the only thing referencing it there either).
//
// Preserved verbatim, not "fixed": this file's `<WebsocketAddModal>`
// call only ever passed `isAddNodeModalVisible`/`onAddNodeClose`/`apis` -
// never `api`/`removeNode`/`isRemoveNodeModalVisible`/
// `onRemoveNodeClose`/`changeConnection`, all of which the separately-
// ported `Settings/WebsocketAddModal.tsx` now types as required. Checked
// that component's internal usage: `isRemoveNodeModalVisible` undefined
// just keeps its "remove node" sub-modal closed, and `removeNode`/
// `changeConnection` are only read from within that same, consequently
// unreachable, sub-modal - the same category of pre-existing, dormant
// gap already documented in `AccessSettings.tsx`'s header comment for
// `SyncError.tsx`'s identical omission. Cast with `as any` to compile
// past the stricter required-prop type rather than inventing handlers
// that were never there.
import * as React from "react";
import BlockchainStore from "stores/BlockchainStore";
import SettingsStore from "stores/SettingsStore";
import Translate from "react-translate-component";
import WebsocketAddModal from "./Settings/WebsocketAddModal";
import SettingsActions from "actions/SettingsActions";
import {Apis} from "bitsharesjs-ws";
import {Form, Select, Button, Input} from "bitshares-ui-style-guide";
import counterpart from "counterpart";
import {useAltStore} from "../next/hooks/useAltStore";

const WebsocketAddModalAny = WebsocketAddModal as any;

const optionalApis = {enableCrypto: true, enableOrders: true};

export default function InitError() {
    const blockchainState = useAltStore<any>(BlockchainStore);
    const settingsState = useAltStore<any>(SettingsStore);

    const rpc_connection_status = blockchainState.rpc_connection_status;
    const apis = settingsState.defaults.apiServer;
    const apiServer = settingsState.settings.get("apiServer");
    const defaultConnection = settingsState.defaultSettings.get("apiServer");

    const [isModalVisible, setIsModalVisible] = React.useState(false);

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            return;
        }
        if (rpc_connection_status === "open") {
            (SettingsActions as any).showWS(apiServer);
        }
    }, [apiServer]);

    const handleModalClose = () => {
        setIsModalVisible(false);
    };

    const triggerModal = () => {
        setIsModalVisible(true);
    };

    const onChangeWS = (value: any) => {
        (SettingsActions as any).changeSetting({
            setting: "apiServer",
            value: value
        });
        (Apis as any).reset(value, true, 4000, optionalApis);
    };

    const onReloadClick = (e?: any) => {
        if (e) {
            e.preventDefault();
        }
        if ((window as any).electron) {
            window.location.hash = "";
            (window as any).remote.getCurrentWindow().reload();
        } else window.location.href = (window as any).__BASE_URL__;
    };

    const onReset = () => {
        (SettingsActions as any).changeSetting({
            setting: "apiServer",
            value: defaultConnection
        });
        (SettingsActions as any).clearSettings();
    };

    const uniqueNodes = apis.reduce((a: any[], node: any) => {
        // node is the minimum requirement of filled data to connect
        if (!!node && !!node.url) {
            const exists =
                a.findIndex(n => {
                    return n.url === node.url;
                }) !== -1;
            if (!exists) a.push(node);
        }
        return a;
    }, []);

    const selectOptions = uniqueNodes.map((entry: any) => {
        const onlyDescription =
            entry.url.indexOf("fake.automatic-selection") !== -1;
        let {location} = entry;
        if (
            !!location &&
            typeof location === "object" &&
            "translate" in location
        )
            location = counterpart.translate(location.translate);

        return (
            <Select.Option key={entry.url} value={entry.url}>
                {location || entry.url}{" "}
                {!onlyDescription && location ? `(${entry.url})` : null}
            </Select.Option>
        );
    });

    return (
        <div className="grid-block">
            <div className="grid-container">
                <div className="grid-content no-overflow">
                    <br />
                    <Translate component="h3" content={`app_init.title`} />

                    <Form layout="vertical">
                        <Form.Item
                            label={counterpart.translate("settings.apiServer")}
                        >
                            <Input.Group compact>
                                <Select
                                    style={{width: "calc(100% - 175px)"}}
                                    onChange={onChangeWS}
                                    value={apiServer}
                                >
                                    {selectOptions}
                                </Select>
                                <Button
                                    id="add"
                                    style={{width: "175px"}}
                                    onClick={triggerModal}
                                    icon={"plus"}
                                >
                                    {counterpart.translate("settings.add_api")}
                                </Button>
                            </Input.Group>
                        </Form.Item>

                        <Form.Item
                            label={counterpart.translate(
                                "app_init.ws_status"
                            )}
                        >
                            {rpc_connection_status === "open" ? (
                                <span className="txtlabel success">
                                    <Translate content={`app_init.connected`} />
                                </span>
                            ) : (
                                <span className="txtlabel warning">
                                    <Translate
                                        content={`app_init.not_connected`}
                                    />
                                </span>
                            )}
                        </Form.Item>

                        <Button type={"primary"} onClick={onReloadClick}>
                            {counterpart.translate(`app_init.retry`)}
                        </Button>
                        <Button
                            style={{marginLeft: "16px"}}
                            onClick={onReset}
                        >
                            {counterpart.translate(`settings.reset`)}
                        </Button>
                    </Form>

                    <WebsocketAddModalAny
                        isAddNodeModalVisible={isModalVisible}
                        onAddNodeClose={handleModalClose}
                        apis={apis}
                    />
                </div>
            </div>
        </div>
    );
}
