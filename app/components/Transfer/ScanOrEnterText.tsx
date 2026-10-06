// TypeScript/functional-component port of the legacy ScanOrEnterText.jsx
// (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import {Input} from "../../design-system/Input";
import QRScanner from "../QRAddressScanner";

interface ScanOrEnterTextProps {
    labelContent?: React.ReactNode;
    handleQrScanSuccess: (data: any) => void;
    onInputChange: (event: any) => void;
    inputValue?: string;
    submitBtnText?: React.ReactNode;
    dataFoundText?: React.ReactNode;
}

export default function ScanOrEnterText({
    labelContent,
    handleQrScanSuccess,
    onInputChange,
    inputValue,
    submitBtnText,
    dataFoundText
}: ScanOrEnterTextProps) {
    return (
        <div style={{marginBottom: "1em"}}>
            <label className="left-label">{labelContent}</label>

            <div>
                <div className="inline-label">
                    <Input.TextArea
                        style={{marginBottom: 0}}
                        rows={3}
                        onChange={onInputChange}
                        value={inputValue}
                    />
                    <span>
                        <QRScanner
                            label="Scan"
                            onSuccess={handleQrScanSuccess}
                            submitBtnText={submitBtnText}
                            dataFoundText={dataFoundText}
                        />
                    </span>
                </div>
            </div>
        </div>
    );
}
