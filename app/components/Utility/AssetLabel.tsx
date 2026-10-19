// An asset's logo and symbol, from the symbol alone: no chain lookup, so a drop-down of
// hundreds of assets costs nothing (`AssetName` resolves each asset through the chain).
import * as React from "react";
import AssetLogo from "./AssetLogo";
import styles from "./AssetLabel.module.scss";

export function AssetLabel({
    symbol,
    size = 18
}: {
    symbol: string;
    size?: number;
}): JSX.Element {
    return (
        <span className={styles.label}>
            <AssetLogo symbol={symbol} size={size} />
            <span className={styles.symbol}>{symbol}</span>
        </span>
    );
}

export default AssetLabel;
