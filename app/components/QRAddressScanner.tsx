// TypeScript/functional-component port of the legacy QRAddressScanner.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: purely scans a QR code and
// forwards the decoded text/address to `onSuccess`.
//
// `react-qr-reader` ships no type declarations - added to `app/types
// /vendor-shims.d.ts` (the established pattern for such packages).
//
// `label` (declared in `propTypes`, passed as `label="Scan"` by both real
// callers - `Modal/WithdrawModalNew.tsx`, `Transfer/ScanOrEnterText.tsx`)
// is never read anywhere in the file (grepped) - kept in the props type
// as accepted-but-unused, matching this migration's established
// treatment of such cases.
import * as React from "react";
import QrReader from "react-qr-reader";
import counterpart from "counterpart";
import {Modal, Button, Icon} from "bitshares-ui-style-guide";

interface QRScannerState {
    address?: any;
    amount?: any;
}

interface QRScannerProps {
    onSuccess?: (result: {address: any; amount: any}) => void;
    onError?: (err: any) => void;
    label?: string;
    submitBtnText: React.ReactNode;
    dataFoundText: React.ReactNode;
}

const modalId = "qr_scanner_modal";

function isBitcoinAddress(data: string) {
    return /bitcoin:([a-zA-Z0-9]+)/.test(data);
}

function parseBitcoinAddress(str: string) {
    const address = str.match(/bitcoin:([a-zA-Z0-9]+)/);
    const amount = str.match(/amount=([0-9\.]+)/);
    return {
        address: (address && address[1]) || null,
        amount: (amount && amount[1]) || null
    };
}

export default function QRScanner({
    onSuccess,
    onError,
    submitBtnText,
    dataFoundText
}: QRScannerProps) {
    const [visible, setVisible] = React.useState(false);
    const [state, setState] = React.useState<QRScannerState>({});

    const handleClick = () => {
        setVisible(true);
    };

    const handleClose = () => {
        setVisible(false);
    };

    const onScanSuccess = (data: string) => {
        if (isBitcoinAddress(data)) {
            const result = parseBitcoinAddress(data);
            if (result) {
                setState({address: result.address, amount: result.amount});
            }
        } else {
            setState({address: data, amount: null});
        }
    };

    const retry = () => {
        setState({address: null, amount: null});
    };

    const submit = () => {
        handleClose();
        if (typeof onSuccess === "function") {
            onSuccess({address: state.address, amount: state.amount});
        }
    };

    const handleError = (err: any) => {
        if (typeof onError === "function") onError(err);
    };

    const handleScan = (data: any) => {
        if (data) {
            onScanSuccess(data);
        }
    };

    return (
        <div className="qr-address-scanner">
            <Icon
                type="camera"
                onClick={handleClick}
                style={{fontSize: "24px", padding: 5}}
            />
            <Modal
                visible={visible}
                className="qr-address-scanner-modal"
                modalHeader="global.scan_qr_code"
                id={modalId}
                overlay={true}
                closable={false}
                footer={
                    !state.address ? (
                        <div style={{justifyContent: "center"}}>
                            <Button onClick={handleClose}>Close</Button>
                        </div>
                    ) : (
                        <div style={{justifyContent: "center"}}>
                            {[
                                <Button onClick={retry} key="qr-retry-button">
                                    {counterpart.translate(
                                        "qr_address_scanner.retry"
                                    )}
                                </Button>,
                                <Button
                                    key="qr-submit-button"
                                    type="primary"
                                    onClick={submit}
                                >
                                    {submitBtnText}
                                </Button>
                            ]}
                        </div>
                    )
                }
                onCancel={handleClose}
            >
                <QrReader
                    delay={100}
                    onError={handleError}
                    onScan={handleScan}
                    style={{
                        width: "calc(100% - 48px)",
                        margin: "0 24px"
                    }}
                />

                {state.address && (
                    <div>
                        <div className="qr-address-scanner-status">
                            <div className="qr-address-scanner-status-title">
                                {dataFoundText}
                            </div>
                            <div className="qr-address-scanner-status-address">
                                {state.address}
                            </div>

                            {state.amount && (
                                <div className="qr-address-scanner-status-title">
                                    {counterpart.translate(
                                        "qr_address_scanner.amount"
                                    )}
                                </div>
                            )}
                            {state.amount && (
                                <div className="qr-address-scanner-status-amount">
                                    {state.amount}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
