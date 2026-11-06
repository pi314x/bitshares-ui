// Built-in price chart: candlesticks and volume from the market's price
// history, drawn with TradingView's open-source `lightweight-charts`
// (Apache-2.0, no licence file to install). It is the fallback for
// TradingViewPriceChart, which needs the licensed Advanced Charts library.
// It shows what the market store already holds (`priceData`, one bucket size);
// drawing tools, indicators and layouts are TradingView-only.
import * as React from "react";
import {
    createChart,
    CandlestickSeries,
    HistogramSeries,
    ColorType,
    IChartApi,
    ISeriesApi,
    UTCTimestamp
} from "lightweight-charts";
import colors from "assets/colors";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectMarkets} from "../../store/slices/marketsSlice";

export interface LightweightPriceChartProps {
    theme?: string;
    chartHeight?: number;
}

interface Bar {
    time: number; // ms
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// Series data must be ascending by time with unique timestamps.
export function toSeries(priceData: Bar[]) {
    const byTime = new Map<number, Bar>();
    (priceData || []).forEach(bar => {
        if (bar && Number.isFinite(bar.time) && Number.isFinite(bar.close)) {
            byTime.set(Math.floor(bar.time / 1000), bar);
        }
    });
    const times = Array.from(byTime.keys()).sort((a, b) => a - b);
    return {
        candles: times.map(t => {
            const b = byTime.get(t) as Bar;
            return {
                time: t as UTCTimestamp,
                open: b.open,
                high: b.high,
                low: b.low,
                close: b.close
            };
        }),
        volumes: times.map(t => {
            const b = byTime.get(t) as Bar;
            return {
                time: t as UTCTimestamp,
                value: b.volume || 0,
                color:
                    b.close >= b.open
                        ? "rgba(52,195,143,0.5)"
                        : "rgba(239,95,107,0.5)"
            };
        })
    };
}

export function LightweightPriceChart({
    theme = "darkTheme",
    chartHeight = 400
}: LightweightPriceChartProps) {
    const palette = (colors as any)[theme] || (colors as any).darkTheme;
    const priceData: Bar[] = useReduxState<any>(selectMarkets).priceData;
    const host = React.useRef<HTMLDivElement>(null);
    const chartRef = React.useRef<IChartApi | null>(null);
    const candlesRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null);
    const volumeRef = React.useRef<ISeriesApi<"Histogram"> | null>(null);

    React.useEffect(() => {
        if (!host.current) return;
        const chart = createChart(host.current, {
            autoSize: true,
            layout: {
                background: {type: ColorType.Solid, color: palette.bgColor},
                textColor: palette.textColor
            },
            grid: {
                vertLines: {color: palette.axisLineColor},
                horzLines: {color: palette.axisLineColor}
            },
            rightPriceScale: {borderColor: palette.axisLineColor},
            timeScale: {borderColor: palette.axisLineColor, timeVisible: true}
        });
        const candles = chart.addSeries(CandlestickSeries, {
            upColor: palette.positiveColor,
            downColor: palette.negativeColor,
            borderVisible: false,
            wickUpColor: palette.positiveColor,
            wickDownColor: palette.negativeColor
        });
        const volume = chart.addSeries(HistogramSeries, {
            priceFormat: {type: "volume"},
            priceScaleId: "volume"
        });
        chart.priceScale("volume").applyOptions({
            scaleMargins: {top: 0.8, bottom: 0}
        });
        chartRef.current = chart;
        candlesRef.current = candles;
        volumeRef.current = volume;
        return () => {
            chart.remove();
            chartRef.current = candlesRef.current = volumeRef.current = null;
        };
    }, [theme]);

    React.useEffect(() => {
        const {candles, volumes} = toSeries(priceData);
        candlesRef.current?.setData(candles);
        volumeRef.current?.setData(volumes);
        if (candles.length) chartRef.current?.timeScale().fitContent();
    }, [priceData, theme]);

    return (
        <div
            ref={host}
            data-testid="lightweight-price-chart"
            style={{width: "100%", height: chartHeight}}
        />
    );
}

export default LightweightPriceChart;
