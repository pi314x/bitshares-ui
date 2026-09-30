// TypeScript/functional-component port of the legacy PrivateKeyView.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `onShow` unlocks the wallet and
// extracts the raw private key for `pubkey` via `WalletDb
// .getPrivateKey(pubkey).toWif()`, storing the WIF in component state so
// it can be shown/QR-coded on demand - transcribed verbatim. Grepped
// this file for `console.*` - no matches, the key is never logged.
// `onHide` clears it back to `null`.
//
// Dropped as confirmed dead (grepped): `ref={modalId}` (a legacy string
// ref computed from a dynamic key, `"key_view_modal" + pubkey`) - never
// read via `this.refs[modalId]` anywhere in the file.
//
// TS-forced cast: `state.wif` is typed `string | null` (matching the
// original's `null` initial value) but the already-ported
// `Modal/QrcodeModal.tsx` types its `keyValue` prop as `string |
// undefined` - cast with `as any` at that one call site, no behavior
// change. Also dropped the `showModal` prop passed to `<QrcodeModal>` -
// that already-ported component's own props type has no `showModal`
// field at all (confirmed unread anywhere in that file), so passing it
// is now a compile error rather than a silently-ignored extra prop;
// `showQrModal` itself stays live via its other call site (the QR icon's
// `onClick`).
import * as React from "react";
import WalletUnlockActions from "actions/WalletUnlockActions";
import WalletDb from "stores/WalletDb";
import Translate from "react-translate-component";
import PrivateKeyStore from "stores/PrivateKeyStore";
import QrcodeModal from "./Modal/QrcodeModal";
import counterpart from "counterpart";
import {Modal, Button} from "bitshares-ui-style-guide";
import QR_IMG from "../assets/qr.png";

interface PrivateKeyViewState {
    isModalVisible: boolean;
    isQrModalVisible: boolean;
    wif: string | null;
}

function getInitialState(): PrivateKeyViewState {
    return {
        isModalVisible: false,
        isQrModalVisible: false,
        wif: null
    };
}

interface PrivateKeyViewProps {
    pubkey: string;
    children?: React.ReactNode;
}

export default function PrivateKeyView({
    pubkey,
    children
}: PrivateKeyViewProps) {
    const [state, setState] = React.useState<PrivateKeyViewState>(
        getInitialState
    );

    const reset = () => {
        setState(getInitialState());
    };

    const hideModal = () => {
        setState(prev => ({...prev, isModalVisible: false}));
    };

    const showModal = () => {
        setState(prev => ({...prev, isModalVisible: true}));
    };

    const hideQrModal = () => {
        setState(prev => ({...prev, isQrModalVisible: false}));
    };

    const showQrModal = () => {
        setState(prev => ({...prev, isQrModalVisible: true}));
    };

    const onOpen = () => {
        showModal();
    };

    const onClose = () => {
        reset();
        hideModal();
    };

    const onShow = () => {
        (WalletUnlockActions as any)
            .unlock()
            .then(() => {
                const private_key = (WalletDb as any).getPrivateKey(pubkey);
                setState(prev => ({...prev, wif: private_key.toWif()}));
            })
            .catch(() => {});
    };

    const onHide = () => {
        setState(prev => ({...prev, wif: null}));
    };

    const modalId = "key_view_modal" + pubkey;
    const keys = (PrivateKeyStore as any).getState().keys;

    const has_private = keys.has(pubkey);
    if (!has_private) return <span>{children}</span>;
    const key = keys.get(pubkey);

    const footer = [
        <Button key="cancel" onClick={onClose}>
            {counterpart.translate("transfer.close")}
        </Button>
    ];

    return (
        <span>
            <a onClick={onOpen}>{children}</a>
            <Modal
                visible={state.isModalVisible}
                title={counterpart.translate("account.perm.key_viewer")}
                id={modalId}
                onCancel={onClose}
                footer={footer}
            >
                <div className="grid-block vertical">
                    <div className="content-block">
                        <div className="grid-content">
                            <label>
                                <Translate content="account.perm.public" />
                            </label>
                            {pubkey}
                        </div>
                        <br />

                        <div className="grid-block grid-content">
                            <label>
                                <Translate content="account.perm.private" />
                            </label>
                            <div>
                                {state.wif ? (
                                    <span>
                                        <p style={{fontWeight: 600}}>
                                            {state.wif}
                                        </p>
                                        <div className="button-group">
                                            <div
                                                className="button"
                                                onClick={onHide}
                                            >
                                                hide
                                            </div>
                                            <div
                                                className="clickable"
                                                onClick={showQrModal}
                                            >
                                                <img
                                                    style={{height: 50}}
                                                    src={QR_IMG}
                                                />
                                            </div>
                                        </div>
                                    </span>
                                ) : (
                                    <span>
                                        <div
                                            className="button"
                                            onClick={onShow}
                                        >
                                            <Translate content="account.perm.show" />
                                        </div>
                                    </span>
                                )}
                            </div>
                        </div>
                        <br />

                        <div className="grid-block grid-content">
                            <label>
                                <Translate content="account.perm.brain" />
                            </label>
                            {key.brainkey_sequence == null
                                ? "Non-deterministic"
                                : key.brainkey_sequence}
                        </div>
                        <br />

                        {key.import_account_names &&
                        key.import_account_names.length ? (
                            <div className="grid-block grid-content">
                                <label>
                                    <Translate content="account.perm.from" />
                                </label>
                                {key.import_account_names.join(", ")}
                                <br />
                            </div>
                        ) : null}
                    </div>
                </div>
            </Modal>
            <QrcodeModal
                hideModal={hideQrModal}
                visible={state.isQrModalVisible}
                keyValue={state.wif as any}
            />
        </span>
    );
}
