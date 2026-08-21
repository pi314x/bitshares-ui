import React from "react";
import {Table, Tooltip} from "bitshares-ui-style-guide";
import {Apis} from "bitsharesjs-ws";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import AssetName from "../Utility/AssetName";
import LoadingIndicator from "../LoadingIndicator";

/**
 * An account's open futures positions.
 *
 * size is signed: positive is long, negative short. Unrealised PnL is
 *
 *     size x mark - entry_value
 *
 * which is exact integer arithmetic on chain -- entry_value is a running sum of size x fill
 * price, not an averaged entry price, precisely so that nothing has to be divided and the two
 * sides of a contract stay exactly antisymmetric.
 *
 * The number a trader actually needs is the distance to liquidation, so equity is shown against
 * the maintenance requirement rather than on its own.
 */
class FuturesPositions extends React.Component {
    constructor(props) {
        super(props);
        this.state = {positions: [], markets: {}, loading: true};
    }

    componentDidMount() {
        this._fetch();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.account !== this.props.account) this._fetch();
    }

    _fetch() {
        const {account} = this.props;
        if (!account) {
            this.setState({positions: [], loading: false});
            return;
        }
        Apis.instance()
            .db_api()
            .exec("get_futures_positions_by_owner", [account, 100, "1.25.0"])
            .then(positions => {
                const list = positions || [];
                const ids = [...new Set(list.map(p => p.market_id))];
                if (!ids.length) {
                    this.setState({positions: [], loading: false});
                    return;
                }
                return Apis.instance()
                    .db_api()
                    .exec("get_futures_markets", [ids])
                    .then(markets => {
                        const byId = {};
                        (markets || []).forEach(m => {
                            if (m) byId[m.id] = m;
                        });
                        this.setState({
                            positions: list,
                            markets: byId,
                            loading: false
                        });
                    });
            })
            .catch(() => this.setState({positions: [], loading: false}));
    }

    _pnl(pos, market) {
        if (!market || !market.mark_price) return null;
        return pos.size * market.mark_price - pos.entry_value;
    }

    render() {
        const {positions, markets, loading} = this.state;
        if (loading) return <LoadingIndicator />;

        const columns = [
            {
                title: counterpart.translate("futures.market"),
                dataIndex: "market_id",
                render: id => (
                    <span className="oracle-name">
                        {markets[id] ? markets[id].symbol : id}
                    </span>
                )
            },
            {
                title: counterpart.translate("futures.side"),
                key: "side",
                render: row =>
                    row.size > 0 ? (
                        <span className="futures-tag futures-tag--green">
                            {counterpart.translate("futures.long")}
                        </span>
                    ) : (
                        <span className="futures-tag futures-tag--red">
                            {counterpart.translate("futures.short")}
                        </span>
                    )
            },
            {
                title: counterpart.translate("futures.size"),
                dataIndex: "size",
                render: size => (
                    <span className="futures-num">{Math.abs(size)}</span>
                )
            },
            {
                title: counterpart.translate("futures.margin"),
                key: "margin",
                render: row => {
                    const m = markets[row.market_id];
                    return (
                        <span className="futures-num">
                            {row.margin}{" "}
                            {m ? <AssetName name={m.collateral_asset} /> : null}
                        </span>
                    );
                }
            },
            {
                title: counterpart.translate("futures.unrealised"),
                key: "pnl",
                render: row => {
                    const pnl = this._pnl(row, markets[row.market_id]);
                    if (pnl === null)
                        return (
                            <span className="oracle-no-value">
                                <Translate content="futures.no_mark" />
                            </span>
                        );
                    return (
                        <span
                            className={
                                pnl >= 0 ? "futures-gain" : "futures-loss"
                            }
                        >
                            {pnl >= 0 ? "+" : ""}
                            {pnl}
                        </span>
                    );
                }
            },
            {
                title: counterpart.translate("futures.health"),
                key: "health",
                render: row => {
                    const m = markets[row.market_id];
                    const pnl = this._pnl(row, m);
                    if (pnl === null || !m) return "-";
                    const equity = row.margin + pnl;
                    const notional = Math.abs(row.size) * m.mark_price;
                    const required = Math.ceil(
                        (notional * m.options.maintenance_margin_ratio) / 10000
                    );
                    const ratio = required > 0 ? equity / required : 0;
                    const danger = ratio < 1.25;
                    return (
                        <Tooltip
                            title={counterpart.translate(
                                "futures.health_explain",
                                {equity, required}
                            )}
                        >
                            <span
                                className={
                                    danger ? "futures-loss" : "futures-gain"
                                }
                            >
                                {ratio.toFixed(2)}
                                {"x"}
                            </span>
                        </Tooltip>
                    );
                }
            }
        ];

        return (
            <Table
                rowKey="id"
                columns={columns}
                dataSource={positions}
                pagination={false}
                locale={{
                    emptyText: counterpart.translate("futures.no_positions")
                }}
            />
        );
    }
}

export default FuturesPositions;
