// TypeScript/functional-component port of the legacy QrcodeModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md (handles a raw private key passed in
// via `keyValue`): `onPasswordEnter` either AES-encrypts the key with
// the entered password (`Aes.fromSeed(pwd).encryptToHex(key)`) before
// rendering it as a QR code, or - if no password was entered - renders
// the key *unencrypted* as a QR code, exactly as the original does (not
// a bug introduced here; transcribed verbatim, no logging added).
//
// The real, load-bearing `ref="password_input"` (read via `.value` and
// `.setAttribute`) becomes a `useRef<HTMLInputElement>(null)`.
//
// `modalId` (declared as a required prop with a default) is never
// actually read anywhere in the original `render()` either - kept in
// the props type for caller compatibility, still unused here, matching
// the original.
import * as React from "react";
import counterpart from "counterpart";
import Translate from "react-translate-component";
import QRCode from "qrcode.react";
import {Aes} from "bitsharesjs";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";

interface QrcodeModalState {
    isShowQrcode: boolean;
    keyString: any;
}

interface QrcodeModalProps {
    visible: boolean;
    hideModal: () => void;
    modalId?: string;
    keyValue?: string;
}

export default function QrcodeModal({
    visible,
    hideModal,
    keyValue
}: QrcodeModalProps) {
    const getInitialState = (): QrcodeModalState => ({
        isShowQrcode: false,
        keyString: null
    });

    const [state, setState] = React.useState<QrcodeModalState>(
        getInitialState
    );

    const mergeState = (partial: Partial<QrcodeModalState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const passwordInputRef = React.useRef<HTMLInputElement>(null);

    const onClose = () => {
        if (passwordInputRef.current) passwordInputRef.current.value = "";
        setState(getInitialState());
    };

    const onCancel = () => {
        hideModal();
        onClose();
    };

    const onPasswordEnter = (e: any) => {
        e.preventDefault();
        const pwd = passwordInputRef.current
            ? passwordInputRef.current.value
            : "";
        const key = keyValue;
        if (pwd != null && pwd != "") {
            if (key !== undefined && key != null && key != "") {
                const pwd_aes = (Aes as any).fromSeed(pwd);
                const qrkey = pwd_aes.encryptToHex(key);
                mergeState({isShowQrcode: true, keyString: qrkey});
            }
        } else {
            //notify.error("You'd better enter a password to encrypt the qr code");
            mergeState({isShowQrcode: true, keyString: key});
        }
    };

    const onKeyDown = (e: any) => {
        if (e.keyCode === 13) onPasswordEnter(e);
    };

    let pos: any = null;
    if (state.isShowQrcode) pos = {textAlign: "center"};

    const footer: any[] = [];

    if (!state.isShowQrcode) {
        footer.push(
            <Button variant="accent" key="submit" onClick={onPasswordEnter}>
                {counterpart.translate("modal.ok")}
            </Button>
        );
    }

    footer.push(
        <Button key="cancel" onClick={onCancel}>
            {counterpart.translate("cancel")}
        </Button>
    );

    return (
        <Modal visible={visible} onCancel={onCancel} footer={footer}>
            <div className="text-center">
                <div style={{margin: "1.5rem 0"}}>
                    <Translate component="h4" content="modal.qrcode.title" />
                </div>
                <form
                    className="full-width"
                    style={{margin: "0 3.5rem"}}
                    onSubmit={onPasswordEnter}
                    noValidate
                >
                    <div className="form-group">
                        {state.isShowQrcode ? (
                            <section style={pos}>
                                <span
                                    style={{
                                        background: "#fff",
                                        padding: ".75rem",
                                        display: "inline-block"
                                    }}
                                >
                                    <QRCode
                                        size={256}
                                        value={state.keyString}
                                    />
                                </span>
                            </section>
                        ) : (
                            <section>
                                <label className="left-label">
                                    <Translate
                                        unsafe
                                        content="modal.qrcode.input_message"
                                    />
                                </label>
                                <input
                                    name="password"
                                    type="text"
                                    onFocus={() => {
                                        if (passwordInputRef.current)
                                            passwordInputRef.current.setAttribute(
                                                "type",
                                                "password"
                                            );
                                    }}
                                    ref={passwordInputRef}
                                    autoComplete="off"
                                    onKeyDown={onKeyDown}
                                />
                            </section>
                        )}
                    </div>
                </form>
            </div>
        </Modal>
    );
}
