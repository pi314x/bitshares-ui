// TypeScript/function-component port of the legacy SellReceive.jsx (Phase
// 8, docs/UI_MIGRATION_PLAN.md) - a pure, stateless leaf used only by
// `QuickTrade.tsx` to render its sell/receive `AmountSelector3` pair plus
// the swap icon between them. Mechanical translation, no logic changes.
//
// Not security-sensitive per AGENTS.md: this file never touches
// `WalletDb`, never builds or signs a transaction, and has no
// `console.*` calls at all (grepped) - it only renders two
// `AmountSelector3` inputs and forwards their callbacks to its parent.
//
// `onReceiveAssetSearch` is read from props in the original's `render()`
// despite never being declared in its `static propTypes` - added to the
// new `SellReceiveProps` interface as a real (optional) field, per this
// migration's established convention for such props.
//
// TS-forced adjustment: `AmountSelector3` (already ported in an earlier
// batch - see `Utility/AmountSelector3.tsx`) no longer declares
// `assetInput`/`onAssetInputChange`/`placeholder` on its props interface.
// This is not a regression introduced by this port - diffing against the
// pre-TypeScript `AmountSelector3.jsx` (via git history) shows its
// `render()` already destructured those same three props (plus
// `onImageError`) without ever reading them anywhere in its JSX, so they
// were already silently dropped on the floor before either component was
// touched by this migration. Passing them here would now be a TypeScript
// excess-property error against `AmountSelector3Props`, so they're
// dropped from both `<AmountSelector3>` call sites below (the already-
// dead `sellImgName`/`receiveImgName` + `onSwap`/`isSwappable` plumbing
// that actually matters is untouched). `sellAssetInput`/
// `onSellAssetInputChange`/`receiveAssetInput`/`onReceiveAssetInputChange`
// stay on `SellReceiveProps` (QuickTrade.tsx still passes all four) but
// are no longer destructured/used in this component's own body, for the
// same reason - they were already only ever forwarded to the two now-
// ignoring `assetInput`/`onAssetInputChange` slots.
//
// Also TS-forced: `Icon`'s `style` prop is typed `React.CSSProperties |
// undefined` (no `| null`), so the original's `style={... : null}`
// ternary becomes `style={... : undefined}` - both mean "no inline
// style", not a behavior change. Similarly, the swap button's inline
// `btnStyle` dropped the original's `align: "center"` entry: `align` is
// not a real CSS property (browsers silently ignore it on a `<div>`,
// confirmed inert in the original too), but it is also not a key of
// `React.CSSProperties`, so TypeScript rejects it outright - dropped
// rather than cast away, since it never had any visible effect.
import * as React from "react";
import AmountSelector3 from "../Utility/AmountSelector3";
import Icon from "../Icon/Icon";
import {Row} from "../../design-system/Row";
import {Col} from "../../design-system/Col";

export interface SellReceiveProps {
    sellAssetInput?: string;
    sellAsset?: string;
    sellAssets?: any[];
    sellAmount?: string;
    sellImgName?: string;
    receiveAssetInput?: string;
    receiveAsset?: string;
    receiveAssets?: any[];
    receiveAmount?: string;
    receiveImgName?: string;
    onSellAssetInputChange: (assetIdOrSymbol: any) => void;
    onSellAmountChange: (value: any) => void;
    onReceiveAssetInputChange: (assetIdOrSymbol: any) => void;
    onReceiveAmountChange: (value: any) => void;
    onReceiveAssetSearch?: (value: any) => void;
    onSwap: () => void;
    isSwappable?: boolean;
}

function SellReceive({
    sellAsset,
    sellAssets,
    sellAmount,
    sellImgName,
    receiveAsset,
    receiveAssets,
    receiveAmount,
    receiveImgName,
    onSellAmountChange,
    onReceiveAssetSearch,
    onReceiveAmountChange,
    onSwap,
    isSwappable
}: SellReceiveProps) {
    const smallScreen = window.innerWidth < 850 ? true : false;

    const sellSelector = (
        <AmountSelector3
            label={"exchange.sell"}
            asset={sellAsset}
            assets={sellAssets}
            amount={sellAmount}
            onAmountChange={onSellAmountChange}
            imgName={sellImgName}
        />
    );

    const receiveSelector = (
        <AmountSelector3
            label={"exchange.receive"}
            asset={receiveAsset}
            assets={receiveAssets}
            amount={receiveAmount}
            onSearch={onReceiveAssetSearch}
            onAmountChange={onReceiveAmountChange}
            imgName={receiveImgName}
        />
    );

    const btnStyle: React.CSSProperties & {opacity?: number} = {
        display: "flex",
        justifyContent: "center"
    };

    if (!isSwappable) {
        btnStyle.opacity = 0.1;
    }

    const swapButton = (
        <div style={btnStyle}>
            <Icon
                name="swap"
                size="2x"
                style={
                    !smallScreen
                        ? {
                              marginTop: "3rem"
                          }
                        : undefined
                }
                onClick={onSwap}
            />
        </div>
    );

    return (
        <div>
            {smallScreen ? (
                <div>
                    <Row>{sellSelector}</Row>
                    <Row>{swapButton}</Row>
                    <Row>{receiveSelector}</Row>
                </div>
            ) : (
                <Row>
                    <Col span={10}>{sellSelector}</Col>
                    <Col span={4}>{swapButton}</Col>
                    <Col span={10}>{receiveSelector}</Col>
                </Row>
            )}
        </div>
    );
}

export default SellReceive;
