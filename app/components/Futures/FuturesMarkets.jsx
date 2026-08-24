import React from "react";
import {Table, Tooltip, Card} from "bitshares-ui-style-guide";
import {Apis} from "bitsharesjs-ws";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import moment from "moment";
import AssetName from "../Utility/AssetName";
import LinkToAccountById from "../Utility/LinkToAccountById";
import LoadingIndicator from "../LoadingIndicator";

/**
 * Futures markets: perpetual and dated contracts margined against an oracle.
 *
 * Prices here are an INTEGER amount of the collateral asset per contract, not a ratio. That is
 * what keeps position accounting exact on chain, and it means the mark price is shown as a
 * plain number in the collateral asset rather than as a pair.
 *
 * A market with no mark price is not tradable at all: risk is assessed against the mark, so
 * when the oracle has nothing to say the chain stops the market rather than trading against a
 * price nobody is asserting. The table shows that state explicitly.
 */
class FuturesMarkets extends React.Component {
    constructor(props) {
        super(props);
        this.state = {markets: [], loading: true, error: null};
    }

    componentDidMount() {
        this._fetch();
    }

    _fetch() {
        Apis.instance()
            .db_api()
            .exec("list_futures_markets", [100, "1.24.0"])
            .then(markets =>
                this.setState({markets: markets || [], loading: false})
            )
            .catch(err =>
                this.setState({
                    loading: false,
                    error:
                        err && err.message
                            ? err.message
                            : counterpart.translate("futures.unsupported")
                })
            );
    }

    _leverage(ratio) {
        // initial_margin_ratio is in GRAPHENE_100_PERCENT units: 1000 => 10% => 10x
        if (!ratio) return "-";
        return `${Math.round(10000 / ratio)}x`;
    }

    /// Chain timestamps are UTC with no suffix. moment.utc parses them as UTC AND keeps the
    /// moment in UTC mode, which matters: moment(new Date(t + "Z")) parses correctly but then
    /// formats in local time, so a 16:00 UTC expiry renders as 17:00 for a viewer one hour
    /// east. A contract's expiry is a protocol fact, not a local one -- shifting it by the
    /// reader's offset is how someone ends up wrong about which day a contract settles.
    _utc(t) {
        return t ? moment.utc(t) : null;
    }

    _date(t) {
        const m = this._utc(t);
        return m ? m.format("YYYY-MM-DD HH:mm") + " UTC" : null;
    }

    /// Basis points -> percent. Ratios are stored as bps on chain (2000 == 20.00%).
    _pct(bps) {
        return (bps / 100).toFixed(2) + "%";
    }

    render() {
        const {markets, loading, error} = this.state;

        if (loading) return <LoadingIndicator />;
        if (error) {
            return (
                <Card>
                    <Translate
                        component="p"
                        content="futures.unavailable"
                        className="oracle-error"
                    />
                    <p className="oracle-error-detail">{error}</p>
                </Card>
            );
        }

        const columns = [
            {
                title: counterpart.translate("futures.symbol"),
                dataIndex: "symbol",
                render: (symbol, row) => (
                    <span>
                        <span className="oracle-name">{symbol}</span>
                        <span className="oracle-id"> {row.id}</span>
                    </span>
                )
            },
            {
                title: counterpart.translate("futures.type"),
                key: "type",
                render: row =>
                    row.expiry ? (
                        <span className="futures-tag futures-tag--blue">
                            {counterpart.translate("futures.dated")}
                        </span>
                    ) : (
                        <span className="futures-tag futures-tag--green">
                            {counterpart.translate("futures.perpetual")}
                        </span>
                    )
            },
            {
                // A dated contract's expiry is the single most consequential fact about it,
                // and it was previously only reachable by hovering the type tag.
                title: counterpart.translate("futures.expiry"),
                key: "expiry",
                render: row => {
                    if (!row.expiry)
                        return (
                            <span className="futures-muted">
                                <Translate content="futures.no_expiry" />
                            </span>
                        );
                    const m = this._utc(row.expiry);
                    const past = m.isBefore(moment());
                    return (
                        <Tooltip title={m.fromNow()}>
                            <span
                                className={
                                    past ? "futures-loss" : "futures-date"
                                }
                            >
                                {this._date(row.expiry)}
                            </span>
                        </Tooltip>
                    );
                }
            },
            {
                title: counterpart.translate("futures.mark"),
                key: "mark",
                render: row =>
                    row.mark_price ? (
                        <span className="futures-mark">
                            {row.mark_price}{" "}
                            <AssetName name={row.collateral_asset} />
                        </span>
                    ) : (
                        <Tooltip
                            title={counterpart.translate(
                                "futures.no_mark_explain"
                            )}
                        >
                            <span className="oracle-no-value">
                                <Translate content="futures.no_mark" />
                            </span>
                        </Tooltip>
                    )
            },
            {
                // The mark only moves when a producer publishes -- there is no per-block
                // refresh -- so how old it is matters as much as what it is. Margin and
                // liquidation are computed against this number.
                title: counterpart.translate("futures.mark_updated"),
                key: "mark_updated",
                render: row => {
                    if (!row.mark_price_time)
                        return <span className="futures-muted">-</span>;
                    const m = this._utc(row.mark_price_time);
                    const stale = moment().diff(m, "hours") >= 24;
                    return (
                        <Tooltip title={this._date(row.mark_price_time)}>
                            <span
                                className={
                                    stale ? "futures-loss" : "futures-date"
                                }
                            >
                                {m.fromNow()}
                            </span>
                        </Tooltip>
                    );
                }
            },
            {
                title: counterpart.translate("futures.contract_size"),
                dataIndex: "contract_size",
                render: size => <span className="futures-num">{size}</span>
            },
            {
                title: counterpart.translate("futures.leverage"),
                key: "leverage",
                render: row => (
                    <Tooltip
                        title={counterpart.translate("futures.margin_explain", {
                            imr: (
                                row.options.initial_margin_ratio / 100
                            ).toFixed(2),
                            mmr: (
                                row.options.maintenance_margin_ratio / 100
                            ).toFixed(2)
                        })}
                    >
                        <span>
                            {this._leverage(row.options.initial_margin_ratio)}
                        </span>
                    </Tooltip>
                )
            },
            {
                // Initial over maintenance. Both are what the evaluator actually charges,
                // so they are shown as figures rather than folded into the leverage tooltip.
                title: counterpart.translate("futures.margin_ratios"),
                key: "margins",
                render: row => (
                    <Tooltip
                        title={counterpart.translate("futures.margin_explain", {
                            imr: (
                                row.options.initial_margin_ratio / 100
                            ).toFixed(2),
                            mmr: (
                                row.options.maintenance_margin_ratio / 100
                            ).toFixed(2)
                        })}
                    >
                        <span className="futures-num">
                            {this._pct(row.options.initial_margin_ratio)}
                            {" / "}
                            {this._pct(row.options.maintenance_margin_ratio)}
                        </span>
                    </Tooltip>
                )
            },
            {
                // Perpetuals only. A dated contract settles once and never funds, so showing
                // a rate against one would suggest a cost that is never charged.
                title: counterpart.translate("futures.funding"),
                key: "funding",
                render: row => {
                    if (row.expiry)
                        return <span className="futures-muted">-</span>;
                    const hours = Math.round(
                        row.options.funding_interval_sec / 3600
                    );
                    return (
                        <Tooltip
                            title={counterpart.translate(
                                "futures.funding_explain",
                                {
                                    rate: (
                                        row.options.max_funding_rate_ppm / 10000
                                    ).toFixed(4),
                                    hours
                                }
                            )}
                        >
                            <span className="futures-num">
                                {(
                                    row.options.max_funding_rate_ppm / 10000
                                ).toFixed(3)}
                                {"% / "}
                                {hours}
                                {"h"}
                            </span>
                        </Tooltip>
                    );
                }
            },
            {
                title: counterpart.translate("futures.liq_penalty"),
                key: "penalty",
                render: row => (
                    <span className="futures-num">
                        {this._pct(row.options.liquidation_penalty_ratio)}
                    </span>
                )
            },
            {
                title: counterpart.translate("futures.open_interest"),
                dataIndex: "open_interest",
                render: oi => <span className="futures-num">{oi}</span>
            },
            {
                title: counterpart.translate("futures.status"),
                key: "status",
                render: row => {
                    if (row.is_settled)
                        return (
                            <span className="futures-tag">
                                {counterpart.translate("futures.settled")}
                            </span>
                        );
                    if (!row.options.enabled)
                        return (
                            <span className="futures-tag futures-tag--orange">
                                {counterpart.translate("futures.halted")}
                            </span>
                        );
                    if (!row.mark_price)
                        return (
                            <span className="futures-tag futures-tag--orange">
                                {counterpart.translate("futures.paused")}
                            </span>
                        );
                    return (
                        <span className="futures-tag futures-tag--green">
                            {counterpart.translate("futures.trading")}
                        </span>
                    );
                }
            },
            {
                title: counterpart.translate("futures.owner"),
                dataIndex: "owner",
                render: owner => <LinkToAccountById account={owner} />
            }
        ];

        return (
            <Table
                rowKey="id"
                columns={columns}
                dataSource={markets}
                pagination={{pageSize: 20, hideOnSinglePage: true}}
                locale={{emptyText: counterpart.translate("futures.none")}}
                scroll={{x: true}}
            />
        );
    }
}

export default FuturesMarkets;
