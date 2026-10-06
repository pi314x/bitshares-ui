// TypeScript/functional-component port of the legacy FormattedAsset.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `AssetWrapper(Component)` HOC usage kept as-is (shared HOC, out of
// scope). `SupplyPercentage`'s `BindToChainState(Component)` HOC replaced
// by a Container+Core split under `useChainStoreTick()`, as in prior
// batches.
//
// Dropped as confirmed dead (visible directly in the file, no grep
// needed): `this.state.isPopoverOpen` plus its `togglePopover`/
// `closePopover` methods - defined but never read or passed to any child
// in `render()`.
import * as React from "react";
import {FormattedNumber} from "react-intl";
import utils from "common/utils";
import assetUtils from "common/asset_utils";
import {Popover} from "../../design-system/Popover";
import HelpContent from "./HelpContent";
import AssetName from "./AssetName";
import Pulsate from "./Pulsate";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import AssetWrapper from "./AssetWrapper";

/**
 *  Given an amount and an asset, render it with proper precision
 *
 *  Expected Properties:
 *     asset:  asset id, which will be fetched from the
 *     amount: the ammount of asset
 *
 */

interface SupplyPercentageProps {
    amount: any;
    colorClass: string;
    do: any;
}

function SupplyPercentageCore({
    amount,
    colorClass,
    dynamicObject
}: {
    amount: any;
    colorClass: string;
    dynamicObject: any;
}) {
    const supply = parseInt(dynamicObject.get("current_supply"), 10);
    const percent = utils.format_number((amount / supply) * 100, 4);
    return <span className={colorClass}>{percent}%</span>;
}

function SupplyPercentage({amount, colorClass, do: doProp}: SupplyPercentageProps) {
    useChainStoreTick();
    const dynamicObject = doProp ? ChainStore.getObject(doProp) : doProp;

    if (!dynamicObject) {
        return <span />;
    }

    return (
        <SupplyPercentageCore
            amount={amount}
            colorClass={colorClass}
            dynamicObject={dynamicObject}
        />
    );
}

interface FormattedAssetProps {
    amount?: any; // amount could be undefined or null when component is loading
    exact_amount?: boolean;
    decimalOffset?: number;
    color?: string;
    asset?: any;
    hide_asset?: boolean;
    hide_amount?: boolean;
    asPercentage?: boolean;
    assetInfo?: React.ReactNode;
    trimZero?: boolean;
    pulsate?: any;
    noTip?: boolean;
    noPrefix?: boolean;
    replace?: boolean;
}

function FormattedAsset({
    amount = null,
    exact_amount,
    decimalOffset = 0,
    color,
    asset: assetProp,
    hide_asset = false,
    hide_amount = false,
    asPercentage = false,
    assetInfo = null,
    trimZero = false,
    pulsate,
    noTip,
    noPrefix,
    replace = true
}: FormattedAssetProps) {
    if (amount === undefined || amount == null) return null; // still loading

    let asset = assetProp;
    if (asset && asset.toJS) asset = asset.toJS();

    let colorClass = color ? "facolor-" + color : "";

    const precision = utils.get_asset_precision(asset.precision);

    const decimals = Math.max(0, asset.precision - decimalOffset);
    if (hide_amount) {
        colorClass += " no-amount";
    }

    if (asPercentage) {
        return (
            <SupplyPercentage
                amount={amount}
                colorClass={colorClass}
                do={asset.dynamic_asset_data_id}
            />
        );
    }

    const issuer = ChainStore.getObject(asset.issuer, false, false);
    const issuerName = issuer ? issuer.get("name") : "";

    const description = assetUtils.parseDescription(asset.options.description);

    const currency_popover_body = !hide_asset &&
        assetInfo && (
            <div>
                <HelpContent
                    path={"assets/Asset"}
                    section="summary"
                    symbol={asset.symbol}
                    description={
                        description.short_name
                            ? description.short_name
                            : description.main
                    }
                    issuer={issuerName}
                />
                {assetInfo}
            </div>
        );

    let formattedValue: React.ReactNode = null;
    if (!hide_amount) {
        const value = exact_amount ? amount : amount / precision;
        formattedValue = (
            <FormattedNumber
                value={value}
                minimumFractionDigits={Math.max(decimals, 0)}
                maximumFractionDigits={Math.max(decimals, 0)}
            />
        );
        if (trimZero) {
            formattedValue = (
                <FormattedNumber
                    value={value}
                    minimumFractionDigits={0}
                    maximumFractionDigits={Math.max(decimals, 0)}
                />
            );
        }

        if (pulsate) {
            const pulsateProps = typeof pulsate !== "object" ? {} : pulsate;
            formattedValue = (
                <Pulsate value={value} {...pulsateProps}>
                    {formattedValue}
                </Pulsate>
            );
        }
    }
    return (
        <span className={colorClass}>
            {formattedValue}
            {!hide_asset &&
                (assetInfo ? (
                    <span>
                        &nbsp;
                        <Popover
                            trigger="click"
                            content={currency_popover_body}
                            mouseEnterDelay={0.5}
                        >
                            <span className="currency click-for-help">
                                <AssetName name={asset.symbol} />
                            </span>
                        </Popover>
                    </span>
                ) : (
                    <span className="currency">
                        {!hide_amount ? <span>&nbsp;</span> : null}
                        <AssetName
                            noTip={noTip}
                            noPrefix={noPrefix}
                            name={asset.symbol}
                            replace={replace}
                        />
                    </span>
                ))}
        </span>
    );
}

export default AssetWrapper(FormattedAsset);
