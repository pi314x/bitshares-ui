// TypeScript/functional-component port of the legacy FormattedPrice.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `AssetWrapper(Component, {propNames: [...]})` and `withRouter(...)`
// wrapping is kept as-is around the exported component, same as the
// original.
//
// Structural change (not a behavior change): the outer wrapper's
// `AltContainer` (`alt-container` package, injecting `marketDirections`
// from `SettingsStore`) is replaced by `useAltStore(SettingsStore)`.
//
// `UNSAFE_componentWillReceiveProps` (recomputes `marketName`/`first`/
// `second` when `base_asset`/`quote_asset` change) is replicated with a
// `useEffect` keyed on those two props, skipped on its first (mount) run
// via a ref guard, since mount's initial value is already correctly
// computed by the `useState` lazy initializer.
//
// `shouldComponentUpdate` is a pure props/state shallow-equality
// performance guard (no `componentDidUpdate` in this class depends on
// it) - not replicated, per this migration's established treatment of
// pure perf guards.
//
//  Given an amount and an asset, render it with proper precision
//
//  Expected Properties:
//     base_asset:  asset id, which will be fetched from the
//     base_amount: the ammount of asset
//     quote_asset:
//     quote_amount: the ammount of asset
import * as React from "react";
import {FormattedNumber} from "react-intl";
import AssetWrapper from "./AssetWrapper";
import SettingsStore from "stores/SettingsStore";
import SettingsActions from "actions/SettingsActions";
import Popover from "react-popover";
import Translate from "react-translate-component";
import AssetName from "./AssetName";
import Pulsate from "./Pulsate";
import marketUtils from "common/market_utils";
import {Asset, Price} from "common/MarketClasses";
import {useNavigate, Link} from "react-router-dom";
import {Tooltip} from "bitshares-ui-style-guide";
import MarketsActions from "actions/MarketsActions";
import {useAltStore} from "../../next/hooks/useAltStore";

const LinkComponent = Link as React.ComponentType<any>;

interface FormattedPriceProps {
    base_asset: any;
    quote_asset: any;
    base_amount?: any;
    quote_amount?: any;
    decimals?: number;
    marketDirections: any;
    hide_symbols?: boolean;
    noPopOver?: boolean;
    pulsate?: any;
    hide_value?: boolean;
    ignorePriceFeed?: boolean;
    factor?: number;
    negative_invert?: boolean;
    noInvertTip?: boolean;
    noTip?: boolean;
    force_direction?: any;
    invert?: boolean;
}

function FormattedPrice({
    base_asset,
    quote_asset,
    base_amount: base_amountProp,
    quote_amount: quote_amountProp,
    decimals: decimalsProp,
    marketDirections,
    hide_symbols,
    noPopOver,
    pulsate: pulsateProp,
    hide_value,
    ignorePriceFeed,
    factor,
    negative_invert,
    noInvertTip,
    noTip,
    force_direction,
    invert
}: FormattedPriceProps) {
    // react-router v6 no longer injects `history` as a prop (dropped
    // `withRouter` at this file's export below) - `useNavigate()`
    // replaces it.
    const navigate = useNavigate();
    const [{marketName, first, second}, setMarketInfo] = React.useState(() =>
        marketUtils.getMarketName(base_asset, quote_asset)
    );
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            return;
        }
        setMarketInfo(marketUtils.getMarketName(base_asset, quote_asset));
    }, [base_asset, quote_asset]);

    const togglePopover = (e: any) => {
        e.preventDefault();
        setIsPopoverOpen(prev => !prev);
    };

    const closePopover = () => {
        setIsPopoverOpen(false);
    };

    const onFlip = () => {
        const setting: any = {};

        setting[marketName] = !marketDirections.get(marketName);
        SettingsActions.changeMarketDirection(setting);
    };

    const goToMarket = (e: any) => {
        e.preventDefault();
        const inverted = marketDirections.get(marketName);
        MarketsActions.switchMarket();
        navigate(
            `/market/${
                !inverted ? first.get("symbol") : second.get("symbol")
            }_${!inverted ? second.get("symbol") : first.get("symbol")}`
        );
    };

    if (!first || !second) return <span>--</span>;
    let inverted = marketDirections.get(marketName) || invert;
    if (
        force_direction &&
        second.get("symbol") === force_direction &&
        inverted
    ) {
        inverted = false;
    } else if (
        force_direction &&
        first.get("symbol") === force_direction &&
        !inverted
    ) {
        inverted = true;
    }
    let base, quote;
    if (inverted) {
        base = second;
        quote = first;
    } else {
        base = first;
        quote = second;
    }
    let base_amount = base_amountProp;
    let quote_amount = quote_amountProp;
    if (base.get("id") !== base_asset.get("id")) {
        const tempAmount = base_amount;
        base_amount = quote_amount;
        quote_amount = tempAmount;
    }

    let price;
    try {
        price = new (Price as any)({
            quote: new (Asset as any)({
                asset_id: base.get("id"),
                precision: base.get("precision"),
                amount: base_amount
            }),
            base: new (Asset as any)({
                asset_id: quote.get("id"),
                precision: quote.get("precision"),
                amount: quote_amount
            })
        });
    } catch (err) {
        return null;
    }

    let formatted_value: React.ReactNode = "";
    if (!hide_value) {
        let value = !ignorePriceFeed
            ? price.toReal()
            : quote_amount / base_amount;
        if (factor) {
            if (negative_invert) {
                value = inverted ? value * factor : value / factor;
            } else {
                value = inverted ? value / factor : value * factor;
            }
        }

        if (isNaN(value) || !isFinite(value)) {
            return <span>--</span>;
        }
        let decimals = decimalsProp ? decimalsProp : price.base.precision;
        decimals = Math.min(8, decimals);
        formatted_value = (
            <FormattedNumber
                value={value}
                minimumFractionDigits={Math.max(2, decimals)}
                maximumFractionDigits={Math.max(2, decimals)}
            />
        );

        if (pulsateProp) {
            const pulsate = typeof pulsateProp !== "object" ? {} : pulsateProp;
            formatted_value = (
                <Pulsate value={value} {...pulsate}>
                    {formatted_value}
                </Pulsate>
            );
        }
    }
    let tipText = "Click to invert the price";
    if (noInvertTip) {
        tipText = "";
    }
    const symbols = hide_symbols ? (
        ""
    ) : (
        <Tooltip placement="bottom" title={noPopOver ? tipText : null}>
            <span
                className={noPopOver ? "clickable inline-block" : ""}
                onClick={noPopOver ? onFlip : undefined}
            >
                <AssetName name={quote.get("symbol")} noTip={!noTip} />
                /
                <AssetName name={base.get("symbol")} noTip={!noTip} />
            </span>
        </Tooltip>
    );

    const currency_popover_body =
        !noPopOver && !hide_symbols ? (
            <div>
                <div className="button" onClick={onFlip}>
                    <Translate content="exchange.invert" />
                </div>
                <div className="button" onClick={goToMarket}>
                    <Translate content="exchange.to_market" />
                </div>
                <LinkComponent
                    className="button"
                    to={{
                        pathname: "/instant-trade",
                        state: {
                            preselectedSellAssetId: quote_asset.get("id"),
                            preselectedReceiveAssetId: base_asset.get("id")
                        }
                    }}
                >
                    <Translate content="exchange.quick_trade" />
                </LinkComponent>
            </div>
        ) : null;

    const popOver = currency_popover_body ? (
        <Popover
            isOpen={isPopoverOpen}
            onOuterAction={closePopover}
            body={currency_popover_body}
        >
            <span className="currency click-for-help" onClick={togglePopover}>
                {symbols}
            </span>
        </Popover>
    ) : null;

    return (
        <span className="formatted-price">
            {formatted_value} {popOver ? popOver : symbols}
        </span>
    );
}

const WrappedFormattedPrice: React.ComponentType<any> = AssetWrapper(
    FormattedPrice,
    {
        propNames: ["base_asset", "quote_asset"]
    }
);

interface FormattedPriceWrapperProps {
    [key: string]: any;
}

function FormattedPriceWrapper(props: FormattedPriceWrapperProps) {
    const settingsState = useAltStore<any>(SettingsStore);
    return (
        <WrappedFormattedPrice
            {...props}
            marketDirections={settingsState.marketDirections}
        />
    );
}

export default FormattedPriceWrapper;
