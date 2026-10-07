// TypeScript/functional-component port of the legacy DepthHighChart.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - the order-book depth chart
// (Highcharts area chart of cumulative bids/asks, plus call/settle
// overlays), rendered by `Exchange.jsx` (not yet ported, its only
// caller). Mechanical translation, no logic changes; `ReactHighchart`
// itself (the third-party `react-highcharts` wrapper) is reused
// completely unchanged, still perfectly happy to receive a plain
// function-component-attached ref.
//
// `shouldComponentUpdate` is another confirmed-real (non-no-op) SCU gate
// this phase keeps finding, and an unusually elaborate one: it compares
// `orders`/`call_orders` via the imported `didOrdersChange` (a real
// order-list-aware diff, not just reference equality, reused unchanged
// from `common/MarketClasses`), plus `feedPrice` (checked *twice* -
// once via a NaN-guarded `settleCheck`, once via a bare `!==` - the bare
// check means that whenever `feedPrice` is consistently `NaN` across
// renders, `NaN !== NaN` is always `true` in JS, so that branch alone
// would force a re-render on every props change regardless of anything
// else; preserved exactly, not "fixed" with an `Object.is`-style
// comparison), `height`, `isPanelActive`, `activePanels`, `LCP`,
// `showCallLimit`, `hasPrediction`, and `marketReady` - deliberately
// *not* `base`/`quote`/`flat_bids`/`flat_asks`/`flat_calls`/
// `flat_settles`/`totalBids`/`totalAsks`/`theme`/`centerRef`/
// `invertedCalls`/`onClick`, all of which `render()` does read.
// Preserved via a `React.memo` comparator that's the direct inverse
// translation.
//
// `UNSAFE_componentWillUpdate`/`componentDidUpdate` together snapshot
// and restore an *external* `centerRef` element's `scrollTop` around
// this component's own re-render, to stop this component's DOM changes
// from visibly shifting an ancestor/sibling's scroll position. Hooks
// have no direct equivalent to `UNSAFE_componentWillUpdate`'s "runs
// during the render phase, before commit, but not on mount" timing -
// replicated by reading `centerRef.scrollTop` synchronously in the
// function body itself (which also runs during the render phase, before
// commit - the same timing guarantee, just also exercised harmlessly on
// the first render, whose captured value is never used since the
// restore effect below is mount-skipped same as the original) into a
// ref, then restoring it from a no-dependency-array effect guarded to
// skip its first (mount) run - matching `componentDidUpdate`'s own
// never-fires-on-mount semantics.
//
// `UNSAFE_componentWillReceiveProps`'s reflow-on-panel-change check
// needed the `refs.depthChart` ref to already exist, which only happens
// in the `!noFrame` branch (where `ReactHighchart` is actually
// rendered) - replicated with a `[activePanels]`-keyed effect, mount-
// guarded, checking the ref before reflowing, same as the original.
//
// Confirmed accepted-but-unused (kept in the props interface since the
// still-legacy caller supplies them, but never read anywhere in this
// file): `settles`, `spread`.
//
// Two stale, already-commented-out code blocks (a draft `plotLine`
// plot-line and a draft `SQP` plot-line, neither ever active) are
// omitted as informationally inert, same category of drop as
// `AccountAssetCreate.tsx`'s equivalent.
import * as React from "react";
import ReactHighchart from "react-highcharts";
import utils from "common/utils";
import counterpart from "counterpart";
import {cloneDeep} from "lodash-es";
import Translate from "react-translate-component";
import colors from "assets/colors";
import AssetName from "../Utility/AssetName";
import {didOrdersChange} from "common/MarketClasses";
import {numberExponentToLarge} from "../../lib/common/numberExplonentConversion";

interface DepthHighChartProps {
    flat_bids?: any[];
    flat_asks?: any[];
    flat_calls?: any[];
    flat_settles?: any;
    totalBids?: any;
    totalAsks?: any;
    base: any;
    quote: any;
    feedPrice?: any;
    orders?: any;
    call_orders?: any;
    height?: any;
    isPanelActive?: boolean;
    activePanels?: any;
    LCP?: any;
    showCallLimit?: boolean;
    hasPrediction?: boolean;
    marketReady?: boolean;
    invertedCalls?: boolean;
    onClick?: (...args: any[]) => any;
    noFrame?: boolean;
    noText?: boolean;
    theme?: any;
    centerRef?: any;
    settles?: any;
    spread?: any;
}

function DepthHighChartInner(props: DepthHighChartProps) {
    const {
        flat_bids = [],
        flat_asks = [],
        flat_calls,
        flat_settles,
        totalBids,
        totalAsks,
        base,
        quote,
        feedPrice,
        height,
        LCP,
        hasPrediction,
        invertedCalls,
        noFrame = true,
        noText,
        theme,
        centerRef,
        onClick
    } = props;

    const depthChartRef = React.useRef<any>(null);
    const tempScrollRef = React.useRef<number | undefined>(undefined);

    if (centerRef) {
        tempScrollRef.current = centerRef.scrollTop;
    }

    function reflowChart(timeout: number) {
        setTimeout(() => {
            if (depthChartRef.current) {
                depthChartRef.current.chart.reflow();
            }
        }, timeout);
    }

    React.useEffect(() => {
        reflowChart(500);
        // eslint-disable-next-line
    }, []);

    const isFirstActivePanelsEffect = React.useRef(true);
    React.useEffect(() => {
        if (isFirstActivePanelsEffect.current) {
            isFirstActivePanelsEffect.current = false;
            return;
        }
        if (depthChartRef.current) {
            reflowChart(100);
        }
        // eslint-disable-next-line
    }, [props.activePanels]);

    const isFirstDidUpdateEffect = React.useRef(true);
    React.useEffect(() => {
        if (isFirstDidUpdateEffect.current) {
            isFirstDidUpdateEffect.current = false;
            return;
        }
        if (centerRef) {
            centerRef.scrollTop = tempScrollRef.current;
        }
    });

    const {
        primaryText,
        callColor,
        settleColor,
        settleFillColor,
        bidColor,
        bidFillColor,
        askColor,
        askFillColor,
        axisLineColor
    } = (colors as any)[theme];

    const baseNameParts = (utils as any).replaceName(base);
    const quoteNameParts = (utils as any).replaceName(quote);
    const baseSymbol =
        (baseNameParts.prefix || "") + baseNameParts.name;
    const quoteSymbol =
        (quoteNameParts.prefix || "") + quoteNameParts.name;

    const flatBids = cloneDeep(flat_bids),
        flatAsks = cloneDeep(flat_asks),
        flatCalls = cloneDeep(flat_calls),
        flatSettles = cloneDeep(flat_settles);

    const config: any = {
        chart: {
            type: "area",
            backgroundColor: "rgba(255, 0, 0, 0)",
            spacing: [10, 0, 5, 0]
        },
        title: {
            text: null
        },
        credits: {
            enabled: false
        },
        legend: {
            enabled: false
        },
        rangeSelector: {
            enabled: false
        },
        navigator: {
            enabled: false
        },
        scrollbar: {
            enabled: false
        },
        dataGrouping: {
            enabled: false
        },
        tooltip: {
            shared: false,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            useHTML: true,
            formatter: function(this: any) {
                return `
					<table>
						<tr>
							<td>${counterpart.translate("exchange.price")}:</td>
							<td style="text-align: right">${(utils as any).format_number(
                                this.x,
                                base.get("precision")
                            )} ${baseSymbol}/${quoteSymbol}</td>
						</tr>
						<tr>
							<td>${counterpart.translate("exchange.quantity")}:</td>
							<td style="text-align: right">${(utils as any).format_number(
                                this.y,
                                quote.get("precision")
                            )} ${quoteSymbol}</td>
						</tr>
					</table>
					`;
            },
            style: {
                color: "#FFFFFF"
            }
        },
        series: [] as any[],
        yAxis: {
            labels: {
                enabled: true,
                style: {
                    color: primaryText
                },
                formatter: function(this: any) {
                    return (utils as any).format_number(
                        this.value,
                        quote.get("precision")
                    );
                }
            },
            opposite: false,
            title: {
                text: null,
                style: {
                    color: "#FFFFFF"
                }
            },
            gridLineWidth: 1,
            gridLineColor: "rgba(196, 196, 196, 0.30)",
            gridZIndex: 1,
            crosshair: {
                snap: false
            },
            currentPriceIndicator: {
                enabled: false
            }
        },
        xAxis: {
            labels: {
                style: {
                    color: primaryText
                },
                formatter: function(this: any) {
                    return numberExponentToLarge(this.value);
                }
            },
            ordinal: false,
            lineColor: "#000000",
            title: {
                text: null
            },
            plotLines: [] as any[]
        },
        plotOptions: {
            area: {
                animation: false,
                marker: {
                    enabled: false
                },
                series: {
                    enableMouseTracking: false
                }
            }
        }
    };

    // Center the charts between bids and asks
    if (flatBids.length > 0 && flatAsks.length > 0) {
        const middleValue =
            (flatAsks[0][0] + flatBids[flatBids.length - 1][0]) / 2;

        config.xAxis.min = middleValue * 0.4;
        config.xAxis.max = middleValue * 1.6;
        if (config.xAxis.max < flatAsks[0][0]) {
            config.xAxis.max = flatAsks[0][0] * 1.5;
        }
        if (config.xAxis.min > flatBids[flatBids.length - 1][0]) {
            config.xAxis.min = flatBids[flatBids.length - 1][0] * 0.5;
        }
        let yMax = 0;
        flatBids.forEach((b: any) => {
            if (b[0] >= config.xAxis.min) {
                yMax = Math.max(b[1], yMax);
            }
        });
        flatAsks.forEach((a: any) => {
            if (a[0] <= config.xAxis.max) {
                yMax = Math.max(a[1], yMax);
            }
        });
        config.yAxis.max = yMax * 1.15;

        // Adjust y axis label decimals
        const yLabelDecimals = yMax > 10 ? 0 : yMax > 1 ? 2 : 5;
        config.yAxis.labels.formatter = function() {
            return (utils as any).format_number(this.value, yLabelDecimals);
        };
    } else if (flatBids.length && !flatAsks.length) {
        config.xAxis.min = flatBids[flatBids.length - 1][0] * 0.4;
        config.xAxis.max = flatBids[flatBids.length - 1][0] * 1.6;
    } else if (flatAsks.length && !flatBids.length) {
        config.xAxis.min = 0;
        config.xAxis.max = flatAsks[0][0] * 2;
    }

    if (hasPrediction) {
        config.xAxis.min = -0.05;
        config.xAxis.max = 1.05;
    }

    // Market asset
    if (LCP) {
        const bitAsset = base.get("bitasset_data_id") ? base : quote;

        const mcr =
            bitAsset.getIn([
                "bitasset",
                "current_feed",
                "maintenance_collateral_ratio"
            ]) / 1000;

        const sqr =
            bitAsset.getIn([
                "bitasset",
                "current_feed",
                "maximum_short_squeeze_ratio"
            ]) / 1000;

        const settlement_support_price = invertedCalls
            ? (LCP / mcr) * sqr
            : (LCP * mcr) / sqr;

        config.xAxis.plotLines.push({
            color: axisLineColor,
            id: "plot_line",
            dashStyle: "longdash",
            value: LCP,
            label: {
                text: counterpart.translate("explorer.block.call_limit", {
                    price: LCP.toFixed(4)
                }),
                style: {
                    color: primaryText,
                    fontWeight: "bold"
                },
                x: !invertedCalls ? -10 : 5
            },
            width: 2,
            zIndex: 5
        });

        config.xAxis.plotLines.push({
            color: axisLineColor,
            id: "plot_line",
            dashStyle: "longdash",
            value: settlement_support_price,
            label: {
                text: counterpart.translate("explorer.block.gs_support", {
                    price: settlement_support_price.toFixed(4)
                }),
                style: {
                    color: primaryText,
                    fontWeight: "bold"
                },
                x: invertedCalls ? -10 : 5
            },
            width: 2,
            zIndex: 5
        });
    }

    if (feedPrice) {
        const settlementColor = base.has("bitasset") ? askColor : bidColor;
        config.xAxis.plotLines.push({
            color: settlementColor,
            id: "plot_line",
            dashStyle: "solid",
            value: feedPrice,
            label: {
                text: counterpart.translate("explorer.block.feed_price", {
                    price: feedPrice.toFixed(4)
                }),
                style: {
                    color: primaryText,
                    fontWeight: "bold"
                },
                x: !invertedCalls ? -10 : 5
            },
            width: 2,
            zIndex: 5
        });

        // Add calls if present
        if (flatCalls && flatCalls.length) {
            config.series.push({
                name: `Call ${quoteSymbol}`,
                data: flatCalls,
                color: callColor
            });
        }
    }

    // Add settle orders
    if (feedPrice && flatSettles && flatSettles.length) {
        config.series.push({
            name: `Settle ${quoteSymbol}`,
            data: flatSettles,
            color: settleColor,
            fillColor: settleFillColor
        });
    }

    // Push asks and bids
    if (flatBids.length) {
        config.series.push({
            step: "right",
            name: `Bid ${quoteSymbol}`,
            data: flatBids,
            color: bidColor,
            fillColor: bidFillColor
        });
    }

    if (flatAsks.length) {
        config.series.push({
            step: "left",
            name: `Ask ${quoteSymbol}`,
            data: flatAsks,
            color: askColor,
            fillColor: askFillColor
        });
    }

    // Fix the height if defined, else use 400px;
    if (height) {
        config.chart.height = height;
    } else {
        config.chart.height = "400px";
    }

    // Add onClick event listener if defined
    if (onClick) {
        config.chart.events = {
            click: onClick
        };
    }

    if (noFrame) {
        return (
            <div className="grid-content no-overflow no-padding">
                {!flatBids.length && !flatAsks.length && !flatCalls.length ? (
                    <span className="no-data">
                        <Translate content="exchange.no_data" />
                    </span>
                ) : null}
                {noText ? null : (
                    <p className="bid-total">
                        {(utils as any).format_number(
                            totalBids,
                            base.get("precision")
                        )}{" "}
                        {baseSymbol}
                    </p>
                )}
                {noText ? null : (
                    <p className="ask-total">
                        {(utils as any).format_number(
                            totalAsks,
                            quote.get("precision")
                        )}{" "}
                        {quoteSymbol}
                    </p>
                )}
                {flatBids || flatAsks || flatCalls ? (
                    <ReactHighchart config={config} />
                ) : null}
            </div>
        );
    } else {
        return (
            <div className="grid-content no-overflow no-padding middle-content">
                <div className="exchange-bordered" id="depth_chart">
                    <div className="exchange-content-header">
                        {noText ? null : (
                            <span className="bid-total">
                                {(utils as any).format_number(
                                    totalBids,
                                    base.get("precision")
                                )}{" "}
                                <AssetName name={base.get("symbol")} />
                            </span>
                        )}
                        {noText ? null : (
                            <span className="ask-total float-right">
                                {(utils as any).format_number(
                                    totalAsks,
                                    quote.get("precision")
                                )}{" "}
                                <AssetName name={quote.get("symbol")} />
                            </span>
                        )}
                    </div>
                    {!flatBids.length &&
                    !flatAsks.length &&
                    !flatCalls.length ? (
                        <span className="no-data">
                            <Translate content="exchange.no_data" />
                        </span>
                    ) : null}
                    {flatBids || flatAsks || flatCalls ? (
                        <ReactHighchart ref={depthChartRef} config={config} />
                    ) : null}
                </div>
            </div>
        );
    }
}

function arePropsEqual(
    prevProps: DepthHighChartProps,
    nextProps: DepthHighChartProps
) {
    const settleCheck = isNaN(nextProps.feedPrice)
        ? false
        : nextProps.feedPrice !== prevProps.feedPrice;
    return !(
        (didOrdersChange as any)(nextProps.orders, prevProps.orders) ||
        (didOrdersChange as any)(nextProps.call_orders, prevProps.call_orders) ||
        settleCheck ||
        nextProps.feedPrice !== prevProps.feedPrice ||
        nextProps.height !== prevProps.height ||
        nextProps.isPanelActive !== prevProps.isPanelActive ||
        nextProps.activePanels !== prevProps.activePanels ||
        nextProps.LCP !== prevProps.LCP ||
        nextProps.showCallLimit !== prevProps.showCallLimit ||
        nextProps.hasPrediction !== prevProps.hasPrediction ||
        nextProps.marketReady !== prevProps.marketReady
    );
}

const DepthHighChart = React.memo(DepthHighChartInner, arePropsEqual);

(DepthHighChart as any).defaultProps = {
    flat_bids: [],
    flat_asks: [],
    orders: {},
    noText: false,
    noFrame: true
};

export default DepthHighChart;
