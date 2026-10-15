// TypeScript/functional-component port of the legacy
// BrowserSupportModal.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import {getWalletName} from "branding";
import counterpart from "counterpart";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";

interface BrowserSupportModalProps {
    visible: boolean;
    hideModal: () => void;
    // Accepted but unused, matching the original: `App.jsx` passes a
    // `showModal` prop that this component has never read.
    showModal?: () => void;
}

export default function BrowserSupportModal({
    visible,
    hideModal
}: BrowserSupportModalProps) {
    const openLink = () => {
        // TS-forced cast, not a behavior change: `window.open` is typed
        // as returning `Window | null`, but the original set `.opener`
        // unconditionally (it would throw if the popup were blocked) -
        // preserved verbatim rather than adding a null guard that would
        // change what happens in that case.
        const newWnd: any = window.open(
            "https://www.google.com/chrome/browser/desktop/",
            "_blank"
        );
        newWnd.opener = null;
    };

    return (
        <Modal
            visible={visible}
            onCancel={hideModal}
            title={counterpart.translate("app_init.browser")}
            footer={[
                <Button key={"submit"} variant="accent" onClick={hideModal}>
                    {counterpart.translate("app_init.understand")}
                </Button>
            ]}
        >
            <div className="grid-block vertical no-overflow">
                <Translate
                    component="p"
                    content="app_init.browser_text"
                    wallet_name={getWalletName()}
                />
                <br />

                <p>
                    <a className="external-link" onClick={openLink}>
                        Google Chrome
                    </a>
                </p>
            </div>
        </Modal>
    );
}
