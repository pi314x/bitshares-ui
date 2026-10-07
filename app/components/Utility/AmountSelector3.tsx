// TypeScript/functional-component port of the legacy AmountSelector3.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import {Row} from "../../design-system/Row";
import {Col} from "../../design-system/Col";
import {Tooltip} from "../../design-system/Tooltip";
import AmountSelector from "../Utility/AmountSelectorStyleGuide";
import ChainSelect from "./ChainSelect";

interface AmountSelector3Props {
    label?: string;
    asset?: string;
    assets?: any[];
    amount?: string;
    onAmountChange?: (value: any) => void;
    onSearch?: (value: any) => void;
    imgName?: string;
    placeholderAmount?: string;
    tooltipText?: any;
}

function AmountSelector3({
    label,
    asset,
    assets,
    amount,
    onAmountChange,
    onSearch,
    imgName: imgNameProp = "unknown",
    placeholderAmount = "0.0",
    tooltipText
}: AmountSelector3Props) {
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

    const chainSelector = <ChainSelect />;

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
            assets={assets}
            placeholder={placeholderAmount}
            onSearch={onSearch}
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
                        {chainSelector}
                    </Tooltip>
                    {amountSelector}
                </Col>
            </Row>
        </div>
    );
}

export default AmountSelector3;
