// TypeScript/functional-component port of the legacy ExchangeHeader.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - the Exchange screen's top bar:
// the quote/base symbol pair, the market-picker toggles, the favorite
// star, and the price-ticker stats strip (built from
// `PriceStatWithLabel.tsx`, already ported). Rendered by `Exchange.jsx`
// (not yet ported, its only caller). Mechanical translation, no logic
// changes.
//
// Confirmed dead, dropped: the local `isModalVisible` state field -
// initialized, never read or set again anywhere in the file.
//
// Confirmed accepted-but-unused (kept in the props interface since the
// still-legacy caller, `Exchange.jsx`, supplies them, but never actually
// read in `render()`): `showVolumeChart`, `lowestAsk`, `highestBid`.
// `tinyScreen` is the inverse case - it *is* read (for a font-size
// ternary), but `Exchange.jsx`'s call site never actually supplies it,
// so that ternary always currently resolves to its `false` branch in
// practice. None of these are "fixed" here, since the fix (wiring the
// prop through, or dropping the dead read) belongs to whoever ports
// `Exchange.jsx` itself, not this file in isolation.
//
// `shouldComponentUpdate` is unlike this phase's other confirmed-real SCU
// gates (which compared specific prop subsets): `if (!nextProps.marketReady)
// return false; return true;` is an unconditional "block all renders while
// the market isn't ready, otherwise never block" gate - not a shallow
// comparison at all. Preserved via a `React.memo` comparator that's the
// direct translation: `!nextProps.marketReady` (skip whenever not ready,
// otherwise always treat props as changed).
//
// `UNSAFE_componentWillReceiveProps` unconditionally re-syncs local
// `selectedMarketPickerAsset` state from the incoming prop on every
// update (no condition at all - a classic "prop-seeded, locally
// overridable until the next external update" pattern, since `marketPicker()`
// below can also set this state directly in response to a click).
// Replicated with a `[selectedMarketPickerAsset (prop)]`-keyed effect,
// guarded to skip its first (mount) run, since the initial `useState`
// seed already covers that case.
import * as React from "react";
import {Link, LinkProps} from "react-router-dom";
import Icon from "../Icon/Icon";
import AssetName from "../Utility/AssetName";
import MarketsActions from "actions/MarketsActions";
import SettingsActions from "actions/SettingsActions";
import PriceStatWithLabel from "./PriceStatWithLabel";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import ExchangeHeaderCollateral from "./ExchangeHeaderCollateral";
import {Icon as AntIcon} from "bitshares-ui-style-guide";
import {Asset, Price} from "common/MarketClasses";

const TypedLink = Link as React.ComponentType<LinkProps>;

interface ExchangeHeaderProps {
    quoteAsset: any;
    baseAsset: any;
    starredMarkets: any;
    hasPrediction: boolean;
    feedPrice: any;
    showCallLimit?: boolean;
    lowestCallPrice?: any;
    marketReady: boolean;
    latestPrice?: any;
    marketStats: any;
    account: any;
    selectedMarketPickerAsset?: any;
    onToggleMarketPicker: (...args: any[]) => any;
    onTogglePersonalize: (...args: any[]) => any;
    hasAnyPriceAlert?: boolean;
    showPriceAlertModal?: (...args: any[]) => any;
    tinyScreen?: boolean;
    showVolumeChart?: boolean;
    lowestAsk?: any;
    highestBid?: any;
}

function ExchangeHeaderInner(props: ExchangeHeaderProps) {
    const {
        quoteAsset,
        baseAsset,
        starredMarkets,
        hasPrediction,
        feedPrice,
        showCallLimit,
        lowestCallPrice,
        marketReady,
        latestPrice,
        marketStats,
        account,
        selectedMarketPickerAsset: selectedMarketPickerAssetProp,
        onToggleMarketPicker,
        onTogglePersonalize,
        hasAnyPriceAlert,
        showPriceAlertModal,
        tinyScreen
    } = props;

    const [volumeShowQuote, setVolumeShowQuote] = React.useState(true);
    const [
        selectedMarketPickerAsset,
        setSelectedMarketPickerAsset
    ] = React.useState(selectedMarketPickerAssetProp);

    const isFirstSyncEffect = React.useRef(true);
    React.useEffect(() => {
        if (isFirstSyncEffect.current) {
            isFirstSyncEffect.current = false;
            return;
        }
        setSelectedMarketPickerAsset(selectedMarketPickerAssetProp);
    }, [selectedMarketPickerAssetProp]);

    function addMarket(quote: string, base: string) {
        const marketID = `${quote}_${base}`;
        if (!starredMarkets.has(marketID)) {
            (SettingsActions as any).addStarMarket(quote, base);
        } else {
            (SettingsActions as any).removeStarMarket(quote, base);
        }
    }

    function changeVolumeBase() {
        setVolumeShowQuote(prev => !prev);
    }

    function marketPicker(asset: string) {
        const newSelected =
            !!selectedMarketPickerAsset && selectedMarketPickerAsset == asset
                ? null
                : asset;

        setSelectedMarketPickerAsset(newSelected);
        onToggleMarketPicker(newSelected);
    }

    const baseSymbol = baseAsset.get("symbol");
    const quoteSymbol = quoteAsset.get("symbol");

    // Favorite star
    const marketID = `${quoteSymbol}_${baseSymbol}`;
    const starClass = starredMarkets.has(marketID) ? "gold-star" : "grey-star";

    // Market stats
    const dayChange = marketStats.get("change");

    const dayChangeClass =
        parseFloat(dayChange) === 0 || isNaN(dayChange)
            ? ""
            : parseFloat(dayChange) < 0
            ? "negative"
            : "positive";
    const volumeBase = marketStats.get("volumeBase");
    const volumeQuote = marketStats.get("volumeQuote");
    const dayChangeWithSign = isNaN(dayChange)
        ? undefined
        : dayChange > 0
        ? "+" + dayChange
        : dayChange;

    const volume24h = volumeShowQuote ? volumeQuote : volumeBase;
    const volume24hAsset = volumeShowQuote ? quoteAsset : baseAsset;

    let showCollateralRatio = false;

    const quoteId = quoteAsset.get("id");
    const baseId = baseAsset.get("id");

    const lookForBitAsset =
        quoteId === "1.3.0" ? baseId : baseId === "1.3.0" ? quoteId : null;
    const possibleBitAsset = lookForBitAsset
        ? (ChainStore as any).getAsset(lookForBitAsset)
        : null;
    const isBitAsset = possibleBitAsset
        ? !!possibleBitAsset.get("bitasset")
        : false;
    let collOrderObject = "";
    let settlePrice: any = null;
    let settlePriceTitle = "exchange.settle";
    let settlePriceTooltip = "tooltip.settle_price";

    if (isBitAsset) {
        if (account.toJS && account.has("call_orders")) {
            const call_orders = account.get("call_orders").toJS();

            for (let i = 0; i < call_orders.length; i++) {
                const callID = call_orders[i];

                const position = (ChainStore as any).getObject(callID);
                const debtAsset = position.getIn([
                    "call_price",
                    "quote",
                    "asset_id"
                ]);

                if (debtAsset === lookForBitAsset) {
                    collOrderObject = callID;
                    showCollateralRatio = true;
                    break;
                }
            }
        }

        /* Settlment Offset */
        const settleAsset =
            baseId == "1.3.0"
                ? quoteAsset
                : quoteId == "1.3.0"
                ? baseAsset
                : quoteAsset;

        // globally settled
        if (possibleBitAsset.get("bitasset").get("settlement_fund") > 0) {
            settlePriceTitle = "exchange.global_settle";
            settlePriceTooltip = "tooltip.global_settle_price";
            // if globally settled feed_price == settlement_price
            settlePrice = possibleBitAsset
                .get("bitasset")
                .get("settlement_price")
                .toJS();
            // add precision
            if (settlePrice.base.asset_id == baseAsset.get("id")) {
                settlePrice.base.precision = baseAsset.get("precision");
                settlePrice.quote.precision = quoteAsset.get("precision");
            } else {
                settlePrice.quote.precision = baseAsset.get("precision");
                settlePrice.base.precision = quoteAsset.get("precision");
            }
            settlePrice = new (Price as any)({
                quote: new (Asset as any)({
                    asset_id: settlePrice.quote.asset_id,
                    precision: settlePrice.quote.precision,
                    amount: settlePrice.quote.amount
                }),
                base: new (Asset as any)({
                    asset_id: settlePrice.base.asset_id,
                    precision: settlePrice.base.precision,
                    amount: settlePrice.base.amount
                })
            }).toReal();
            settlePrice = baseId == "1.3.0" ? 1 / settlePrice : settlePrice;
        } else if (settleAsset && feedPrice) {
            const offset_percent = settleAsset
                .getIn(["bitasset", "options"])
                .toJS().force_settlement_offset_percent;
            settlePrice =
                baseId == "1.3.0"
                    ? feedPrice.toReal() / (1 + offset_percent / 10000)
                    : feedPrice.toReal() * (1 + offset_percent / 10000);
        }
    }

    const translator = counterpart;

    const isQuoteSelected =
        !!selectedMarketPickerAsset && selectedMarketPickerAsset == quoteSymbol;
    const isBaseSelected =
        !!selectedMarketPickerAsset && selectedMarketPickerAsset == baseSymbol;

    const PriceAlertBellClassName = hasAnyPriceAlert
        ? "exchange--price-alert--show-modal--active"
        : "";

    return (
        <div className="grid-block shrink no-padding overflow-visible top-bar">
            <div className="grid-block overflow-visible">
                <div className="grid-block shrink">
                    <div style={{padding: "10px"}}>
                        {!hasPrediction ? (
                            <div
                                style={{
                                    padding: "0 5px",
                                    fontSize: tinyScreen ? "13px" : "18px",
                                    marginTop: "1px"
                                }}
                            >
                                <AntIcon
                                    onClick={showPriceAlertModal}
                                    type={"bell"}
                                    className={`exchange--price-alert--show-modal ${PriceAlertBellClassName}`}
                                    data-intro={(translator as any).translate(
                                        "walkthrough.price_alerts"
                                    )}
                                />
                                <span
                                    onClick={() => marketPicker(quoteSymbol)}
                                    className="underline"
                                    style={{
                                        cursor: "pointer",
                                        color: isQuoteSelected
                                            ? "#2196f3"
                                            : ""
                                    }}
                                >
                                    <AssetName
                                        name={quoteSymbol}
                                        replace={true}
                                        noTip
                                    />
                                </span>
                                <span style={{padding: "0 5px"}}>/</span>
                                <span
                                    onClick={() => marketPicker(baseSymbol)}
                                    className="underline"
                                    style={{
                                        cursor: "pointer",
                                        color: isBaseSelected ? "#2196f3" : ""
                                    }}
                                >
                                    <AssetName
                                        name={baseSymbol}
                                        replace={true}
                                        noTip
                                    />
                                </span>
                            </div>
                        ) : (
                            <a className="market-symbol">
                                <span>{`${quoteSymbol} : ${baseSymbol}`}</span>
                            </a>
                        )}
                        <div
                            className="label-actions"
                            style={{padding: "5px 0 0 5px"}}
                        >
                            <Translate
                                component="span"
                                className="stat-text"
                                content="exchange.trading_pair"
                            />
                            <TypedLink
                                onClick={() => {
                                    (MarketsActions as any).switchMarket();
                                }}
                                to={`/market/${baseSymbol}_${quoteSymbol}`}
                                data-intro={(translator as any).translate(
                                    "walkthrough.switch_button"
                                )}
                            >
                                <Icon
                                    className="shuffle"
                                    name="shuffle"
                                    title="icons.shuffle"
                                />
                            </TypedLink>

                            <a
                                onClick={() => {
                                    addMarket(
                                        quoteAsset.get("symbol"),
                                        baseAsset.get("symbol")
                                    );
                                }}
                                data-intro={(translator as any).translate(
                                    "walkthrough.favourite_button"
                                )}
                            >
                                <Icon
                                    className={starClass}
                                    name="fi-star"
                                    title="icons.fi_star.market"
                                />
                            </a>
                        </div>
                    </div>
                </div>

                <div className="grid-block vertical" style={{overflow: "visible"}}>
                    <div className="grid-block wrap market-stats-container">
                        <ul className="market-stats stats top-stats">
                            {latestPrice ? (
                                <PriceStatWithLabel
                                    ignoreColorChange={true}
                                    ready={marketReady}
                                    price={latestPrice}
                                    quote={quoteAsset}
                                    base={baseAsset}
                                    market={marketID}
                                    content="exchange.latest"
                                />
                            ) : null}

                            <li
                                className={
                                    "hide-order-1 stressed-stat daily_change " +
                                    dayChangeClass
                                }
                            >
                                <span>
                                    <b className="value">
                                        {dayChangeWithSign
                                            ? marketReady
                                                ? dayChangeWithSign
                                                : 0
                                            : "-"}
                                    </b>
                                    {dayChangeWithSign && <span> %</span>}
                                </span>
                                <Translate
                                    component="div"
                                    className="stat-text"
                                    content="account.hour_24"
                                />
                            </li>

                            {volumeBase >= 0 ? (
                                <PriceStatWithLabel
                                    ignoreColorChange={true}
                                    onClick={changeVolumeBase}
                                    ready={marketReady}
                                    volume={true}
                                    price={volume24h}
                                    className="hide-order-2 clickable"
                                    base={volume24hAsset}
                                    market={marketID}
                                    content="exchange.volume_24"
                                />
                            ) : null}
                            {!hasPrediction && feedPrice ? (
                                <PriceStatWithLabel
                                    ignoreColorChange={true}
                                    toolTip={counterpart.translate(
                                        "tooltip.feed_price"
                                    )}
                                    ready={marketReady}
                                    className="hide-order-3"
                                    price={feedPrice.toReal()}
                                    quote={quoteAsset}
                                    base={baseAsset}
                                    market={marketID}
                                    content="exchange.feed_price"
                                />
                            ) : null}
                            {!hasPrediction && settlePrice ? (
                                <PriceStatWithLabel
                                    ignoreColorChange={true}
                                    toolTip={counterpart.translate(
                                        settlePriceTooltip
                                    )}
                                    ready={marketReady}
                                    className="hide-order-4"
                                    price={settlePrice}
                                    quote={quoteAsset}
                                    base={baseAsset}
                                    market={marketID}
                                    content={settlePriceTitle}
                                />
                            ) : null}
                            {showCollateralRatio ? (
                                <ExchangeHeaderCollateral
                                    object={collOrderObject}
                                    account={account}
                                    className="hide-order-1"
                                />
                            ) : null}
                            {lowestCallPrice && showCallLimit ? (
                                <PriceStatWithLabel
                                    toolTip={counterpart.translate(
                                        "tooltip.call_limit"
                                    )}
                                    ready={marketReady}
                                    className="hide-order-5 is-call"
                                    price={lowestCallPrice}
                                    quote={quoteAsset}
                                    base={baseAsset}
                                    market={marketID}
                                    content="explorer.block.call_limit"
                                />
                            ) : null}

                            {feedPrice && showCallLimit ? (
                                <PriceStatWithLabel
                                    toolTip={counterpart.translate(
                                        "tooltip.margin_price"
                                    )}
                                    ready={marketReady}
                                    className="hide-order-6 is-call"
                                    price={feedPrice.getSqueezePrice({
                                        real: true
                                    })}
                                    quote={quoteAsset}
                                    base={baseAsset}
                                    market={marketID}
                                    content="exchange.squeeze"
                                />
                            ) : null}
                        </ul>
                        <ul
                            className="market-stats stats top-stats"
                            data-position={"left"}
                            data-step="1"
                            data-intro={(translator as any).translate(
                                "walkthrough.personalize"
                            )}
                        >
                            <li
                                className="stressed-stat input clickable"
                                style={{padding: "16px 16px 16px 0px"}}
                                onClick={onTogglePersonalize}
                            >
                                <AntIcon type="setting" style={{paddingRight: 5}} />
                                <Translate
                                    className="hide-order-2"
                                    content="exchange.settings.header.title"
                                />
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

function arePropsEqual(
    prevProps: ExchangeHeaderProps,
    nextProps: ExchangeHeaderProps
) {
    return !nextProps.marketReady;
}

const ExchangeHeader = React.memo(ExchangeHeaderInner, arePropsEqual);

export default ExchangeHeader;
