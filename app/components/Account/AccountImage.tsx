// TypeScript/functional-component port of the legacy AccountImage.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `shouldComponentUpdate` is a pure props shallow-equality performance
// guard - not replicated, per this migration's established treatment of
// pure perf guards.
import * as React from "react";
import Identicon from "./Identicon";

interface AccountImageProps {
    src?: string;
    account?: string;
    image?: string;
    size?: {height: number; width: number};
    [key: string]: any;
    style?: React.CSSProperties;
}

function AccountImage({
    account = "",
    image,
    style = {},
    size = {height: 120, width: 120}
}: AccountImageProps) {
    const {height, width} = size;
    const custom_image = image ? (
        <img src={image} height={height + "px"} width={width + "px"} />
    ) : (
        <Identicon id={account} account={account} size={size} />
    );

    return (
        <div style={style} className="account-image">
            {custom_image}
        </div>
    );
}

export default AccountImage;
