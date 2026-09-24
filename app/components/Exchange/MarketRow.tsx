// TypeScript/functional-component port of the legacy MarketRow.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - one row of the markets list
// (`MyMarkets.jsx`, not yet ported, its only caller). Mechanical,
// line-for-line translation, no logic changes.
//
// Structural change (same substitution used throughout this migration):
// `AssetWrapper(MarketRow, {propNames: ["quote", "base"], withDynamic:
// true, defaultProps: {tempComponent: "tr"}})` replaced with a
// `MarketRowContainer` + `MarketRow` split resolving `quote`/`base` via
// `ChainStore.getAsset` under `useChainStoreTick()`, with
// `getDynamicObject(id)` as a direct `ChainStore.getObject(id)` read -
// the same simplification already validated for `Asset.tsx`/
// `AccountAssetUpdate.tsx`. The `tempComponent: "tr"` customization is
// preserved: the loading-gate placeholder is `<tr />`, not this
// migration's usual `<span />` - a `<span>` inside a `<table>` (this
// component always renders as a table row) would be invalid HTML, which
// is exactly why the original set that option.
//
// `withRouter` (only ever used for `location.pathname`/`history.push` in
// `_onClick`) becomes `useHistory()`/`useLocation()`. The caller
// (`MyMarkets.jsx`) also passes explicit `location`/`history` props, but
// those were always shadowed by `withRouter`'s own injected values
// (spread after the wrapped props in react-router v5), so they were
// already inert; the hooks read the same always-current router context
// directly.
//
// `shouldComponentUpdate`'s shallow-prop-equality check
// (`!utils.are_equal_shallow(nextProps, this.props)`) is, by
// construction, the same comparison `React.memo`'s *default* (no custom
// comparator) behavior performs - so it's preserved via a plain
// `React.memo(MarketRow)`, not dropped: this is a real optimization for
// a component rendered in a list inside the highest-update-frequency
// part of the app, not one of this migration's previously-confirmed
// always-true no-op SCU gates.
import * as React from "react";
import {useHistory, useLocation} from "react-router-dom";
import FormattedAsset from "../Utility/FormattedAsset";
import AccountName from "../Utility/AccountName";
import utils from "common/utils";
import Icon from "../Icon/Icon";
import MarketsActions from "actions/MarketsActions";
import SettingsActions from "actions/SettingsActions";
import {Tooltip} from "bitshares-ui-style-guide";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface MarketRowProps {
    quote: any;
    base: any;
    getDynamicObject: (id: string) => any;
    noSymbols?: boolean;
    stats?: any;
    starred?: boolean;
    leftAlign?: boolean;
    compact?: boolean;
    columns: any[];
    current?: boolean;
    name?: any;
    isChecked?: boolean;
    isDefault?: boolean;
    onCheckMarket?: (...args: any[]) => any;
    removeMarket?: (...args: any[]) => any;
}

function MarketRow({
    quote,
    base,
    getDynamicObject,
    stats,
    starred,
    leftAlign,
    compact,
    columns,
    current,
    name,
    isChecked,
    isDefault,
    onCheckMarket,
    removeMarket
}: MarketRowProps) {
    const history = useHistory();
    const location = useLocation();
    const statsIntervalRef = React.useRef<any>(null);

    React.useEffect(() => {
        if (base.get && base.get("id") && quote.get && quote.get("id")) {
            statsIntervalRef.current = (MarketsActions as any).getMarketStatsInterval(
                35 * 1000,
                base,
                quote
            );
        }
        return () => {
            if (statsIntervalRef.current) statsIntervalRef.current();
        };
        // eslint-disable-next-line
    }, []);

    function onClick(marketID: string) {
        const newPath = `/market/${marketID}`;
        if (newPath !== location.pathname) {
            (MarketsActions as any).switchMarket();
            history.push(`/market/${marketID}`);
        }
    }

    function onStar(quoteSymbol: string, baseSymbol: string, e: any) {
        e.preventDefault();
        if (!starred) {
            (SettingsActions as any).addStarMarket(quoteSymbol, baseSymbol);
        } else {
            (SettingsActions as any).removeStarMarket(quoteSymbol, baseSymbol);
        }
    }

    if (!quote || !base) {
        return null;
    }

    const marketID = quote.get("symbol") + "_" + base.get("symbol");
    const marketName = quote.get("symbol") + ":" + base.get("symbol");
    const dynamic_data = getDynamicObject(quote.get("dynamic_asset_data_id"));
    const base_dynamic_data = getDynamicObject(
        base.get("dynamic_asset_data_id")
    );

    const price = (utils as any).convertPrice(quote, base);

    const rowStyles: any = {};
    if (leftAlign) {
        rowStyles.textAlign = "left";
    }

    let buttonClass = "button outline";
    let buttonStyle: any = null;
    if (compact) {
        buttonClass += " no-margin";
        buttonStyle = {
            marginBottom: 0,
            fontSize: "0.75rem",
            padding: "4px 10px",
            borderRadius: "0px",
            letterSpacing: "0.05rem"
        };
    }

    const renderedColumns: any[] = columns
        .map((column: any) => {
            switch (column.name) {
                case "star": {
                    const starClass = starred ? "gold-star" : "grey-star";
                    return (
                        <td
                            onClick={(e: any) =>
                                onStar(
                                    quote.get("symbol"),
                                    base.get("symbol"),
                                    e
                                )
                            }
                            key={column.index}
                        >
                            <Icon
                                className={starClass}
                                name="fi-star"
                                title="icons.fi_star.symbol"
                            />
                        </td>
                    );
                }

                case "vol": {
                    const amount = stats ? stats.volumeBase : 0;
                    return (
                        <td
                            onClick={() => onClick(marketID)}
                            className="text-right"
                            key={column.index}
                        >
                            {(utils as any).format_volume(amount)}
                        </td>
                    );
                }

                case "change": {
                    const change = (utils as any).format_number(
                        stats && stats.change ? stats.change : 0,
                        2
                    );
                    const changeClass =
                        change === "0.00"
                            ? ""
                            : change > 0
                            ? "change-up"
                            : "change-down";

                    return (
                        <td
                            onClick={() => onClick(marketID)}
                            className={"text-right " + changeClass}
                            key={column.index}
                        >
                            {change + "%"}
                        </td>
                    );
                }

                case "marketName":
                    return (
                        <td onClick={() => onClick(marketID)} key={column.index}>
                            <div className={buttonClass} style={buttonStyle}>
                                {marketName}
                            </div>
                        </td>
                    );

                case "market":
                    return (
                        <td onClick={() => onClick(marketID)} key={column.index}>
                            {name}
                        </td>
                    );

                case "price": {
                    const finalPrice =
                        stats && stats.price
                            ? stats.price.toReal()
                            : stats &&
                              stats.close &&
                              stats.close.quote.amount &&
                              stats.close.base.amount
                            ? (utils as any).get_asset_price(
                                  stats.close.quote.amount,
                                  quote,
                                  stats.close.base.amount,
                                  base,
                                  true
                              )
                            : (utils as any).get_asset_price(
                                  price.quote.amount,
                                  quote,
                                  price.base.amount,
                                  base,
                                  true
                              );

                    const highPrecisionAssets = [
                        "BTC",
                        "OPEN.BTC",
                        "TRADE.BTC",
                        "GOLD",
                        "SILVER"
                    ];
                    let precision = 6;
                    if (highPrecisionAssets.indexOf(base.get("symbol")) !== -1) {
                        precision = 8;
                    }

                    return (
                        <td
                            onClick={() => onClick(marketID)}
                            className="text-right"
                            key={column.index}
                        >
                            {(utils as any).format_number(
                                finalPrice,
                                finalPrice > 1000
                                    ? 0
                                    : finalPrice > 10
                                    ? 2
                                    : precision
                            )}
                        </td>
                    );
                }

                case "quoteSupply":
                    return (
                        <td onClick={() => onClick(marketID)} key={column.index}>
                            {dynamic_data ? (
                                <FormattedAsset
                                    style={{fontWeight: "bold"}}
                                    amount={parseInt(
                                        dynamic_data.get("current_supply"),
                                        10
                                    )}
                                    asset={quote.get("id")}
                                />
                            ) : null}
                        </td>
                    );

                case "baseSupply":
                    return (
                        <td onClick={() => onClick(marketID)} key={column.index}>
                            {base_dynamic_data ? (
                                <FormattedAsset
                                    style={{fontWeight: "bold"}}
                                    amount={parseInt(
                                        base_dynamic_data.get(
                                            "current_supply"
                                        ),
                                        10
                                    )}
                                    asset={base.get("id")}
                                />
                            ) : null}
                        </td>
                    );

                case "issuer":
                    return (
                        <td onClick={() => onClick(marketID)} key={column.index}>
                            <AccountName account={quote.get("issuer")} />
                        </td>
                    );

                case "add":
                    return (
                        <td
                            style={{textAlign: "right"}}
                            key={column.index}
                            onClick={() =>
                                onCheckMarket && onCheckMarket(marketID)
                            }
                        >
                            <Tooltip
                                title={
                                    isDefault
                                        ? "This market is a default market and cannot be removed"
                                        : null
                                }
                            >
                                <input
                                    type="checkbox"
                                    checked={!!isChecked || !!isDefault}
                                    disabled={isDefault}
                                />
                            </Tooltip>
                        </td>
                    );

                case "remove":
                    return (
                        <td
                            key={column.index}
                            className="clickable"
                            onClick={removeMarket}
                        >
                            <span
                                style={{
                                    marginBottom: "6px",
                                    marginRight: "6px",
                                    zIndex: 999
                                }}
                                className="text float-right remove"
                            >
                                –
                            </span>
                        </td>
                    );

                default:
                    break;
            }
        })
        // The original compared with a bare `a.key > b.key`, relying on
        // JS's own boolean->number coercion inside the sort algorithm
        // (true -> 1, false -> 0). TS's Array.sort types require a
        // numeric return, so it's made explicit here with the exact same
        // coercion - zero behavioral difference.
        .sort((a: any, b: any) => +(a.key > b.key));

    let className = "clickable";
    if (current) {
        className += " activeMarket";
    }

    return (
        <tr className={className} style={rowStyles}>
            {renderedColumns}
        </tr>
    );
}

const MemoizedMarketRow = React.memo(MarketRow);

function MarketRowContainer(props: any) {
    useChainStoreTick();
    const quote = (ChainStore as any).getAsset(props.quote);
    const base = (ChainStore as any).getAsset(props.base);

    if (!quote || !base) {
        return <tr />;
    }

    function getDynamicObject(id: string) {
        return (ChainStore as any).getObject(id);
    }

    return (
        <MemoizedMarketRow
            {...props}
            quote={quote}
            base={base}
            getDynamicObject={getDynamicObject}
        />
    );
}

export default MarketRowContainer;
