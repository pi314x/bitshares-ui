import React from "react";
import {Table, Button, Alert} from "bitshares-ui-style-guide";
import {Apis} from "bitsharesjs-ws";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import FuturesActions from "actions/FuturesActions";
import LoadingIndicator from "../LoadingIndicator";

/**
 * Resting orders that have not filled yet.
 *
 * This table exists because the chain already tracked these and nothing showed them: an
 * order that rests holds `deferred_margin` -- collateral committed but not yet backing a
 * position -- and a trader with no view of it sees the balance missing with no explanation.
 */
class FuturesOrders extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            orders: [],
            markets: {},
            loading: true,
            error: null,
            busy: null
        };
    }

    componentDidMount() {
        this._fetch();
    }

    componentDidUpdate(prev) {
        if (prev.account !== this.props.account) this._fetch();
    }

    _fetch() {
        const {account} = this.props;
        if (!account) {
            this.setState({orders: [], loading: false});
            return;
        }
        Apis.instance()
            .db_api()
            .exec("get_futures_orders_by_owner", [account, 100, "1.26.0"])
            .then(orders => {
                const ids = [...new Set((orders || []).map(o => o.market_id))];
                if (!ids.length) {
                    this.setState({orders: [], markets: {}, loading: false});
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
                            orders: orders || [],
                            markets: byId,
                            loading: false
                        });
                    });
            })
            .catch(err => {
                this.setState({
                    loading: false,
                    error:
                        err && err.message
                            ? err.message
                            : counterpart.translate("futures.unsupported")
                });
            });
    }

    _cancel(order) {
        this.setState({busy: order.id, error: null});
        FuturesActions.cancelOrder({
            owner: this.props.account,
            order_id: order.id
        })
            .then(() => {
                this.setState({busy: null});
                this._fetch();
            })
            .catch(err => {
                this.setState({
                    busy: null,
                    error: err && err.message ? err.message : String(err)
                });
            });
    }

    render() {
        const {orders, markets, loading, error, busy} = this.state;
        if (!this.props.account) return null;
        if (loading) return <LoadingIndicator />;

        const columns = [
            {
                title: counterpart.translate("futures.market"),
                key: "market",
                render: row => {
                    const m = markets[row.market_id];
                    return (
                        <span className="futures-symbol">
                            {m ? m.symbol : row.market_id}
                        </span>
                    );
                }
            },
            {
                title: counterpart.translate("futures.side"),
                key: "side",
                render: row => (
                    <span
                        className={
                            "futures-tag futures-tag--" +
                            (row.is_long ? "green" : "red")
                        }
                    >
                        {counterpart.translate(
                            row.is_long ? "futures.long" : "futures.short"
                        )}
                    </span>
                )
            },
            {
                title: counterpart.translate("futures.price_per_contract"),
                dataIndex: "price_per_contract"
            },
            {
                title: counterpart.translate("futures.contracts"),
                dataIndex: "size"
            },
            {
                // Collateral committed by the resting order. Not yet margin on a position,
                // but already gone from the spendable balance.
                title: counterpart.translate("futures.deferred_margin"),
                dataIndex: "deferred_margin"
            },
            {
                title: "",
                key: "actions",
                render: row => (
                    <Button
                        type="danger"
                        size="small"
                        disabled={busy === row.id}
                        onClick={() => this._cancel(row)}
                    >
                        <Translate
                            content={
                                busy === row.id
                                    ? "futures.cancelling"
                                    : "futures.cancel"
                            }
                        />
                    </Button>
                )
            }
        ];

        return (
            <div className="futures-orders">
                <Translate
                    component="h4"
                    content="futures.open_orders"
                    className="futures-section-title"
                />
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
                    dataSource={orders}
                    pagination={{pageSize: 10, hideOnSinglePage: true}}
                    locale={{
                        emptyText: counterpart.translate(
                            "futures.no_open_orders"
                        )
                    }}
                />
            </div>
        );
    }
}

export default FuturesOrders;
