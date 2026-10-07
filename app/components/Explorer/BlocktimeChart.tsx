// TypeScript port of the legacy BlocktimeChart.jsx (Phase 2,
// docs/UI_MIGRATION_PLAN.md). Kept as a class component rather than
// converted to hooks: its shouldComponentUpdate does an IMPERATIVE
// Highcharts update (`chart.series[0].addPoint(...)` + `chart.redraw()`)
// as a performance optimization, animating new blocks in incrementally
// instead of forcing a full chart rebuild on every new block. That's a
// side-effecting shouldComponentUpdate with no clean, low-risk hooks
// equivalent (a React.memo comparator with side effects is itself an
// anti-pattern, and a useEffect-based translation would change exactly
// when/how the chart mutates relative to React's render cycle) -
// preserving this existing, working behavior exactly matters more here
// than uniformity with this phase's other functional-component ports,
// per AGENTS.md's "prefer minimal, well-tested diffs over refactors."
// The legacy string ref (`ref="chart"`) is replaced with
// `React.createRef()` (string refs are deprecated/unsupported in
// TypeScript) - same underlying `.chart` Highcharts instance access.
//
// Confirmed bug, preserved exactly (not this port's job to silently fix
// it - same policy as the other pre-existing bugs found and documented
// elsewhere in this migration): `_getData()` is declared with NO
// parameter and always reads `this.props` internally, yet both call
// sites pass an argument (`nextProps` from `shouldComponentUpdate`,
// `this.props` from `render`) as if it mattered - the `nextProps`
// argument in `shouldComponentUpdate` is silently ignored, so that
// pre-redraw data computation actually always uses the CURRENT props,
// not the incoming ones. Compare with the sibling `TransactionChart.jsx`
// in this same directory, whose `_getData(props)` correctly takes and
// uses its argument - confirming this is a genuine, isolated bug in this
// file, not an intentional pattern. The (unused, ignored) parameter is
// kept on `_getData` so both call sites still visibly "pass" a value,
// same as the original, rather than quietly cleaning up the evidence.
//
// Also confirmed dead, dropped: `_getData()`'s
// `blockTimes.filter(a => a[0] >= head_block - 30)` call - its result
// was never assigned back to anything, so it had no effect (the actual
// trimming is the `takeRight(blockTimes, 30)` two lines later). Since
// that was `head_block`'s only use anywhere in the file, the `head_block`
// prop itself is now unread by this component (the caller,
// `Blocks.tsx`, still passes it - not this file's call site to change).
import * as React from "react";
import ReactHighchart from "react-highcharts";
import {takeRight} from "lodash-es";
import counterpart from "counterpart";

interface BlocktimeChartProps {
    blockTimes: any;
    head_block: number;
}

export default class BlocktimeChart extends React.Component<
    BlocktimeChartProps
> {
    chartRef = React.createRef<any>();

    shouldComponentUpdate(nextProps: BlocktimeChartProps) {
        if (nextProps.blockTimes.length < 19) {
            return false;
        } else if (this.props.blockTimes.length === 0) {
            return true;
        }

        const chart = this.chartRef.current
            ? this.chartRef.current.chart
            : null;
        if (chart) {
            const {blockTimes, colors} = this._getData(nextProps);
            const series = chart.series[0];
            const finalValue = series.xData[series.xData.length - 1];

            if (series.xData.length) {
                blockTimes.forEach((point: any) => {
                    if (point[0] > finalValue) {
                        series.addPoint(
                            point,
                            false,
                            series.xData.length >= 30
                        );
                    }
                });

                chart.options.plotOptions.column.colors = colors;

                chart.redraw();
                return false;
            }
        }

        return (
            nextProps.blockTimes[nextProps.blockTimes.length - 1][0] !==
                this.props.blockTimes[this.props.blockTimes.length - 1][0] ||
            nextProps.blockTimes.length !== this.props.blockTimes.length
        );
    }

    // Takes an (ignored - see file header) argument to match the
    // original's two call sites exactly.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _getData(_ignoredNextProps?: BlocktimeChartProps) {
        let {blockTimes} = this.props;

        if (blockTimes && blockTimes.length) {
            blockTimes = takeRight(blockTimes, 30);
        }

        const colors = blockTimes.map((entry: any) => {
            if (entry[1] <= 5) {
                return "#50D2C2";
            } else if (entry[1] <= 10) {
                return "#A0D3E8";
            } else if (entry[1] <= 20) {
                return "#FCAB53";
            } else {
                return "#deb869";
            }
        });

        return {
            blockTimes,
            colors
        };
    }

    render() {
        const {blockTimes, colors} = this._getData(this.props);

        const tooltipLabel = counterpart.translate(
            "explorer.blocks.block_time"
        );

        const config = {
            chart: {
                type: "column",
                backgroundColor: "rgba(255, 0, 0, 0)",
                spacing: [0, 0, 5, 0],
                height: 100
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
            tooltip: {
                shared: false,
                formatter: function(this: any) {
                    return tooltipLabel + ": " + this.y + "s";
                }
            },
            series: [
                {
                    name: "Block time",
                    data: blockTimes,
                    color: "#50D2C2"
                }
            ],
            xAxis: {
                labels: {
                    enabled: false
                },
                title: {
                    text: null
                }
            },
            yAxis: {
                min: 0,
                title: {
                    text: null
                },
                labels: {
                    enabled: false
                },
                gridLineWidth: 0,
                currentPriceIndicator: {
                    enabled: false
                }
            },
            plotOptions: {
                column: {
                    animation: true,
                    minPointLength: 3,
                    colorByPoint: true,
                    colors: colors,
                    borderWidth: 0
                }
            }
        };

        return blockTimes.length ? (
            <ReactHighchart ref={this.chartRef} config={config} />
        ) : null;
    }
}
