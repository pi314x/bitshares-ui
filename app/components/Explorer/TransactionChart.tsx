// TypeScript port of the legacy TransactionChart.jsx (Phase 2,
// docs/UI_MIGRATION_PLAN.md). Kept as a class component rather than
// converted to hooks, same reasoning as its sibling `BlocktimeChart.tsx`
// in this directory: `shouldComponentUpdate` does an IMPERATIVE
// Highcharts update (`chart.series[0].addPoint(...)` + `chart.redraw()`)
// to animate new blocks in incrementally instead of forcing a full chart
// rebuild - a side-effecting SCU with no clean, low-risk hooks
// equivalent. The legacy string ref (`ref="trx_chart"`) is replaced with
// `React.createRef()`.
//
// Unlike `BlocktimeChart.jsx`, this file's `_getData(props)` correctly
// takes and uses its argument at both call sites - no bug to preserve
// here.
import * as React from "react";
import ReactHighchart from "react-highcharts";
import counterpart from "counterpart";

interface TransactionChartProps {
    blocks: any;
    head_block: number;
}

export default class TransactionChart extends React.Component<
    TransactionChartProps
> {
    chartRef = React.createRef<any>();

    shouldComponentUpdate(nextProps: TransactionChartProps) {
        if (nextProps.blocks.size < 20) {
            return false;
        }
        const chart = this.chartRef.current
            ? this.chartRef.current.chart
            : null;
        if (chart && nextProps.blocks !== this.props.blocks) {
            const {trxData, colors} = this._getData(nextProps);
            const series = chart.series[0];
            const finalValue = series.xData[series.xData.length - 1];

            if (series.xData.length) {
                trxData.forEach((point: any) => {
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
            nextProps.blocks !== this.props.blocks ||
            nextProps.head_block !== this.props.head_block
        );
    }

    _getData(props: TransactionChartProps) {
        const {blocks, head_block} = props;

        let max = 0;
        const trxData = blocks
            .filter((a: any) => {
                return a.id >= head_block - 30;
            })
            .sort((a: any, b: any) => {
                return a.id - b.id;
            })
            .takeLast(30)
            .map((block: any) => {
                max = Math.max(block.transactions.length, max);
                return [block.id, block.transactions.length];
            })
            .toArray();

        const colors = trxData.map((entry: any) => {
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
            colors,
            trxData,
            max
        };
    }

    render() {
        const {trxData, colors, max} = this._getData(this.props);

        const tooltipLabel = counterpart.translate(
            "explorer.blocks.transactions"
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
                    return tooltipLabel + ": " + this.y;
                }
            },
            series: [
                {
                    name: "Transactions",
                    data: trxData,
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
                max: Math.max(1.5, max + 0.5),
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
                    minPointLength: 5,
                    colorByPoint: true,
                    colors: colors,
                    borderWidth: 0
                }
            }
        };

        return trxData.length ? (
            <ReactHighchart ref={this.chartRef} config={config} />
        ) : null;
    }
}
