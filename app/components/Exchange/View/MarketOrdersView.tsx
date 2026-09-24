// TypeScript/functional-component port of the legacy MarketOrdersView.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - the open-orders/open-settlement
// table shell, used by `MyOpenOrders.jsx` (541 lines, not yet ported,
// its only caller). `MarketOrdersViewTableHeader`/`MarketOrdersRowView`
// were already function components; `MarketsOrderView` (the class shell)
// is the one mechanically translated here.
//
// Unlike `MarketHistoryView.tsx` (ported alongside its one and only
// caller, `MarketHistory.tsx`, in the same slice, so the ref contract
// between them could be freely simplified to a plain prop), this file's
// caller - `MyOpenOrders.jsx` - is *not* part of this slice and stays
// legacy for now. It reaches into `MarketsOrderView`'s internals via
// `this.refs.view.refs.container` (`ref="view"` on the component, then
// `.refs.container` on the resulting instance) to drive
// `perfect-scrollbar` against the scrollable table container. A plain
// function component can't be given a ref at all, so `MarketsOrderView`
// is wrapped in `React.forwardRef` with `useImperativeHandle` exposing
// an object shaped exactly like the old class instance's `.refs` -
// `{refs: {container: <the div's DOM node>}}` - so `MyOpenOrders.jsx`'s
// existing `this.refs.view.refs.container` keeps resolving correctly,
// completely unmodified, until it too gets ported in a later slice (at
// which point this can be simplified to a direct ref/prop, the same
// simplification already applied to `MarketHistoryView.tsx`). The
// exposed `container` is a getter, not a snapshotted value, so it always
// reflects the DOM node's current state (absent before mount, present
// after) rather than whatever it was at the moment the handle was built.
import * as React from "react";
import counterpart from "counterpart";
import utils from "common/utils";
import Translate from "react-translate-component";
import PriceText from "../../Utility/PriceText";
import AssetName from "../../Utility/AssetName";
import {Tooltip, Checkbox} from "bitshares-ui-style-guide";

const rightAlign = {textAlign: "right" as const};

interface MarketOrdersViewTableHeaderProps {
    baseSymbol?: string | null;
    quoteSymbol?: string | null;
    selected?: boolean;
    onCancelToggle?: ((...args: any[]) => any) | null;
}

function MarketOrdersViewTableHeader({
    baseSymbol = null,
    quoteSymbol = null,
    selected,
    onCancelToggle
}: MarketOrdersViewTableHeaderProps) {
    return (
        <thead>
            <tr>
                <th style={{width: "6%", textAlign: "center"}}>
                    {onCancelToggle ? (
                        <Tooltip
                            title={counterpart.translate(
                                "exchange.cancel_order_select_all"
                            )}
                            placement="left"
                        >
                            <Checkbox
                                className="order-cancel-toggle"
                                checked={selected}
                                onChange={onCancelToggle}
                            />
                        </Tooltip>
                    ) : null}
                </th>
                <th style={rightAlign}>
                    <Translate
                        className="header-sub-title"
                        content="exchange.price"
                    />
                </th>
                <th style={rightAlign}>
                    {baseSymbol ? (
                        <span className="header-sub-title">
                            <AssetName dataPlace="top" name={quoteSymbol} />
                        </span>
                    ) : null}
                </th>
                <th style={rightAlign}>
                    {baseSymbol ? (
                        <span className="header-sub-title">
                            <AssetName dataPlace="top" name={baseSymbol} />
                        </span>
                    ) : null}
                </th>
                <th style={rightAlign}>
                    <Translate
                        className="header-sub-title"
                        content="transaction.expiration"
                    />
                </th>
            </tr>
        </thead>
    );
}

interface MarketOrdersRowViewProps {
    order: any;
    selected?: boolean;
    base: any;
    quote: any;
    onCheckCancel?: (...args: any[]) => any;
}

function MarketOrdersRowView({
    order,
    selected,
    base,
    quote,
    onCheckCancel
}: MarketOrdersRowViewProps) {
    const isBid = order.isBid();
    const isCall = order.isCall();
    const tdClass = isCall
        ? "orderHistoryCall"
        : isBid
        ? "orderHistoryBid"
        : "orderHistoryAsk";

    return (
        <tr key={order.id}>
            <td className="text-center" style={{width: "6%"}}>
                {isCall ? null : (
                    <Checkbox
                        className="orderCancel"
                        checked={selected}
                        onChange={onCheckCancel}
                    />
                )}
            </td>
            <td className={tdClass} style={{paddingLeft: 10}}>
                <PriceText price={order.getPrice()} base={base} quote={quote} />
            </td>
            <td>
                {(utils as any).format_number(
                    order[
                        !isBid ? "amountForSale" : "amountToReceive"
                    ]().getAmount({real: true}),
                    quote.get("precision")
                )}{" "}
            </td>
            <td>
                {(utils as any).format_number(
                    order[
                        !isBid ? "amountToReceive" : "amountForSale"
                    ]().getAmount({real: true}),
                    base.get("precision")
                )}{" "}
            </td>
            <td>
                <Tooltip title={order.expiration.toLocaleString()}>
                    <div
                        style={{
                            textAlign: "right",
                            whiteSpace: "nowrap"
                        }}
                    >
                        {isCall
                            ? null
                            : counterpart.localize(new Date(order.expiration), {
                                  type: "date",
                                  format: "short_custom"
                              })}
                    </div>
                </Tooltip>
            </td>
        </tr>
    );
}

interface MarketsOrderViewProps {
    style?: any;
    className?: string;
    innerClass?: string;
    innerStyle?: any;
    headerStyle?: any;
    noHeader?: boolean;
    isSelected?: boolean;
    tinyScreen?: boolean;
    activeTab?: string;
    baseSymbol?: string | null;
    quoteSymbol?: string | null;
    contentContainer?: any;
    footerContainer?: any;
    onCancelToggle?: (...args: any[]) => any;
}

const MarketsOrderView = React.forwardRef<any, MarketsOrderViewProps>(
    function MarketsOrderView(props, ref) {
        const containerRef = React.useRef<HTMLDivElement>(null);

        React.useImperativeHandle(
            ref,
            () => ({
                refs: {
                    get container() {
                        return containerRef.current;
                    }
                }
            }),
            []
        );

        const {
            style,
            className,
            innerClass,
            innerStyle,
            headerStyle,
            noHeader,
            isSelected,
            tinyScreen,
            activeTab,
            baseSymbol,
            quoteSymbol,
            contentContainer,
            footerContainer,
            onCancelToggle
        } = props;

        return (
            <div style={style} key="open_orders" className={className}>
                <div className={innerClass} style={innerStyle}>
                    {noHeader ? null : (
                        <div
                            style={headerStyle}
                            className="exchange-content-header"
                        >
                            {activeTab == "my_orders" ? (
                                <Translate content="exchange.my_orders" />
                            ) : null}
                            {activeTab == "open_settlement" ? (
                                <Translate content="exchange.settle_orders" />
                            ) : null}
                        </div>
                    )}
                    <div className="grid-block shrink left-orderbook-header market-right-padding-only">
                        <table className="table order-table text-right fixed-table market-right-padding">
                            <MarketOrdersViewTableHeader
                                baseSymbol={baseSymbol}
                                quoteSymbol={quoteSymbol}
                                selected={isSelected}
                                onCancelToggle={
                                    activeTab == "my_orders"
                                        ? onCancelToggle
                                        : null
                                }
                            />
                        </table>
                    </div>

                    <div
                        className="table-container grid-block market-right-padding-only no-overflow"
                        ref={containerRef}
                        style={{
                            overflow: "hidden",
                            minHeight: tinyScreen ? 260 : 0,
                            maxHeight: 260,
                            lineHeight: "13px"
                        }}
                    >
                        <table className="table order-table table-highlight-hover table-hover no-stripes text-right fixed-table market-right-padding">
                            {contentContainer}
                        </table>
                    </div>
                    {footerContainer}
                </div>
            </div>
        );
    }
);

export {MarketsOrderView, MarketOrdersRowView};
