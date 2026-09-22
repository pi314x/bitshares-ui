// TypeScript/functional-component port of the legacy
// WebsocketAddModal.jsx (the "add node" / "remove node" modal pair used
// by the Settings screen's node picker). Phase 2,
// docs/UI_MIGRATION_PLAN.md. Only touches which RPC node the app talks
// to, not wallet/signing state.
//
// Confirmed dead, dropped (verified by reading this whole file - no
// other file references these): the `type`/`remove` state fields, never
// read anywhere after being set in the constructor; the `close()` method
// and the `isModalVisible` state field it wrote, never called or read by
// anything (visibility is entirely controlled by the
// `isAddNodeModalVisible`/`isRemoveNodeModalVisible` props from
// Settings.tsx); and the string ref `ref="ws_modal_add"` on the add
// modal, never read via `this.refs` anywhere (the `id="ws_modal_add"` is
// kept, in case anything external targets it by DOM id).
import * as React from "react";
import Translate from "react-translate-component";
import SettingsActions from "actions/SettingsActions";
import counterpart from "counterpart";
import {Modal, Button, Form, Input} from "bitshares-ui-style-guide";

const ws = "ws://";
const wss = "wss://";

interface WebsocketAddModalProps {
    apis: any;
    api: any;
    removeNode: any;
    isAddNodeModalVisible: boolean;
    isRemoveNodeModalVisible: boolean;
    onAddNodeClose: () => void;
    onRemoveNodeClose: () => void;
    changeConnection: (nextApiServer: string) => void;
}

export default function WebsocketAddModal({
    apis,
    api,
    removeNode,
    isAddNodeModalVisible,
    isRemoveNodeModalVisible,
    onAddNodeClose,
    onRemoveNodeClose,
    changeConnection
}: WebsocketAddModalProps) {
    const protocolRef = React.useRef(window.location.protocol);
    const [wsValue, setWsValue] = React.useState(wss);
    const [name, setName] = React.useState("My node");
    const [addError, setAddError] = React.useState<boolean | null>(null);
    const [existsError, setExistsError] = React.useState<boolean | null>(
        null
    );

    function apiExists(url: string) {
        return !!apis.find((a: any) => a.url === url);
    }

    function onServerInput(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value;

        setWsValue(value);
        setExistsError(apiExists(value) ? true : null);
        setAddError(
            value.indexOf(wss) !== 0 && value.indexOf(ws) !== 0 ? true : null
        );
    }

    function onNameInput(e: React.ChangeEvent<HTMLInputElement>) {
        setName(e.target.value);
    }

    function onAddSubmit(e: React.FormEvent) {
        e.preventDefault();

        SettingsActions.addWS({location: name, url: wsValue});

        setWsValue(protocolRef.current === "https:" ? wss : ws);
        setName("");
        onAddNodeClose();
    }

    function onRemoveSubmit(e: React.FormEvent) {
        e.preventDefault();
        let removeIndex: any;
        apis.forEach((a: any, index: number) => {
            if (a.url === removeNode.url) {
                removeIndex = index;
            }
        });

        // Set default if removing currently active API server
        if (api === apis[removeIndex].url) {
            (SettingsActions.changeSetting as any).defer({
                setting: "apiServer",
                value: apis[0].url
            });
            changeConnection(apis[0].url);
        }

        SettingsActions.removeWS(removeIndex);
        onRemoveNodeClose();
    }

    function renderAddModal() {
        let help = "";
        let validateStatus = "";

        if (existsError) {
            validateStatus = "error";
            help = counterpart.translate("settings.node_already_exists");
        }

        if (addError) {
            validateStatus = "error";
            help = counterpart.translate("settings.valid_node_url");
        }

        return (
            <Modal
                visible={isAddNodeModalVisible}
                id="ws_modal_add"
                title={counterpart.translate("settings.add_ws")}
                overlay={true}
                onCancel={onAddNodeClose}
                overlayClose={false}
                footer={[
                    <Button
                        key="confirm"
                        type="primary"
                        disabled={!!addError || !!existsError}
                        onClick={onAddSubmit}
                    >
                        {counterpart.translate("transfer.confirm")}
                    </Button>,
                    <Button key="cancel" onClick={onAddNodeClose}>
                        {counterpart.translate("account.perm.cancel")}
                    </Button>
                ]}
            >
                <div className="grid-content">
                    <Form layout="vertical">
                        <Form.Item label="Name">
                            <Input onChange={onNameInput} value={name} />
                        </Form.Item>

                        <Form.Item
                            label="Address"
                            validateStatus={validateStatus}
                            help={help}
                        >
                            <Input value={wsValue} onChange={onServerInput} />
                        </Form.Item>
                    </Form>
                </div>
            </Modal>
        );
    }

    function renderRemoveModal() {
        if (!api) {
            return null;
        }

        const footer = [
            <Button key="submit" onClick={onRemoveSubmit}>
                {counterpart.translate("transfer.confirm")}
            </Button>,
            <Button key="cancel" type="primary" onClick={onRemoveNodeClose}>
                {counterpart.translate("modal.cancel")}
            </Button>
        ];

        return (
            <Modal
                onCancel={onRemoveNodeClose}
                title={counterpart.translate("settings.remove_ws")}
                visible={isRemoveNodeModalVisible}
                footer={footer}
            >
                <div className="grid-content no-overflow">
                    <section className="block-list">
                        <p>
                            <Translate
                                component="span"
                                content="settings.confirm_remove"
                                with={{
                                    name: removeNode && removeNode.name
                                }}
                            />
                        </p>
                    </section>
                </div>
            </Modal>
        );
    }

    return (
        <div>
            {renderAddModal()}
            {renderRemoveModal()}
        </div>
    );
}
