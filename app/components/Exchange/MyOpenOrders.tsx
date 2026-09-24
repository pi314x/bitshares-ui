// TypeScript/functional-component port of the legacy MyOpenOrders.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - the "my open orders" / "open
// settlement orders" panel, rendered twice by `Exchange.jsx` (not yet
// ported, its only caller) with different `activeTab` values. Exports a
// named `MarketOrders`, matching the file's pre-existing external
// contract (`import {MarketOrders} from "./MyOpenOrders"`) - the
// filename and the exported name have never matched in this codebase.
//
// Two components in the original: `MarketOrdersRow` (thin wrapper around
// `MarketOrdersRowView`, already ported) and `MarketOrders` (the
// orchestrator, using `MarketsOrderView`/`OpenSettleOrders`/
// `TransitionWrapper`, all already ported).
//
// `MarketOrdersRow`'s `shouldComponentUpdate` is another confirmed-real
// (non-no-op) SCU gate this phase keeps finding: it checks
// `order.for_sale`/`order.id`/`quote`/`base`/`order.market_base`/
// `selected`, not `price` or `onCancel` - preserved via a `React.memo`
// comparator. `onCancel` itself is a confirmed-dead prop: passed by the
// parent (via a fresh `.bind()` call on every render, wastefully) but
// never read inside `MarketOrdersRow`'s own body - kept as an accepted-
// but-unused prop, not dropped, since it's genuinely supplied.
// `price`, likewise never read *inside* `MarketOrdersRow`, is not dead -
// `MarketOrders`' own render sorts the still-unmounted `<MarketOrdersRow
// price={price} .../>` React elements by reading `.props.price` directly
// off each element object (a legitimate, if unusual, use of a React
// element's own `.props` before it's ever rendered) - preserved exactly,
// including for the ported function-component version, whose elements
// still carry the same externally-readable `.props`.
//
// `MarketOrders` closely mirrors `MarketHistory.tsx`'s structure (both
// files were adapted from a shared original), with the same
// `componentDidUpdate(prevState)` bug preserved the same way (React
// always passes `prevProps` first - the parameter is mislabeled, and
// since nothing passes a `showAll` *prop*, the comparison is
// unconditionally true - replicated with an always-running,
// mount-skipped effect) and the same treatment for its own SCU gate
// (props-subset comparison via `React.memo`; state comparisons need no
// replication, since a functional component's own `useState` updates
// always trigger its re-render regardless of memo). One real difference
// from `MarketHistory.tsx`: `render()` here genuinely reads
// `state.activeTab` (not `props.activeTab` with an override) - so unlike
// `MarketHistory.tsx`'s write-only shadow copy, this one is actually
// displayed. Its `UNSAFE_componentWillReceiveProps` activeTab check also
// differs subtly from `MarketHistory.tsx`'s: it compares
// `nextProps.activeTab` against `this.state.activeTab` (not
// `this.props.activeTab`) - preserved exactly, via an effect that reads
// the latest state value at the time it fires.
//
// `orders`, `flipMyOrders`, `smallScreen`, `hidePanel`, and
// `isPanelActive` are confirmed accepted-but-unused props - all passed
// by `Exchange.jsx`, none ever read anywhere in this file (`_getOrders()`
// computes orders from `currentAccount` directly, never from
// `props.orders`).
//
// Two separate refs feed `updateContainer`: `containerRef`, threaded
// into the already-`forwardRef`-wrapped `MarketsOrderView` (reading
// `.current.refs.container`, matching that component's exposed
// backward-compatible shape), and `contentTransitionRef`, attached
// directly to the `TransitionWrapper` this component renders itself as
// part of `contentContainer` (a plain, direct ref - `TransitionWrapper`
// is still a class component, untouched).
import * as React from "react";
import Ps from "perfect-scrollbar";
import OpenSettleOrders from "./OpenSettleOrders";
import MarketsActions from "actions/MarketsActions";
import Translate from "react-translate-component";
import TransitionWrapper from "../Utility/TransitionWrapper";
import SettingsActions from "actions/SettingsActions";
import {ChainStore, FetchChain} from "bitsharesjs";
import {LimitOrder, CallOrder} from "common/MarketClasses";
import ReactTooltip from "react-tooltip";
import {Button} from "bitshares-ui-style-guide";
import {MarketsOrderView, MarketOrdersRowView} from "./View/MarketOrdersView";
import NotificationActions from "actions/NotificationActions";

interface MarketOrdersRowProps {
    order: any;
    selected?: boolean;
    base: any;
    quote: any;
    price?: any;
    onCancel?: (...args: any[]) => any;
    onCheckCancel: (...args: any[]) => any;
}

function MarketOrdersRowInner({
    base,
    quote,
    order,
    selected,
    onCheckCancel
}: MarketOrdersRowProps) {
    return (
        <MarketOrdersRowView
            key={order.id}
            order={order}
            selected={selected}
            base={base}
            quote={quote}
            onCheckCancel={onCheckCancel}
        />
    );
}

function areRowPropsEqual(
    prevProps: MarketOrdersRowProps,
    nextProps: MarketOrdersRowProps
) {
    return !(
        nextProps.order.for_sale !== prevProps.order.for_sale ||
        nextProps.order.id !== prevProps.order.id ||
        nextProps.quote !== prevProps.quote ||
        nextProps.base !== prevProps.base ||
        nextProps.order.market_base !== prevProps.order.market_base ||
        nextProps.selected !== prevProps.selected
    );
}

const MarketOrdersRow = React.memo(MarketOrdersRowInner, areRowPropsEqual);

interface MarketOrdersProps {
    base: any;
    quote: any;
    baseSymbol: string;
    quoteSymbol: string;
    settleOrders: any;
    currentAccount: any;
    feedPrice?: any;
    activeTab?: string;
    className?: string;
    hideScrollbars?: boolean;
    onCancel?: (...args: any[]) => any;
    style?: any;
    innerClass?: string;
    innerStyle?: any;
    headerStyle?: any;
    noHeader?: boolean;
    tinyScreen?: boolean;
    orders?: any;
    flipMyOrders?: any;
    smallScreen?: boolean;
    hidePanel?: any;
    isPanelActive?: boolean;
}

function MarketOrdersInner(props: MarketOrdersProps) {
    const {
        base,
        quote,
        baseSymbol,
        quoteSymbol,
        settleOrders,
        currentAccount,
        feedPrice,
        activeTab: activeTabProp,
        hideScrollbars,
        style,
        className,
        innerClass,
        innerStyle,
        headerStyle,
        noHeader,
        tinyScreen
    } = props;

    const rowCount = 20;
    const [activeTab, setActiveTab] = React.useState(activeTabProp);
    const [showAll, setShowAll] = React.useState(false);
    const [selectedOrders, setSelectedOrders] = React.useState<any[]>([]);

    const viewRef = React.useRef<any>(null);
    const contentTransitionRef = React.useRef<any>(null);

    function updateContainer(type = 2) {
        const containerNode = viewRef.current && viewRef.current.refs.container;
        const containerTransition = contentTransitionRef.current;

        if (!containerNode) return;

        if (type == 0) {
            containerNode.scrollTop = 0;
            (Ps as any).destroy(containerNode);
        } else if (type == 1) {
            (Ps as any).initialize(containerNode);
            updateContainer(3);
        } else if (type == 2) {
            (Ps as any).update(containerNode);
        } else if (type == 3) {
            containerNode.scrollTop = 0;
            (Ps as any).update(containerNode);
        }

        if (containerTransition) {
            containerTransition.resetAnimation();
        }
    }

    function onSetShowAll() {
        setShowAll(prev => !prev);
    }

    function changeTab(tab: string | undefined) {
        (SettingsActions as any).changeViewSetting({
            ordersTab: tab
        });
        setActiveTab(tab);

        // Ensure that focus goes back to top of scrollable container when tab is changed
        updateContainer(3);

        setTimeout((ReactTooltip as any).rebuild, 1000);
    }

    function onCheckCancel(orderId: string, evt: any) {
        const checked = evt.target.checked;

        if (checked) {
            setSelectedOrders(prev => prev.concat([orderId]));
        } else {
            setSelectedOrders(prev => {
                const index = prev.indexOf(orderId);
                if (index > -1) {
                    return prev.slice(0, index).concat(prev.slice(index + 1));
                }
                return prev;
            });
        }
    }

    function resetSelected() {
        setSelectedOrders([]);
    }

    function getSelectedOrders(keys: any[]) {
        const orders = currentAccount
            .get("orders")
            .toArray()
            .filter((item: any) => keys.indexOf(item) != -1);
        return (FetchChain as any)("getObject", orders);
    }

    function cancelLimitOrders() {
        getSelectedOrders(selectedOrders).then((orders: any) => {
            const fallbackFeeAssets = orders
                .toJS()
                .map((item: any) => item.sell_price.base.asset_id);
            (MarketsActions as any)
                .cancelLimitOrders(
                    currentAccount.get("id"),
                    selectedOrders,
                    fallbackFeeAssets
                )
                .then(() => {
                    resetSelected();
                })
                .catch((err: any) => {
                    if (
                        typeof err === "string" &&
                        err.startsWith("Insufficient balance")
                    )
                        (NotificationActions as any).error(err);
                    else console.log("cancel orders error:", err);
                });
        });
    }

    function cancelSelected() {
        cancelLimitOrders();
    }

    function getOrders() {
        const orders = currentAccount.get("orders"),
            call_orders = currentAccount.get("call_orders");
        const baseID = base.get("id"),
            quoteID = quote.get("id");
        const assets = {
            [base.get("id")]: {precision: base.get("precision")},
            [quote.get("id")]: {precision: quote.get("precision")}
        };
        const limitOrders = orders
            .toArray()
            .map((order: any) => {
                const o = (ChainStore as any).getObject(order);
                if (!o) return null;
                const sellBase = o.getIn(["sell_price", "base", "asset_id"]),
                    sellQuote = o.getIn(["sell_price", "quote", "asset_id"]);
                if (
                    (sellBase === baseID && sellQuote === quoteID) ||
                    (sellBase === quoteID && sellQuote === baseID)
                ) {
                    return new (LimitOrder as any)(
                        o.toJS(),
                        assets,
                        quote.get("id")
                    );
                }
            })
            .filter((a: any) => !!a);

        const callOrders = call_orders
            .toArray()
            .map((order: any) => {
                try {
                    const o = (ChainStore as any).getObject(order);
                    if (!o) return null;
                    const sellBase = o.getIn([
                            "call_price",
                            "base",
                            "asset_id"
                        ]),
                        sellQuote = o.getIn([
                            "call_price",
                            "quote",
                            "asset_id"
                        ]);
                    if (
                        (sellBase === baseID && sellQuote === quoteID) ||
                        (sellBase === quoteID && sellQuote === baseID)
                    ) {
                        return feedPrice
                            ? new (CallOrder as any)(
                                  o.toJS(),
                                  assets,
                                  quote.get("id"),
                                  feedPrice
                              )
                            : null;
                    }
                } catch (e) {
                    return null;
                }
            })
            .filter((a: any) => !!a)
            .filter((a: any) => {
                try {
                    return a.isMarginCalled();
                } catch (err) {
                    return false;
                }
            });
        return limitOrders.concat(callOrders);
    }

    function onCancelToggle(evt: any) {
        const orders = getOrders();
        const newSelectedOrders: any[] = [];

        orders.forEach((order: any) => {
            newSelectedOrders.push(order.id);
        });

        if (evt.target.checked) {
            setSelectedOrders(newSelectedOrders);
        } else {
            resetSelected();
        }
    }

    const isFirstActiveTabEffect = React.useRef(true);
    React.useEffect(() => {
        if (isFirstActiveTabEffect.current) {
            isFirstActiveTabEffect.current = false;
            return;
        }
        if (activeTabProp !== activeTab) {
            changeTab(activeTabProp);
        }
        // eslint-disable-next-line
    }, [activeTabProp]);

    const isFirstMarketSwitchEffect = React.useRef(true);
    React.useEffect(() => {
        if (isFirstMarketSwitchEffect.current) {
            isFirstMarketSwitchEffect.current = false;
            return;
        }
        setShowAll(false);
        updateContainer(0);

        if (!hideScrollbars) {
            updateContainer(1);
        }
        // eslint-disable-next-line
    }, [baseSymbol, quoteSymbol]);

    const isFirstHideScrollbarsEffect = React.useRef(true);
    React.useEffect(() => {
        if (isFirstHideScrollbarsEffect.current) {
            isFirstHideScrollbarsEffect.current = false;
            return;
        }
        updateContainer(0);

        if (!hideScrollbars) {
            updateContainer(1);
        }
        // eslint-disable-next-line
    }, [hideScrollbars]);

    React.useEffect(() => {
        if (!hideScrollbars) {
            updateContainer(1);
        }
        // eslint-disable-next-line
    }, []);

    const isFirstDidUpdateEffect = React.useRef(true);
    React.useEffect(() => {
        if (isFirstDidUpdateEffect.current) {
            isFirstDidUpdateEffect.current = false;
            return;
        }
        // See header comment: this branch is effectively unconditional
        // in the original (a mislabeled-parameter bug), preserved as-is.
        if (showAll && !hideScrollbars) {
            updateContainer(2);
        } else if (!showAll && !hideScrollbars) {
            updateContainer(3);
        } else if (showAll && hideScrollbars) {
            updateContainer(1);
        } else {
            updateContainer(0);
        }
        // eslint-disable-next-line
    });

    if (!base || !quote) return null;

    let contentContainer;
    let footerContainer;

    /* Users Open Orders Tab (default) */
    let totalRows = 0;

    // User Orders
    if (!activeTab || activeTab == "my_orders") {
        const orders = getOrders();

        const bids = orders
            .filter((a: any) => {
                return a.isBid();
            })
            .sort((a: any, b: any) => {
                return b.getPrice() - a.getPrice();
            })
            .map((order: any) => {
                const price = order.getPrice();
                return (
                    <MarketOrdersRow
                        price={price}
                        key={order.id}
                        order={order}
                        base={base}
                        quote={quote}
                        selected={
                            selectedOrders.length > 0 &&
                            selectedOrders.includes(order.id)
                        }
                        onCancel={
                            () => props.onCancel && props.onCancel(order.id)
                        }
                        onCheckCancel={(evt: any) =>
                            onCheckCancel(order.id, evt)
                        }
                    />
                );
            });

        const asks = orders
            .filter((a: any) => {
                return !a.isBid();
            })
            .sort((a: any, b: any) => {
                return a.getPrice() - b.getPrice();
            })
            .map((order: any) => {
                const price = order.getPrice();
                return (
                    <MarketOrdersRow
                        price={price}
                        key={order.id}
                        order={order}
                        base={base}
                        quote={quote}
                        selected={
                            selectedOrders.length > 0 &&
                            selectedOrders.includes(order.id)
                        }
                        onCancel={
                            () => props.onCancel && props.onCancel(order.id)
                        }
                        onCheckCancel={(evt: any) =>
                            onCheckCancel(order.id, evt)
                        }
                    />
                );
            });

        let rows: any[] = [];

        if (asks.length) {
            rows = rows.concat(asks);
        }

        if (bids.length) {
            rows = rows.concat(bids);
        }

        rows.sort((a: any, b: any) => {
            return a.props.price - b.props.price;
        });

        totalRows = rows.length;

        if (totalRows > 0 && !showAll) {
            rows.splice(rowCount, rows.length);
        }

        const emptyRow = (
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
        );

        const cancelOrderButton = (
            <div style={{display: "grid"}}>
                <Button onClick={cancelSelected}>
                    <Translate content="exchange.cancel_selected_orders" />
                </Button>
            </div>
        );

        contentContainer = (
            <TransitionWrapper
                ref={contentTransitionRef}
                component="tbody"
                transitionName="newrow"
            >
                {rows.length ? rows : emptyRow}
            </TransitionWrapper>
        );

        footerContainer =
            totalRows > 11 ? (
                <React.Fragment>
                    <div className="orderbook-showall">
                        <a onClick={onSetShowAll}>
                            <Translate
                                content={
                                    showAll
                                        ? "exchange.hide"
                                        : "exchange.show_all_orders"
                                }
                                rowcount={totalRows}
                            />
                        </a>
                    </div>
                    {selectedOrders.length > 0 ? cancelOrderButton : null}
                </React.Fragment>
            ) : selectedOrders.length > 0 ? (
                cancelOrderButton
            ) : null;
    }

    // Open Settle Orders
    if (activeTab && activeTab == "open_settlement") {
        totalRows = settleOrders.length;

        if (totalRows > 0 && !showAll) {
            settleOrders.splice(rowCount, settleOrders.length);
        }

        contentContainer = (
            <OpenSettleOrders
                key="settle_orders"
                orders={settleOrders}
                base={base}
                quote={quote}
            />
        );

        footerContainer = totalRows > 11 && (
            <div className="orderbook-showall">
                <a onClick={onSetShowAll}>
                    <Translate
                        content={
                            showAll
                                ? "exchange.hide"
                                : "exchange.show_all_orders"
                        }
                        rowcount={totalRows}
                    />
                </a>
            </div>
        );
    }

    const isSelected =
        selectedOrders.length > 0 && selectedOrders.length == totalRows;

    return (
        <MarketsOrderView
            ref={viewRef}
            // Styles and Classes
            style={style}
            className={className}
            innerClass={innerClass}
            innerStyle={innerStyle}
            headerStyle={headerStyle}
            // Bools
            noHeader={noHeader}
            isSelected={isSelected}
            tinyScreen={tinyScreen}
            // Strings
            activeTab={activeTab}
            baseSymbol={baseSymbol}
            quoteSymbol={quoteSymbol}
            // Containers
            contentContainer={contentContainer}
            footerContainer={footerContainer}
            // Functions
            onCancelToggle={onCancelToggle}
        />
    );
}

function areOrdersPropsEqual(
    prevProps: MarketOrdersProps,
    nextProps: MarketOrdersProps
) {
    return !(
        nextProps.baseSymbol !== prevProps.baseSymbol ||
        nextProps.quoteSymbol !== prevProps.quoteSymbol ||
        nextProps.className !== prevProps.className ||
        nextProps.activeTab !== prevProps.activeTab ||
        nextProps.currentAccount !== prevProps.currentAccount ||
        nextProps.settleOrders !== prevProps.settleOrders
    );
}

const MarketOrders = React.memo(MarketOrdersInner, areOrdersPropsEqual);

(MarketOrders as any).defaultProps = {
    base: {},
    quote: {},
    orders: {},
    quoteSymbol: "",
    baseSymbol: ""
};

export {MarketOrders};
