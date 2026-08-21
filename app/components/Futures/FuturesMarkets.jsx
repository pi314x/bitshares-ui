import React from "react";
import {Table, Tooltip, Card} from "bitshares-ui-style-guide";
import {Apis} from "bitsharesjs-ws";
import Translate from "react-translate-component";
import counterpart from "counterpart";
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
                        <Tooltip title={row.expiry}>
                            <span className="futures-tag futures-tag--blue">
                                {counterpart.translate("futures.dated")}
                            </span>
                        </Tooltip>
                    ) : (
                        <span className="futures-tag futures-tag--green">
                            {counterpart.translate("futures.perpetual")}
                        </span>
                    )
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
            />
        );
    }
}

export default FuturesMarkets;
