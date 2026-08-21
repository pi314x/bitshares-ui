import React from "react";
import {
    Table,
    Tooltip,
    Button,
    Modal,
    Input,
    Alert
} from "bitshares-ui-style-guide";
import {Apis} from "bitsharesjs-ws";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import AssetName from "../Utility/AssetName";
import LoadingIndicator from "../LoadingIndicator";
import FuturesActions from "actions/FuturesActions";

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
        this.state = {
            positions: [],
            markets: {},
            loading: true,
            adjusting: null, // the position whose margin is being changed
            delta: "",
            busy: false,
            error: null
        };
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

    _applyMargin = () => {
        const {adjusting, delta} = this.state;
        // Signed integer: positive adds collateral, negative withdraws it. Anything else is
        // a typo, and sending a truncated float would move an amount nobody chose.
        if (!/^-?\d+$/.test(delta) || parseInt(delta, 10) === 0) {
            this.setState({
                error: counterpart.translate("futures.err_delta_integer")
            });
            return;
        }
        this.setState({busy: true, error: null});
        FuturesActions.adjustMargin({
            owner: this.props.account,
            position_id: adjusting.id,
            delta
        })
            .then(() => {
                this.setState({busy: false, adjusting: null, delta: ""});
                this._fetch();
            })
            .catch(err => {
                this.setState({
                    busy: false,
                    error: err && err.message ? err.message : String(err)
                });
            });
    };

    _settle = row => {
        this.setState({busy: true, error: null});
        FuturesActions.settle({
            owner: this.props.account,
            position_id: row.id
        })
            .then(() => {
                this.setState({busy: false});
                this._fetch();
            })
            .catch(err => {
                this.setState({
                    busy: false,
                    error: err && err.message ? err.message : String(err)
                });
            });
    };

    render() {
        const {
            positions,
            markets,
            loading,
            adjusting,
            delta,
            busy,
            error
        } = this.state;
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

        if (this.props.account) {
            columns.push({
                title: "",
                key: "actions",
                render: row => {
                    const m = markets[row.market_id];
                    // Settlement only exists for a dated market that has already settled.
                    // Offering the button before then produces a guaranteed rejection.
                    const canSettle = !!(m && m.settled);
                    return (
                        <span className="futures-row-actions">
                            <Button
                                size="small"
                                disabled={busy}
                                onClick={() =>
                                    this.setState({
                                        adjusting: row,
                                        delta: "",
                                        error: null
                                    })
                                }
                            >
                                <Translate content="futures.adjust_margin" />
                            </Button>
                            {canSettle && (
                                <Button
                                    size="small"
                                    type="primary"
                                    disabled={busy}
                                    onClick={() => this._settle(row)}
                                >
                                    <Translate content="futures.settle" />
                                </Button>
                            )}
                        </span>
                    );
                }
            });
        }

        return (
            <div>
                {error && (
                    <Alert
                        type="error"
                        message={error}
                        className="futures-alert"
                    />
                )}
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={positions}
                    pagination={false}
                    locale={{
                        emptyText: counterpart.translate("futures.no_positions")
                    }}
                />
                <Modal
                    visible={!!adjusting}
                    title={counterpart.translate("futures.adjust_margin")}
                    onCancel={() =>
                        this.setState({adjusting: null, error: null})
                    }
                    onOk={this._applyMargin}
                    okButtonProps={{disabled: busy}}
                >
                    <Translate
                        component="p"
                        content="futures.adjust_margin_explain"
                    />
                    <Input
                        value={delta}
                        onChange={e =>
                            this.setState({delta: e.target.value, error: null})
                        }
                        placeholder="-5000"
                    />
                    {adjusting && (
                        <p className="futures-margin-hint">
                            <Translate
                                content="futures.current_margin"
                                margin={adjusting.margin}
                            />
                        </p>
                    )}
                </Modal>
            </div>
        );
    }
}

export default FuturesPositions;
