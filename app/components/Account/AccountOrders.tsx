// TypeScript/functional-component port of the legacy AccountOrders.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md (transaction signing/serialization):
// `_cancelLimitOrders`/`cancelSelected` build and submit a
// `cancelLimitOrders` transaction via `MarketsActions` - transcribed
// verbatim.
//
// Structural change (not a behavior change): `connect(Component,
// {listenTo: [SettingsStore], getProps})` replaced by
// `useAltStore(SettingsStore)` in a thin Container.
import * as React from "react";
import counterpart from "counterpart";
import MarketsActions from "actions/MarketsActions";
import {ChainStore, FetchChain} from "bitsharesjs";
import {LimitOrder, SettleOrder, FeedPrice} from "common/MarketClasses";
import SettingsStore from "stores/SettingsStore";
import SettingsActions from "actions/SettingsActions";
import marketUtils from "common/market_utils";
import Translate from "react-translate-component";
import {Input, Icon, Table, Switch, Button} from "bitshares-ui-style-guide";
import AccountOrderRowDescription from "./AccountOrderRowDescription";
import CollapsibleTable from "../Utility/CollapsibleTable";
import {groupBy, sumBy, meanBy} from "lodash-es";
import {FormattedNumber} from "react-intl";
import {useAltStore} from "../../next/hooks/useAltStore";

import {Link} from "react-router-dom";
import {MarketPrice} from "../Utility/MarketPrice";
import FormattedPrice from "../Utility/FormattedPrice";
import AssetName from "../Utility/AssetName";
import {EquivalentValueComponent} from "../Utility/EquivalentValueComponent";
import utils from "common/utils";
import asset_utils from "common/asset_utils";

const LinkComponent = Link as React.ComponentType<any>;

interface AccountOrdersState {
    selectedOrders: any[];
    filterValue: string;
    areAssetsGrouped: any;
}

interface AccountOrdersCoreProps {
    account: any;
    isMyAccount?: any;
    children?: any;
    settleOrders?: any;
    settings?: any;
    marketDirections: any;
    viewSettings: any;
    [key: string]: any;
}

function AccountOrders(props: AccountOrdersCoreProps) {
    const {account, isMyAccount, children, marketDirections} = props;

    const [state, setState] = React.useState<AccountOrdersState>(() => ({
        selectedOrders: [],
        filterValue: "",
        areAssetsGrouped: props.viewSettings.get(
            "accountOrdersGrouppedByAsset"
        )
    }));

    const mergeState = (partial: Partial<AccountOrdersState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const getFilteredOrders = (type?: any) => {
        const {filterValue} = state;

        const orders =
            (type !== "settle"
                ? account.get("orders")
                : props.settleOrders) || [];

        return orders.filter((item: any) => {
            const order = ChainStore.getObject(item).toJS();
            const base: any = ChainStore.getAsset(order.sell_price.base.asset_id);
            const quote: any = ChainStore.getAsset(
                order.sell_price.quote.asset_id
            );

            const baseSymbol = base.get("symbol").toLowerCase();
            const quoteSymbol = quote.get("symbol").toLowerCase();

            return (
                baseSymbol.indexOf(filterValue) > -1 ||
                quoteSymbol.indexOf(filterValue) > -1
            );
        });
    };

    const getDataSource = (orders: any, type?: any) => {
        const dataSource: any[] = [];
        const isSettle = type === "settle";

        orders.forEach((orderID: any) => {
            let order: any = null;
            let base: any = null;
            let quote: any = null;
            let sqr = null;
            let mcfr = null;
            let feed_price: any = null;
            let bitasset_options = null;

            if (!isSettle) {
                order = ChainStore.getObject(orderID).toJS();
                base = ChainStore.getAsset(order.sell_price.base.asset_id);
                quote = ChainStore.getAsset(order.sell_price.quote.asset_id);
            } else {
                order = ChainStore.getObject(orderID).toJS();
                base = ChainStore.getAsset(order.balance.asset_id);
                quote = ChainStore.getAsset(
                    base.getIn(["bitasset", "options", "short_backing_asset"])
                );
            }

            if (base && quote) {
                const assets = {
                    [base.get("id")]: {precision: base.get("precision")},
                    [quote.get("id")]: {precision: quote.get("precision")}
                };

                const {marketName} = (marketUtils as any).getMarketName(
                    base,
                    quote
                );
                const direction = marketDirections.get(marketName);

                const marketQuoteId = direction
                    ? quote.get("id")
                    : base.get("id");
                const marketBaseId = direction
                    ? base.get("id")
                    : quote.get("id");
                if (isSettle) {
                    const feedPriceRaw = (asset_utils as any).extractRawFeedPrice(
                        base
                    );
                    sqr = base.getIn([
                        "bitasset",
                        "current_feed",
                        "maximum_short_squeeze_ratio"
                    ]);

                    mcfr = base.getIn([
                        "bitasset",
                        "options",
                        "extensions",
                        "margin_call_fee_ratio"
                    ]);

                    feed_price = new (FeedPrice as any)({
                        priceObject: feedPriceRaw,
                        market_base: marketBaseId,
                        sqr,
                        mcfr,
                        assets
                    });

                    bitasset_options = base.getIn(["bitasset", "options"]);
                }

                const limitOrder = !isSettle
                    ? new (LimitOrder as any)(order, assets, marketQuoteId)
                    : new (SettleOrder as any)(
                          order,
                          assets,
                          marketBaseId,
                          feed_price,
                          bitasset_options
                      );

                const marketBase = ChainStore.getAsset(marketBaseId);
                const marketQuote = ChainStore.getAsset(marketQuoteId);

                const isBid = limitOrder.isBid();
                let dataItem: any = {
                    key: order.id,
                    order: limitOrder,
                    isBid: isBid,
                    quote: marketQuote,
                    base: marketBase,
                    marketName: marketName,
                    marketDirection: direction,
                    preferredUnit: props.settings
                        ? props.settings.get("unit")
                        : "1.3.0",
                    quoteColor: !isBid ? "value negative" : "value positive",
                    baseColor: isBid ? "value negative" : "value positive"
                };
                if (isSettle)
                    dataItem = {
                        ...dataItem,
                        settlement_date: order.settlement_date,
                        feed_price
                    };

                dataSource.push(dataItem);
            }
        });

        // Sort by price first
        dataSource.sort((a, b) => {
            return a.order.getPrice() - b.order.getPrice();
        });

        // And then sort by market name - this way all records will be sorted by price inside, but by the market outside.
        dataSource.sort((a, b) => {
            if (a.marketName > b.marketName) {
                return 1;
            }
            if (a.marketName < b.marketName) {
                return -1;
            }

            // Trick only for grouped orders on the same market, which preserves tables order on direction change
            return a.marketDirection ? 1 : -1;
        });

        return dataSource;
    };

    const onFlip = (marketId: any) => {
        const setting: any = {};
        setting[marketId] = !marketDirections.get(marketId);
        (SettingsActions as any).changeMarketDirection(setting);
    };

    const getColumns = (
        areAssetsGrouped: any,
        groupedDataItems: any,
        type?: any
    ) => {
        const onCell = (dataItem: any) => {
            return {
                onClick: () => onFlip(dataItem.marketName)
            };
        };

        let firstDataItem: any,
            operation: any,
            forText: any,
            baseAsset: any,
            quoteAsset: any,
            baseName: any,
            quoteName: any,
            averagePrice: any,
            marketPrice: any,
            value: any;

        const isSettle = type === "settle";

        const getBaseAsset = (dataItem: any) =>
            dataItem.order[
                dataItem.isBid ? "amountToReceive" : "amountForSale"
            ]().getAmount({real: true});
        const formatBaseAsset = (baseAsset: any) =>
            (utils as any).format_number(
                baseAsset,
                firstDataItem.base.get("precision"),
                false
            );

        const getQuoteAsset = (dataItem: any) =>
            dataItem.order[
                dataItem.isBid ? "amountForSale" : "amountToReceive"
            ]().getAmount({real: true});
        const formatQuoteAsset = (quoteAsset: any) =>
            (utils as any).format_number(
                quoteAsset,
                firstDataItem.quote.get("precision"),
                false
            );

        const formatMarketPrice = (dataItem: any) => (
            <MarketPrice
                base={dataItem.base.get("id")}
                quote={dataItem.quote.get("id")}
                force_direction={dataItem.base.get("symbol")}
                hide_symbols
                hide_asset
            />
        );

        if (areAssetsGrouped) {
            // Assuming that first element always exist because data items were passed as grouped
            firstDataItem = groupedDataItems[0];

            operation = counterpart.translate(
                "exchange." +
                    (!isSettle
                        ? firstDataItem.isBid
                            ? "buy"
                            : "sell"
                        : "settlement_of")
            );

            forText = counterpart.translate("transaction.for");

            baseAsset = formatBaseAsset(sumBy(groupedDataItems, getBaseAsset));
            quoteAsset = formatQuoteAsset(
                sumBy(groupedDataItems, getQuoteAsset)
            );

            const quoteColor = !firstDataItem.isBid
                ? "value negative"
                : "value positive";
            const baseColor = firstDataItem.isBid
                ? "value negative"
                : "value positive";

            baseName = (
                <AssetName
                    noTip
                    customClass={quoteColor}
                    name={firstDataItem.quote.get("symbol")}
                />
            );
            quoteName = (
                <AssetName
                    noTip
                    customClass={baseColor}
                    name={firstDataItem.base.get("symbol")}
                />
            );

            averagePrice = meanBy(groupedDataItems, (dataItem: any) => {
                const price = dataItem.order.sellPrice().toReal(true);
                return !dataItem.marketDirection ? price : 1 / price;
            });

            // Taken from FormattedPrice internal logic
            const decimals = Math.min(
                8,
                firstDataItem.order.sellPrice()[
                    firstDataItem.isBid ? "base" : "quote"
                ].precision
            );
            averagePrice = (
                <FormattedNumber
                    value={averagePrice}
                    minimumFractionDigits={Math.max(2, decimals)}
                    maximumFractionDigits={Math.max(2, decimals)}
                />
            );

            marketPrice = formatMarketPrice(firstDataItem);

            const valueAmount = sumBy(groupedDataItems, (dataItem: any) =>
                dataItem.order.amountForSale().getAmount()
            );

            value = (
                <div>
                    <EquivalentValueComponent
                        hide_asset
                        amount={valueAmount}
                        fromAsset={firstDataItem.order.amountForSale().asset_id}
                        noDecimals={true}
                        toAsset={firstDataItem.preferredUnit}
                    />{" "}
                    <AssetName name={firstDataItem.preferredUnit} />
                </div>
            );
        }

        // Conditional array items: https://stackoverflow.com/a/47771259
        return [
                {
                    key: "trade",
                    title: counterpart.translate("account.trade"),
                    align: "center",
                    render: (dataItem: any) => {
                        return (
                            <LinkComponent
                                to={`/market/${dataItem.quote.get(
                                    "symbol"
                                )}_${dataItem.base.get("symbol")}`}
                                onClick={() =>
                                    (MarketsActions as any).switchMarket()
                                }
                            >
                                <Icon type="bar-chart" />
                            </LinkComponent>
                        );
                    }
                },
                {
                    key: "orderID",
                    title: counterpart.translate("transaction.order_id"),
                    render: (dataItem: any) =>
                        "#" + dataItem.order.id.substring(4)
                },
                ...(areAssetsGrouped
                    ? [
                          {
                              key: "operation",
                              title: operation,
                              render: () => operation,
                              onCell: onCell,
                              className: "clickable groupColumn"
                          },
                          ...(!isSettle
                              ? [
                                    {
                                        key: "baseAsset",
                                        title: baseAsset,
                                        render: (dataItem: any) =>
                                            formatBaseAsset(
                                                getBaseAsset(dataItem)
                                            ),
                                        onCell: onCell,
                                        className: "clickable groupColumn"
                                    },
                                    {
                                        key: "baseName",
                                        title: baseName,
                                        render: () => baseName,
                                        onCell: onCell,
                                        className: "clickable groupColumn"
                                    },
                                    {
                                        key: "for",
                                        title: forText,
                                        render: () => forText,
                                        onCell: onCell,
                                        className: "clickable groupColumn"
                                    },
                                    {
                                        key: "quoteAsset",
                                        title: quoteAsset,
                                        render: (dataItem: any) =>
                                            formatQuoteAsset(
                                                getQuoteAsset(dataItem)
                                            ),
                                        onCell: onCell,
                                        className: "clickable groupColumn"
                                    },
                                    {
                                        key: "quoteName",
                                        title: quoteName,
                                        render: () => quoteName,
                                        onCell: onCell,
                                        className: "clickable groupColumn"
                                    }
                                ]
                              : [
                                    {
                                        key: "quoteAsset",
                                        title: quoteAsset,
                                        render: (dataItem: any) =>
                                            formatQuoteAsset(
                                                getQuoteAsset(dataItem)
                                            ),
                                        className: "clickable groupColumn"
                                    },
                                    {
                                        key: "baseName",
                                        title: baseName,
                                        render: () => baseName,
                                        className: "clickable groupColumn"
                                    }
                                ])
                      ]
                    : [
                          {
                              key: "description",
                              title: counterpart.translate(
                                  "exchange.description"
                              ),
                              render: (dataItem: any) =>
                                  !isSettle ? (
                                      <AccountOrderRowDescription
                                          {...dataItem}
                                      />
                                  ) : (
                                      <Translate
                                          content={
                                              "exchange.settlement_description"
                                          }
                                          quoteAsset={(
                                              utils as any
                                          ).format_number(
                                              dataItem.order.for_sale.getAmount(
                                                  {
                                                      real: true
                                                  }
                                              ),
                                              dataItem.quote.get("precision"),
                                              false
                                          )}
                                          quoteName={
                                              <AssetName
                                                  noTip
                                                  customClass={
                                                      dataItem.quoteColor
                                                  }
                                                  name={dataItem.quote.get(
                                                      "symbol"
                                                  )}
                                              />
                                          }
                                      />
                                  ),
                              onCell: onCell,
                              className: "clickable"
                          }
                      ]),
                {
                    key: "price",
                    title: areAssetsGrouped ? (
                        <div>
                            <Translate content="account.average_price" />
                            <br />
                            {averagePrice}
                        </div>
                    ) : (
                        counterpart.translate("exchange.price")
                    ),
                    align: areAssetsGrouped ? "right" : "left",
                    render: (dataItem: any) => (
                        <FormattedPrice
                            base_amount={dataItem.order.sellPrice().base.amount}
                            base_asset={
                                dataItem.order.sellPrice().base.asset_id
                            }
                            quote_amount={
                                dataItem.order.sellPrice().quote.amount
                            }
                            quote_asset={
                                dataItem.order.sellPrice().quote.asset_id
                            }
                            force_direction={dataItem.base.get("symbol")}
                            hide_symbols
                        />
                    ),
                    onCell: onCell,
                    className: "clickable"
                },
                {
                    key: "marketPrice",
                    title: areAssetsGrouped ? (
                        <div>
                            <Translate content="exchange.price_market" />
                            <br />
                            {marketPrice}
                        </div>
                    ) : (
                        counterpart.translate("exchange.price_market")
                    ),
                    align: areAssetsGrouped ? "right" : "left",
                    render: formatMarketPrice,
                    onCell: onCell,
                    className: "clickable"
                },
                isSettle && !areAssetsGrouped
                    ? {
                          key: "settlement_date",
                          title: areAssetsGrouped ? (
                              <div>
                                  <Translate content="exchange.settlement_date" />
                                  <br />
                                  {marketPrice}
                              </div>
                          ) : (
                              counterpart.translate("exchange.settlement_date")
                          ),
                          align: areAssetsGrouped ? "right" : "left",
                          render: (dataItem: any) => (
                              <span>{dataItem.settlement_date}</span>
                          ),
                          onCell: onCell,
                          className: "clickable"
                      }
                    : {},
                {
                    key: "value",
                    title: areAssetsGrouped ? (
                        <div>
                            <Translate content="exchange.value" />
                            <br />
                            {value}
                        </div>
                    ) : (
                        counterpart.translate("exchange.value")
                    ),
                    align: "right",
                    render: (dataItem: any) => (
                        <div>
                            <EquivalentValueComponent
                                hide_asset
                                amount={dataItem.order
                                    .amountForSale()
                                    .getAmount()}
                                fromAsset={
                                    dataItem.order.amountForSale().asset_id
                                }
                                noDecimals={true}
                                toAsset={dataItem.preferredUnit}
                            />{" "}
                            <AssetName name={dataItem.preferredUnit} />
                        </div>
                    ),
                    onCell: onCell,
                    className: "clickable"
                }
            ];
    };

    const renderSettleOrdersTable = () => {
        const {filterValue} = state;

        let settleOrders = account.get("settle_orders");

        if (filterValue) {
            settleOrders = getFilteredOrders("settle");
        }
        const dataSource = getDataSource(settleOrders, "settle");

        const pagination = {
            hideOnSinglePage: true,
            pageSize: 20,
            showTotal: (total: any) =>
                counterpart.translate("utility.total_x_items", {
                    count: total
                })
        };

        const footer = () => <span>&nbsp;</span>;

        const settleColumns = getColumns(false, dataSource, "settle");

        return (
            <Table
                columns={settleColumns}
                dataSource={dataSource}
                pagination={pagination}
                footer={footer}
            />
        );
    };

    const renderOrdersTable = () => {
        const {filterValue, areAssetsGrouped} = state;
        let orders = account.get("orders");

        if (filterValue) {
            orders = getFilteredOrders();
        }
        const dataSource = getDataSource(orders);

        const pagination = {
            hideOnSinglePage: true,
            pageSize: 20,
            showTotal: (total: any) =>
                counterpart.translate("utility.total_x_items", {
                    count: total
                })
        };

        const footer = () => children;

        const rowSelection = isMyAccount
            ? {
                  // Uncomment the following line to show translated text as a cancellable column header instead of checkbox
                  //columnTitle: counterpart.translate("wallet.cancel")
                  onChange: (selectedRowKeys: any) => {
                      mergeState({selectedOrders: selectedRowKeys});
                  },
                  // Required in order resetSelected to work
                  selectedRowKeys: state.selectedOrders
              }
            : null;

        const tables: any[] = [];

        if (areAssetsGrouped) {
            // Group by market name - this will group all records from the same market, no matter is it sell or buy order
            // And then group by base market ID - this will separate buy and sell records on the same market
            // Don't forget to count the direction - this allows to consider table as the same one when direction changes
            const grouped = groupBy(
                dataSource,
                (dataItem: any) =>
                    dataItem.marketName +
                    "_" +
                    (dataItem.marketDirection
                        ? dataItem.base.get("id")
                        : dataItem.quote.get("id"))
            );

            for (const [key, value] of Object.entries(grouped)) {
                let type;
                if ((value as any)[0].settlement_date) type = "settle";
                const columns = getColumns(areAssetsGrouped, value, type);
                tables.push(
                    <div className="grid-wrapper" key={key}>
                        <CollapsibleTable
                            columns={columns}
                            dataSource={value}
                            rowSelection={rowSelection}
                            pagination={pagination}
                            isCollapsed={true}
                        />
                    </div>
                );
            }
        } else {
            const columns = getColumns(areAssetsGrouped, dataSource);

            tables.push(
                <div className="grid-wrapper" key="ungroupedTable">
                    <Table
                        columns={columns}
                        dataSource={dataSource}
                        rowSelection={rowSelection}
                        pagination={pagination}
                        footer={footer}
                    />
                </div>
            );
        }

        return tables;
    };

    const getSelectedOrders = (keys: any) => {
        const orders = account
            .get("orders")
            .toArray()
            .filter((item: any) => keys.indexOf(item) != -1);
        return FetchChain("getObject", orders);
    };

    const cancelLimitOrders = () => {
        getSelectedOrders(state.selectedOrders).then((orders: any) => {
            const fallbackFeeAssets = orders
                .toJS()
                .map((item: any) => item.sell_price.base.asset_id);
            (MarketsActions as any)
                .cancelLimitOrders(
                    account.get("id"),
                    state.selectedOrders,
                    fallbackFeeAssets
                )
                .then(() => {
                    resetSelected();
                })
                .catch((err: any) => {
                    console.log("cancel orders error:", err);
                });
        });
    };

    const setFilterValue = (evt: any) => {
        mergeState({filterValue: evt.target.value.toLowerCase()});
    };

    const resetSelected = () => {
        mergeState({selectedOrders: []});
    };

    const cancelSelected = () => {
        cancelLimitOrders();
    };

    const {selectedOrders} = state;

    const ordersTable = renderOrdersTable();
    const settleOrdersTable = renderSettleOrdersTable();

    const tables = [ordersTable];

    const onGroupChange = (checked: any) => {
        (SettingsActions as any).changeViewSetting({
            accountOrdersGrouppedByAsset: checked
        });
        mergeState({areAssetsGrouped: checked});
    };

    const settleOrdersCount = account.get("settle_orders").size;

    return (
        <div
            className="grid-content no-overflow no-padding"
            style={{paddingBottom: 15}}
        >
            <div
                className="header-selector"
                style={{display: "inline-block", width: "100%"}}
            >
                <div className="filter-block">
                    <div className="filter">
                        <Input
                            type="text"
                            placeholder={counterpart.translate(
                                "account.filter_orders"
                            )}
                            onChange={setFilterValue}
                            addonAfter={<Icon type="search" />}
                        />
                    </div>
                    <div className="group-by">
                        <Switch
                            onChange={onGroupChange}
                            checked={state.areAssetsGrouped}
                        />
                        &nbsp;&nbsp;
                        <Translate content="account.group_by_asset" />
                    </div>
                </div>
                {selectedOrders.length ? (
                    <span className="action-buttons">
                        <Button
                            key="submit"
                            type="primary"
                            onClick={cancelSelected}
                        >
                            <Translate content="account.cancel_orders" />
                        </Button>
                        &nbsp;
                        <Button
                            key="cancel"
                            type="secondary"
                            onClick={resetSelected}
                        >
                            <Translate content="account.reset_orders" />
                        </Button>
                    </span>
                ) : null}
            </div>

            <div>
                {settleOrdersCount > 0 && (
                    <div className="header-selector">
                        <Translate content="account.market_orders" />
                    </div>
                )}
                {tables}
            </div>
            {settleOrdersCount > 0 && (
                <div className="grid-wrapper" key="settleGroupedTable">
                    <div className="header-selector">
                        <Translate content="account.settle_orders" />
                    </div>
                    {settleOrdersTable}
                </div>
            )}
        </div>
    );
}

interface AccountOrdersContainerProps
    extends Omit<AccountOrdersCoreProps, "marketDirections" | "viewSettings"> {
    account: any;
}

function AccountOrdersContainer(props: AccountOrdersContainerProps) {
    const settingsState = useAltStore<any>(SettingsStore);

    return (
        <AccountOrders
            {...props}
            marketDirections={settingsState.marketDirections}
            viewSettings={settingsState.viewSettings}
        />
    );
}

export default AccountOrdersContainer;
