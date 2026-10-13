// Chooses the exchange price chart: TradingView's Advanced Charts when its
// licensed library is bundled, otherwise the built-in LightweightPriceChart.
// The choice is the user's view setting `chartEngine`, defaulting to the
// deployment's build option (`--env chartEngine=tradingview|lightweight|auto`).
import * as React from "react";
import TradingViewPriceChart from "./TradingViewPriceChart";
import LightweightPriceChart from "./LightweightPriceChart";
import SettingsActions from "actions/SettingsActions";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectSettingsState} from "../../store/slices/settingsSlice";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const tradingViewLibrary = require("../../../charting_library/charting_library.esm");

export type ChartEngine = "tradingview" | "lightweight";

export const tradingViewAvailable = (library: any = tradingViewLibrary) =>
    !!library && typeof library.widget === "function";

export function resolveChartEngine(
    setting: string | undefined,
    deploymentDefault: string,
    available: boolean
): ChartEngine {
    const wanted = setting && setting !== "auto" ? setting : deploymentDefault;
    if (wanted === "lightweight") return "lightweight";
    // "tradingview" and "auto" both mean TradingView, if there is a library.
    return available ? "tradingview" : "lightweight";
}

export function ExchangePriceChart(props: any) {
    const available = tradingViewAvailable();
    const viewSettings = useReduxState<any>(selectSettingsState).viewSettings;
    const engine = resolveChartEngine(
        viewSettings.get("chartEngine"),
        __CHART_ENGINE__,
        available
    );
    const other: ChartEngine =
        engine === "tradingview" ? "lightweight" : "tradingview";

    return (
        <div style={{position: "relative"}}>
            {available ? (
                <button
                    type="button"
                    className="button outline small"
                    style={{position: "absolute", top: 4, right: 4, zIndex: 2}}
                    title={
                        other === "lightweight"
                            ? "Switch to the built-in chart"
                            : "Switch to TradingView"
                    }
                    onClick={() =>
                        SettingsActions.changeViewSetting({
                            chartEngine: other
                        } as any)
                    }
                >
                    {other === "lightweight" ? "Simple chart" : "TradingView"}
                </button>
            ) : null}
            {engine === "tradingview" ? (
                <TradingViewPriceChart {...props} />
            ) : (
                <LightweightPriceChart
                    theme={props.theme}
                    chartHeight={props.chartHeight}
                />
            )}
        </div>
    );
}

export default ExchangePriceChart;
