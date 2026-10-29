// An asset's logo as a small round image, or - for an asset without one - its
// first letter in a circle (as the wallet extension draws it). Decorative: the
// symbol is always written next to it, so the image has no alt text.
import * as React from "react";
import {assetLetter, assetLogoName} from "../../lib/common/assetLogo";
import styles from "./AssetLogo.module.scss";

export interface AssetLogoProps {
    symbol: string | null | undefined;
    /** Width and height in px (default 20). */
    size?: number;
    className?: string;
    /** For an asset without a logo file: its letter in a circle (default), or
     * nothing. */
    fallback?: "letter" | "none";
}

export function AssetLogo({
    symbol,
    size = 20,
    className,
    fallback = "letter"
}: AssetLogoProps): JSX.Element | null {
    const name = assetLogoName(symbol);
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => setFailed(false), [name]);

    const box = {width: size, height: size};
    const classes = [styles.logo, className].filter(Boolean).join(" ");
    if (name && !failed) {
        return (
            <img
                className={classes}
                style={box}
                src={`${__BASE_URL__}asset-symbols/${name}.png`}
                alt=""
                loading="lazy"
                onError={() => setFailed(true)}
            />
        );
    }
    if (fallback === "none") return null;
    return (
        <span
            className={`${classes} ${styles.letter}`}
            style={{...box, fontSize: Math.max(9, Math.round(size * 0.5))}}
            aria-hidden="true"
        >
            {assetLetter(symbol)}
        </span>
    );
}

export default AssetLogo;
