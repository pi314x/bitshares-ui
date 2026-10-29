// A Highcharts chart in a div. It replaces `react-highcharts` (16.1.0), whose only
// job was this and which pinned Highcharts 6, a version with known cross-site
// scripting advisories; the library is a dependency of its own now.
//
// Same contract as the wrapper it replaces: the chart is built from `config` on
// mount and built again (the old one destroyed) whenever the component is given
// a new one; `.chart` is the Highcharts instance, `getChart()` throws before
// the component is mounted, `HighChart.Highcharts` is the library.
import * as React from "react";
import Highcharts from "highcharts";

interface HighChartProps {
    config: any;
    /** Called with the chart when it has been drawn */
    callback?: (chart: any) => void;
    domProps?: React.HTMLAttributes<HTMLDivElement>;
    /** No reflow to the container's size after drawing */
    neverReflow?: boolean;
    /** A config that has not changed (same object) does not draw the chart again */
    isPureConfig?: boolean;
}

export default class HighChart extends React.Component<HighChartProps> {
    static Highcharts = Highcharts;

    chart: any = null;
    private container: HTMLDivElement | null = null;

    componentDidMount() {
        this.renderChart(this.props.config);
    }

    shouldComponentUpdate(nextProps: HighChartProps) {
        if (
            nextProps.neverReflow ||
            (nextProps.isPureConfig && this.props.config === nextProps.config)
        ) {
            return true;
        }
        this.renderChart(nextProps.config);
        return false;
    }

    componentWillUnmount() {
        if (this.chart) this.chart.destroy();
        this.chart = null;
    }

    getChart() {
        if (!this.chart) {
            throw new Error(
                "getChart() should not be called before the component is mounted"
            );
        }
        return this.chart;
    }

    private renderChart(config: any) {
        if (!config) {
            throw new Error(
                "Config must be specified for the HighChart component"
            );
        }
        if (this.chart) this.chart.destroy();
        this.chart = new (Highcharts as any).Chart(
            {...config, chart: {...config.chart, renderTo: this.container}},
            this.props.callback
        );
        if (
            !this.props.neverReflow &&
            typeof requestAnimationFrame === "function"
        ) {
            requestAnimationFrame(() => {
                if (this.chart && this.chart.options) this.chart.reflow();
            });
        }
    }

    render() {
        return (
            <div
                ref={element => {
                    this.container = element;
                }}
                {...this.props.domProps}
            />
        );
    }
}

/**
 * The x values of a series' points. Highcharts 12 keeps a series' data in columns:
 * `series.xData`, which the charts used to read, is no longer there (undefined).
 */
export function seriesXValues(series: any): number[] {
    const values = series.getColumn ? series.getColumn("x") : series.xData;
    return values || [];
}
