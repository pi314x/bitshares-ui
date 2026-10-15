// TypeScript/functional-component port of the legacy AmountSelector3.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import {Tooltip} from "../../design-system/Tooltip";
import AmountSelector from "../Utility/AmountSelectorStyleGuide";
import styles from "../QuickTrade/SellReceive.module.scss";

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

    const image = (
        <img
            className={styles.icon}
            onError={onImageError}
            src={`${__BASE_URL__}asset-symbols/${imgName.toLowerCase()}.png`}
            alt=""
        />
    );

    // No chain selector: it was a permanently disabled dropdown that only ever
    // showed "Select asset" (the BitShares chain is the only one), which read
    // as a broken control.
    return (
        <div className={styles.panel}>
            <Translate
                className={styles.title}
                component="label"
                content={label}
            />
            <div className={styles.body}>
                <Tooltip placement="top" title={tooltipText}>
                    {image}
                </Tooltip>
                <div className={styles.field}>
                    <AmountSelector
                        onChange={onAmountChange}
                        amount={amount}
                        asset={asset}
                        assets={assets}
                        placeholder={placeholderAmount}
                        onSearch={onSearch}
                    />
                </div>
            </div>
        </div>
    );
}

export default AmountSelector3;
