// TypeScript/functional-component port of the legacy OpenSettleOrders.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - the open force-settlement orders
// table, used by `MyOpenOrders.jsx` (not yet ported, its only importer).
// Mechanical translation, no logic changes.
//
// Confirmed dead, dropped: the whole `TableHeader` class - defined, not
// exported, and never rendered anywhere in this file (`OpenSettleOrders`'s
// own `render()` never references it). Also dropped: the
// `ref="contentTransition"` on `TransitionWrapper` - never read via
// `this.refs` anywhere; and `quoteSymbol`/`baseSymbol` from
// `OpenSettleOrders`'s own props - declared (even required, via
// `propTypes`) but never read in `render()`, which only destructures
// `orders`/`base`/`quote` - these were presumably meant for the now-dead
// `TableHeader`. The `defaultProps` values for them are kept anyway,
// exactly as the original had them, since a caller may still pass them
// and it's harmless either way.
//
// `OpenSettleOrders`'s `shouldComponentUpdate` checks only
// `currentAccount`/`orders`, deliberately narrower than all props
// `render()` reads (`base`/`quote` aren't checked) - preserved via a
// `React.memo` comparator replicating exactly that, not dropped as a
// no-op.
import * as React from "react";
import utils from "common/utils";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import getLocale from "browser-locale";
import TransitionWrapper from "../Utility/TransitionWrapper";
import {Tooltip} from "bitshares-ui-style-guide";

interface SettleOrderRowProps {
    base: any;
    quote: any;
    order: any;
    showSymbols?: boolean;
}

function SettleOrderRow({
    base,
    quote,
    order,
    showSymbols = false
}: SettleOrderRowProps) {
    const price =
        base.get("id") == "1.3.0"
            ? order.getPrice() / (1 + order.offset_percent / 10000)
            : order.getPrice() * (1 + order.offset_percent / 10000);
    const amountSymbol = showSymbols ? " " + quote.get("symbol") : null;

    return (
        <tr>
            <td className="text-center" style={{width: "6%"}}>
                {" "}
            </td>
            <td>
                {(utils as any).format_number(price, quote.get("precision"))}{" "}
                {amountSymbol}
            </td>
            <td>
                {(utils as any).format_number(
                    order[
                        !order.isBid() ? "amountForSale" : "amountToReceive"
                    ]().getAmount({real: true}),
                    quote.get("precision")
                )}
            </td>
            <td>
                {(utils as any).format_number(
                    order[
                        !order.isBid() ? "amountToReceive" : "amountForSale"
                    ]().getAmount({real: true}),
                    base.get("precision")
                )}
            </td>
            <td>
                <Tooltip title={new Date(order.settlement_date).toString()}>
                    <div style={{textAlign: "right", whiteSpace: "nowrap"}}>
                        {counterpart.localize(new Date(order.settlement_date), {
                            type: "date",
                            format:
                                (getLocale as any)()
                                    .toLowerCase()
                                    .indexOf("en-us") !== -1
                                    ? "market_history_us"
                                    : "market_history"
                        } as any)}
                    </div>
                </Tooltip>
            </td>
        </tr>
    );
}

interface OpenSettleOrdersProps {
    base: any;
    quote: any;
    orders: any;
    currentAccount?: any;
}

function OpenSettleOrdersInner({
    orders,
    base,
    quote
}: OpenSettleOrdersProps) {
    let activeOrders = null;

    const emptyRow = (
        <tbody>
            <tr>
                <td
                    style={{
                        textAlign: "center",
                        lineHeight: 4,
                        fontStyle: "italic"
                    }}
                    colSpan={5}
                >
                    <Translate content="account.no_orders" />
                </td>
            </tr>
        </tbody>
    );

    if (orders.size > 0 && base && quote) {
        activeOrders = orders
            .sort((a: any, b: any) => {
                return a.isBefore(b) ? -1 : 1;
            })
            .map((order: any) => {
                return (
                    <SettleOrderRow
                        key={order.id}
                        order={order}
                        base={base}
                        quote={quote}
                    />
                );
            })
            .toArray();
    }

    return (
        <TransitionWrapper component="tbody" transitionName="newrow">
            {activeOrders ? activeOrders : emptyRow}
        </TransitionWrapper>
    );
}

function arePropsEqual(
    prevProps: OpenSettleOrdersProps,
    nextProps: OpenSettleOrdersProps
) {
    return (
        nextProps.currentAccount === prevProps.currentAccount &&
        nextProps.orders === prevProps.orders
    );
}

const OpenSettleOrders = React.memo(OpenSettleOrdersInner, arePropsEqual);

(OpenSettleOrders as any).defaultProps = {
    base: {},
    quote: {},
    orders: {},
    quoteSymbol: "",
    baseSymbol: ""
};

export default OpenSettleOrders;
