import React from "react";
import {Table, Tooltip, Card} from "bitshares-ui-style-guide";
import {Apis} from "bitsharesjs-ws";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import AssetName from "../Utility/AssetName";
import LinkToAccountById from "../Utility/LinkToAccountById";
import FormattedAsset from "../Utility/FormattedAsset";
import LoadingIndicator from "../LoadingIndicator";

/**
 * Oracles: named price series that live in their own right rather than as an attribute of an
 * asset, so several consumers can reference the same one.
 *
 * The column that matters most is the value. An oracle reports NO value when fewer of its
 * producers are live than its quorum requires, and that is deliberate on the chain side: a
 * consumer that mistook "no data" for "price is zero" would fail in the most expensive
 * direction. The table says "no quorum" rather than showing a dash, so the reason is visible.
 */
class OracleList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            oracles: [],
            loading: true,
            error: null
        };
    }

    componentDidMount() {
        this._fetch();
    }

    _fetch() {
        Apis.instance()
            .db_api()
            .exec("list_oracles", [100, "1.23.0"])
            .then(oracles => {
                this.setState({oracles: oracles || [], loading: false});
            })
            .catch(err => {
                // A node without the oracle hardfork simply does not have this call. Say so
                // plainly rather than showing an empty table that looks like "no oracles".
                this.setState({
                    loading: false,
                    error:
                        err && err.message
                            ? err.message
                            : counterpart.translate("oracles.unsupported")
                });
            });
    }

    _renderValue(oracle) {
        if (!oracle.current_value) {
            return (
                <Tooltip
                    title={counterpart.translate("oracles.no_quorum_explain", {
                        live: oracle.current_value_producer_count || 0,
                        needed: oracle.options.minimum_producers
                    })}
                >
                    <span className="oracle-no-value">
                        <Translate content="oracles.no_quorum" />
                    </span>
                </Tooltip>
            );
        }
        const v = oracle.current_value;
        return (
            <span>
                <FormattedAsset
                    amount={v.base.amount}
                    asset={v.base.asset_id}
                    hide_asset
                />
                {" = "}
                <FormattedAsset
                    amount={v.quote.amount}
                    asset={v.quote.asset_id}
                />
            </span>
        );
    }

    render() {
        const {oracles, loading, error} = this.state;

        if (loading) return <LoadingIndicator />;

        if (error) {
            return (
                <Card>
                    <Translate
                        component="p"
                        content="oracles.unavailable"
                        className="oracle-error"
                    />
                    <p className="oracle-error-detail">{error}</p>
                </Card>
            );
        }

        const columns = [
            {
                title: counterpart.translate("oracles.name"),
                dataIndex: "name",
                render: (name, row) => (
                    <span>
                        <span className="oracle-name">{name}</span>
                        <span className="oracle-id"> {row.id}</span>
                    </span>
                )
            },
            {
                title: counterpart.translate("oracles.pair"),
                key: "pair",
                render: row => (
                    <span>
                        <AssetName name={row.base_asset} />
                        {" / "}
                        <AssetName name={row.quote_asset} />
                    </span>
                )
            },
            {
                title: counterpart.translate("oracles.value"),
                key: "value",
                render: row => this._renderValue(row)
            },
            {
                title: counterpart.translate("oracles.producers"),
                key: "producers",
                render: row => (
                    <span className="oracle-quorum">
                        {row.current_value_producer_count || 0}
                        {" / "}
                        {(row.options.producers || []).length}
                        <span className="oracle-quorum-need">
                            {counterpart.translate("oracles.quorum_short", {
                                n: row.options.minimum_producers
                            })}
                        </span>
                    </span>
                )
            },
            {
                title: counterpart.translate("oracles.aggregation"),
                key: "aggregation",
                render: row =>
                    // The node serialises the enum by NAME, not by number -- checking for 1
                    // silently mislabels every windowed oracle as median-of-latest.
                    counterpart.translate(
                        row.options.aggregation === "median_over_window" ||
                            row.options.aggregation === 1
                            ? "oracles.median_window"
                            : "oracles.median_latest"
                    )
            },
            {
                title: counterpart.translate("oracles.owner"),
                dataIndex: "owner",
                render: owner => <LinkToAccountById account={owner} />
            }
        ];

        return (
            <Table
                rowKey="id"
                columns={columns}
                dataSource={oracles}
                pagination={{pageSize: 20, hideOnSinglePage: true}}
                locale={{
                    emptyText: counterpart.translate("oracles.none")
                }}
            />
        );
    }
}

export default OracleList;
