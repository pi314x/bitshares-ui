// TypeScript/functional-component port of the legacy AmountSelector2.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import {Row, Col, Tooltip} from "bitshares-ui-style-guide";
import AmountSelector from "../Utility/AmountSelectorStyleGuide";
import AssetSelect from "../Utility/AssetSelect";

interface AmountSelector2Props {
    label?: string;
    assetInput?: string;
    asset?: string;
    assets?: any[];
    amount?: string;
    disabled?: boolean;
    onAssetInputChange?: (value: any) => void;
    onAmountChange?: (value: any) => void;
    onImageError?: (event: any) => void;
    onSearch?: (value: any) => void;
    imgName?: string;
    placeholderAmount?: string;
    placeholder?: string;
    tooltipText?: any;
}

function AmountSelector2({
    label,
    assetInput,
    asset,
    assets,
    amount,
    disabled = false,
    onAssetInputChange,
    onSearch,
    onAmountChange,
    imgName: imgNameProp = "unknown",
    placeholder = "",
    placeholderAmount = "0.0",
    tooltipText
}: AmountSelector2Props) {
    const [imageError, setImageError] = React.useState(false);
    const prevImgNameRef = React.useRef(imgNameProp);

    React.useEffect(() => {
        if (
            !!imgNameProp &&
            imgNameProp !== prevImgNameRef.current &&
            imgNameProp !== "unknown"
        ) {
            setImageError(false);
        }
        prevImgNameRef.current = imgNameProp;
    }, [imgNameProp]);

    const onImageError = () => {
        setImageError(true);
    };

    const imgName = imageError ? "unknown" : imgNameProp;

    const labelText = (
        <Translate
            className="left-label"
            component="label"
            content={label}
            style={{
                fontSize: "1.2rem",
                margin: "0",
                padding: "0"
            }}
        />
    );

    const assetSelector = (
        <AssetSelect
            placeholder={placeholder}
            showSearch={true}
            value={!!assetInput ? assetInput : undefined}
            onChange={onAssetInputChange}
            assets={assets}
            onSearch={onSearch}
        />
    );

    const image = (
        <img
            style={{
                width: "3.5rem",
                height: "3.5rem",
                marginTop: "0.5rem"
            }}
            onError={onImageError}
            src={`${__BASE_URL__}asset-symbols/${imgName.toLowerCase()}.png`}
        />
    );

    const amountSelector = (
        <AmountSelector
            onChange={onAmountChange}
            amount={amount}
            asset={asset}
            assets={[asset]}
            placeholder={placeholderAmount}
            disabled={disabled}
        />
    );

    return (
        <div
            className="amount-selector-2"
            style={{
                minWidth: "3.5rem",
                width: "100%"
            }}
        >
            {labelText}
            <Row
                style={{
                    minWidth: "18rem"
                }}
            >
                <Col
                    style={{
                        minWidth: "3.5rem"
                    }}
                    span={5}
                >
                    {image}
                </Col>
                <Col span={19}>
                    <Tooltip placement="top" title={tooltipText}>
                        {assetSelector}
                    </Tooltip>
                    {amountSelector}
                </Col>
            </Row>
        </div>
    );
}

export default AmountSelector2;
