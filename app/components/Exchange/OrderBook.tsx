// TypeScript/functional-component port of the legacy OrderBook.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - the order book panel (both the
// vertical `StickyTable` layout and the horizontal split-table layout),
// plus its row components and the `GroupOrderLimitSelector` control also
// used by `Personalize.tsx`. No transaction-submission logic here - only
// reads order data (via `onClick`, a caller-supplied callback) and
// manages its own scroll/animation/grouping UI state.
//
// `Exchange.jsx` (not yet ported) still reaches into this component from
// the outside via a legacy string ref: `ref="order_book"` then
// `this.refs.order_book.verticalStickyTable.current.scrollData
// .scrollWidth` (to measure the vertical order book's panel width). Kept
// working via `React.forwardRef` + `useImperativeHandle` exposing
// `{verticalStickyTable: <the same ref object used internally>}` -
// exposing the ref object itself (not a snapshotted value) so
// `.current` always reflects the live `StickyTable` instance, matching
// this migration's established deferred-legacy-caller pattern (see
// `View/MarketOrdersView.tsx`).
//
// Confirmed dead, dropped:
// - `OrderRows`'s own `ref={isBid ? "bidTransition" : "askTransaction"}`
//   (note "askTransaction" - a typo for "askTransition"): a string ref
//   never read anywhere, not even inside `OrderRows` itself.
// - `OrderBook`'s `state.flip` (initialized from `props.flipOrderBook`
//   in the constructor, never read anywhere else in the class).
// - `componentDidUpdate`'s `if (this.refs.vert_bids) this.refs.vert_bids
//   .scrollTop = 0;`: no element anywhere in `render()` is ever given
//   `ref="vert_bids"`, so this ref is always `undefined` and the guard
//   never passes - likely a leftover from an earlier version of the
//   vertical layout, before it was reworked to use `StickyTable`.
// - `OrderBook.propTypes`/`defaultProps`' `bids`/`asks`/`orders`: never
//   read anywhere in the file, and `bids`/`asks` aren't even passed by
//   the real caller (`Exchange.jsx` passes `orders`, `calls` and
//   `invertedCalls` instead - also all three confirmed unread anywhere
//   in this file, kept as accepted-but-unused since `Exchange.jsx`
//   stays a legacy caller this slice and still supplies them).
// - `shouldComponentUpdate`'s commented-out `if (!nextProps.marketReady)
//   return false;` - already inert in the original source, dropped
//   along with the comment; confirms `marketReady` (still passed by
//   `Exchange.jsx`) is accepted-but-unused here.
// - `GroupOrderLimitSelector`'s `getDerivedStateFromProps` unconditionally
//   overwrote `state.groupLimit` with `props.currentGroupOrderLimit` on
//   *every* render, with no condition - so that state was always exactly
//   equal to the prop. Reading `currentGroupOrderLimit` directly instead
//   is a zero-behavioral-difference simplification.
//
// Structural changes:
// - The four row components' real `shouldComponentUpdate`s are preserved
//   via `React.memo` with the exact logical-inverse comparator,
//   including `OrderBookRowVertical`/`GroupedOrderBookRowVertical`'s
//   special-case early `return false` when `order.market_base` differs
//   (a deliberate "don't re-render this row instance across a market
//   switch" guard, not a bug) - the memo comparator returns `true`
//   ("equal", skip) in that same case. `OrderBookRowVertical`'s SCU also
//   compares `isPanelActive`, but `OrderBook.render()` never actually
//   passes an `isPanelActive` prop down to `<OrderBookRowVertical>`
//   (confirmed via a whole-file grep - `OrderBook` itself receives
//   `isPanelActive` from `Exchange.jsx` but never forwards or otherwise
//   reads it), so that comparison is always `undefined !== undefined`
//   (always `false`) in practice; kept in the comparator anyway for
//   exact fidelity, at zero cost.
// - `OrderBook`'s own `shouldComponentUpdate` always returns `true` (a
//   deliberate, unconditional always-re-render - not a gate at all), so
//   it needs no `React.memo` replication; its only real job was two
//   inline side effects (perfect-scrollbar destroy/reinitialize plus
//   `TransitionWrapper.resetAnimation()`, run when `showAllAsks`/
//   `showAllBids` toggle while horizontal+hideScrollbars) - ported as
//   two `useLayoutEffect`s keyed on those two state values respectively
//   (mount-skipped), matching the original's pre-commit timing as
//   closely as hooks allow.
// - `componentDidUpdate`'s market/direction-change branch, for the
//   *vertical* layout only, ended with `this.setState({autoScroll:
//   this.state.autoScroll})` - a same-value `setState` that (in a class,
//   whose own SCU always returns `true`) still forces one additional
//   render + `componentDidUpdate` pass, apparently so
//   `centerVerticalScrollBar()`'s DOM measurements re-run once the
//   market-change scroll/animation resets have settled. A `useState`
//   setter would bail out on an unchanged value (unlike a class's
//   `setState`), so this is replicated with a small `useReducer`-based
//   forced-update counter instead, to reproduce the same "one extra
//   render" behavior.
// - `componentDidUpdate`'s `hideScrollbars`-toggle branch (horizontal
//   only) and its unconditional trailing `this.centerVerticalScrollBar()`
//   call become their own `useLayoutEffect`s (declared in the same
//   relative order as the original method, since same-commit
//   `useLayoutEffect`s run in declaration order) - the latter as a
//   no-dependency-array, mount-skipped effect, matching
//   `componentDidUpdate` firing unconditionally on every update (unlike
//   `componentDidMount`, which never calls `centerVerticalScrollBar()`).
import * as React from "react";
import cnames from "classnames";
import translator from "counterpart";
import {StickyTable, Row, Cell} from "react-sticky-table";
import Translate from "react-translate-component";
import Ps from "perfect-scrollbar";
import utils from "common/utils";
import PriceText from "../Utility/PriceText";
import TransitionWrapper from "../Utility/TransitionWrapper";
import AssetName from "../Utility/AssetName";
import Icon from "../Icon/Icon";
import {Select, Tooltip} from "bitshares-ui-style-guide";
import ReactDOM from "react-dom";

interface OrderRowsProps {
    orderRows: any[];
    noOrders: boolean;
    isBid: boolean;
    id?: string;
}

function OrderRows({orderRows, noOrders, isBid, id}: OrderRowsProps) {
    return (
        <TransitionWrapper id={id} component={null} transitionName="newrow">
            {orderRows.length > 0
                ? orderRows
                : noOrders || (
                      <div className="sticky-table-row">
                          <td className="cell no-orders" colSpan={3}>
                              {isBid ? (
                                  <Translate content="exchange.no_bids" />
                              ) : (
                                  <Translate content="exchange.no_asks" />
                              )}
                          </td>
                      </div>
                  )}
        </TransitionWrapper>
    );
}

function OrderBookRowVerticalInner(props: any) {
    const {order, quote, base, final} = props;
    const isBid = order.isBid();
    const isCall = order.isCall();
    const integerClass = isCall
        ? "orderHistoryCall"
        : isBid
        ? "orderHistoryBid"
        : "orderHistoryAsk";

    const price = <PriceText price={order.getPrice()} quote={quote} base={base} />;
    return (
        <Row
            onClick={props.onClick}
            className={cnames(
                "sticky-table-row order-row",
                {"final-row": final},
                {"my-order": order.isMine(props.currentAccount)},
                "clickable"
            )}
        >
            <Cell className="cell left">
                {(utils as any).format_number(
                    order[isBid ? "amountForSale" : "amountToReceive"]().getAmount(
                        {real: true}
                    ),
                    base.get("precision")
                )}
            </Cell>
            <Cell className="cell">
                {(utils as any).format_number(
                    order[isBid ? "amountToReceive" : "amountForSale"]().getAmount(
                        {real: true}
                    ),
                    quote.get("precision")
                )}
            </Cell>
            <Cell className={`cell ${integerClass} right`}>{price}</Cell>
        </Row>
    );
}

function orderBookRowVerticalPropsAreEqual(prevProps: any, nextProps: any) {
    if (nextProps.order.market_base !== prevProps.order.market_base) {
        return true;
    }
    return !(
        nextProps.order.ne(prevProps.order) ||
        nextProps.index !== prevProps.index ||
        nextProps.currentAccount !== prevProps.currentAccount ||
        nextProps.isPanelActive !== prevProps.isPanelActive ||
        nextProps.horizontal !== prevProps.horizontal
    );
}

const OrderBookRowVertical = React.memo(
    OrderBookRowVerticalInner,
    orderBookRowVerticalPropsAreEqual
);

const elemHeight = (elem: any) => (elem ? elem.getBoundingClientRect().height : 0);

function OrderBookRowHorizontalInner(props: any) {
    const {order, quote, base, position, quoteTotal} = props;
    const isBid = order.isBid();
    const isCall = order.isCall();

    const integerClass = isCall
        ? "orderHistoryCall"
        : isBid
        ? "orderHistoryBid"
        : "orderHistoryAsk";

    const price = <PriceText price={order.getPrice()} quote={quote} base={base} />;
    const amount = isBid
        ? (utils as any).format_number(
              order.amountToReceive().getAmount({real: true}),
              quote.get("precision")
          )
        : (utils as any).format_number(
              order.amountForSale().getAmount({real: true}),
              quote.get("precision")
          );
    const value = isBid
        ? (utils as any).format_number(
              order.amountForSale().getAmount({real: true}),
              base.get("precision")
          )
        : (utils as any).format_number(
              order.amountToReceive().getAmount({real: true}),
              base.get("precision")
          );
    const totalValueBids = quoteTotal ? order.totalToReceive() : order.totalForSale();
    const totalValueAsks = quoteTotal ? order.totalForSale() : order.totalToReceive();
    const totalAsset = quoteTotal ? quote : base;
    const total = isBid
        ? (utils as any).format_number(
              totalValueBids.getAmount({real: true}),
              totalAsset.get("precision")
          )
        : (utils as any).format_number(
              totalValueAsks.getAmount({real: true}),
              totalAsset.get("precision")
          );

    let bgImage = "";
    if (props.marketDepthPercentage && !props.isBid) {
        bgImage = `linear-gradient(to right, rgba(255,0,0,.15) ${props.marketDepthPercentage ||
            0}%, rgba(0,0,0,0) ${props.marketDepthPercentage || 0}%)`;
    } else if (props.marketDepthPercentage && props.isBid) {
        bgImage = `linear-gradient(to left, rgba(0,255,0,.15) ${props.marketDepthPercentage ||
            0}%, rgba(0,0,0,0) ${props.marketDepthPercentage || 0}%)`;
    }

    return (
        <tr
            onClick={props.onClick}
            className={order.isMine(props.currentAccount) ? "my-order" : ""}
            style={{backgroundImage: bgImage}}
        >
            {position === "left" ? (
                <td className="column-hide-xs">{total}</td>
            ) : (
                <td style={{width: "25%"}} className={integerClass}>
                    {price}
                </td>
            )}
            <td>{position === "left" ? value : amount}</td>
            <td>{position === "left" ? amount : value}</td>
            {position === "right" ? (
                <td className="column-hide-xs">{total}</td>
            ) : (
                <td style={{width: "25%"}} className={integerClass}>
                    {price}
                </td>
            )}
        </tr>
    );
}

function orderBookRowHorizontalPropsAreEqual(prevProps: any, nextProps: any) {
    return !(
        nextProps.order.ne(prevProps.order) ||
        nextProps.position !== prevProps.position ||
        nextProps.index !== prevProps.index ||
        nextProps.currentAccount !== prevProps.currentAccount ||
        nextProps.quoteTotal !== prevProps.quoteTotal
    );
}

const OrderBookRowHorizontal = React.memo(
    OrderBookRowHorizontalInner,
    orderBookRowHorizontalPropsAreEqual
);

function GroupedOrderBookRowVerticalInner(props: any) {
    const {order, quote, base, final} = props;
    const isBid = order.isBid();
    const integerClass = isBid ? "orderHistoryBid" : "orderHistoryAsk";

    const price = <PriceText price={order.getPrice()} quote={quote} base={base} />;
    return (
        <Row
            onClick={props.onClick}
            className={cnames(
                "sticky-table-row order-row",
                {"final-row": final},
                "clickable"
            )}
        >
            <Cell className="cell left">
                {(utils as any).format_number(
                    order[isBid ? "amountForSale" : "amountToReceive"]().getAmount(
                        {real: true}
                    ),
                    base.get("precision")
                )}
            </Cell>
            <Cell className="cell">
                {(utils as any).format_number(
                    order[isBid ? "amountToReceive" : "amountForSale"]().getAmount(
                        {real: true}
                    ),
                    quote.get("precision")
                )}
            </Cell>
            <Cell className={`cell ${integerClass} right`}>{price}</Cell>
        </Row>
    );
}

function groupedOrderBookRowVerticalPropsAreEqual(prevProps: any, nextProps: any) {
    if (nextProps.order.market_base !== prevProps.order.market_base) {
        return true;
    }
    return !(
        nextProps.order.ne(prevProps.order) ||
        nextProps.index !== prevProps.index ||
        nextProps.currentAccount !== prevProps.currentAccount
    );
}

const GroupedOrderBookRowVertical = React.memo(
    GroupedOrderBookRowVerticalInner,
    groupedOrderBookRowVerticalPropsAreEqual
);

function GroupedOrderBookRowHorizontalInner(props: any) {
    const {order, quote, base, position, quoteTotal} = props;
    const isBid = order.isBid();

    const integerClass = isBid ? "orderHistoryBid" : "orderHistoryAsk";

    const price = <PriceText price={order.getPrice()} quote={quote} base={base} />;
    const amount = isBid
        ? (utils as any).format_number(
              order.amountToReceive().getAmount({real: true}),
              quote.get("precision")
          )
        : (utils as any).format_number(
              order.amountForSale().getAmount({real: true}),
              quote.get("precision")
          );
    const value = isBid
        ? (utils as any).format_number(
              order.amountForSale().getAmount({real: true}),
              base.get("precision")
          )
        : (utils as any).format_number(
              order.amountToReceive().getAmount({real: true}),
              base.get("precision")
          );
    const totalValueBids = quoteTotal ? order.totalToReceive() : order.totalForSale();
    const totalValueAsks = quoteTotal ? order.totalForSale() : order.totalToReceive();
    const totalAsset = quoteTotal ? quote : base;
    const total = isBid
        ? (utils as any).format_number(
              totalValueBids.getAmount({real: true}),
              totalAsset.get("precision")
          )
        : (utils as any).format_number(
              totalValueAsks.getAmount({real: true}),
              totalAsset.get("precision")
          );

    return (
        <tr onClick={props.onClick}>
            {position === "left" ? (
                <td className="column-hide-xs">{total}</td>
            ) : (
                <td style={{width: "25%"}} className={integerClass}>
                    {price}
                </td>
            )}
            <td>{position === "left" ? value : amount}</td>
            <td>{position === "left" ? amount : value}</td>
            {position === "right" ? (
                <td className="column-hide-xs">{total}</td>
            ) : (
                <td style={{width: "25%"}} className={integerClass}>
                    {price}
                </td>
            )}
        </tr>
    );
}

const GroupedOrderBookRowHorizontal = React.memo(
    GroupedOrderBookRowHorizontalInner,
    orderBookRowHorizontalPropsAreEqual
);

interface GroupOrderLimitSelectorProps {
    trackedGroupsConfig: any[];
    globalSettingsSelector?: boolean;
    currentGroupOrderLimit: any;
    handleGroupOrderLimitChange: (...args: any[]) => any;
}

function GroupOrderLimitSelector({
    trackedGroupsConfig,
    globalSettingsSelector,
    currentGroupOrderLimit,
    handleGroupOrderLimitChange
}: GroupOrderLimitSelectorProps) {
    const noGroupsAvailable = trackedGroupsConfig.length === 0;
    const trackedGroupsOptionsList = trackedGroupsConfig.map(key =>
        globalSettingsSelector ? (
            <Select.Option value={key} key={key}>
                {`${key / 100}%`}
            </Select.Option>
        ) : (
            <option value={key} key={key}>
                {`${key / 100}%`}
            </option>
        )
    );

    if (globalSettingsSelector) {
        return (
            <Select
                placeholder="Select option"
                style={{width: "100%"}}
                value={currentGroupOrderLimit}
                disabled={noGroupsAvailable}
                onChange={handleGroupOrderLimitChange}
            >
                {noGroupsAvailable ? (
                    <Select.Option value={0}>
                        <Translate content="tooltip.no_groups_available" />
                    </Select.Option>
                ) : (
                    <Select.Option value={0}>
                        <Translate content="settings.disabled" />
                    </Select.Option>
                )}
                {trackedGroupsOptionsList}
            </Select>
        );
    } else {
        return (
            <Tooltip
                placement="bottom"
                title={
                    noGroupsAvailable
                        ? (translator as any).translate(
                              "tooltip.no_groups_available"
                          )
                        : null
                }
            >
                <select
                    value={currentGroupOrderLimit}
                    onChange={handleGroupOrderLimitChange}
                    className="settings-select"
                    style={noGroupsAvailable ? {cursor: "not-allowed"} : undefined}
                >
                    <Translate
                        content="exchange.group_order_limit"
                        component="option"
                        value="0"
                    />
                    {trackedGroupsOptionsList}
                </select>
            </Tooltip>
        );
    }
}

interface OrderBookProps {
    combinedBids: any[];
    combinedAsks: any[];
    highestBid: any;
    lowestAsk: any;
    quote: any;
    base: any;
    totalAsks: any;
    totalBids: any;
    quoteSymbol: string;
    baseSymbol: string;
    horizontal?: boolean;
    trackedGroupsConfig?: any[];
    currentGroupOrderLimit: any;
    handleGroupOrderLimitChange: (...args: any[]) => any;
    orderBookReversed?: boolean;
    groupedBids: any[];
    groupedAsks: any[];
    flipOrderBook?: boolean;
    onClick: (...args: any[]) => any;
    currentAccount?: any;
    hideScrollbars?: boolean;
    autoScroll?: boolean;
    smallScreen?: boolean;
    hideFunctionButtons?: boolean;
    wrapperClass?: any;
    innerClass?: any;
    onFlipOrderBook?: (...args: any[]) => any;
    onTogglePosition?: (...args: any[]) => any;
    moveOrderBook?: (...args: any[]) => any;
    latest?: any;
    changeClass?: any;
    isPanelActive?: boolean;
    // Passed by the still-legacy Exchange.jsx caller, confirmed unread
    // anywhere in this file - kept accepted-but-unused.
    orders?: any;
    calls?: any;
    invertedCalls?: any;
    marketReady?: boolean;
}

const OrderBookInner = React.forwardRef<any, OrderBookProps>(
    function OrderBook(props, ref) {
        const {
            combinedBids,
            combinedAsks,
            highestBid,
            lowestAsk,
            quote,
            base,
            totalAsks,
            totalBids,
            quoteSymbol,
            baseSymbol,
            horizontal,
            trackedGroupsConfig,
            currentGroupOrderLimit,
            handleGroupOrderLimitChange,
            orderBookReversed,
            groupedBids,
            groupedAsks,
            flipOrderBook,
            onClick,
            currentAccount,
            hideScrollbars,
            smallScreen,
            hideFunctionButtons,
            wrapperClass,
            innerClass,
            onFlipOrderBook,
            onTogglePosition,
            moveOrderBook,
            latest,
            changeClass
        } = props;

        const [showAllBids, setShowAllBids] = React.useState(false);
        const [showAllAsks, setShowAllAsks] = React.useState(false);
        const [displaySpreadAsPercentage, setDisplaySpreadAsPercentage] = React.useState(
            false
        );
        const [autoScroll, setAutoScroll] = React.useState(() => props.autoScroll);
        const [quoteTotalBids, setQuoteTotalBids] = React.useState(false);
        const [quoteTotalAsks, setQuoteTotalAsks] = React.useState(false);
        const rowCount = 20;

        const verticalStickyTable = React.useRef<any>(null);
        const centerText = React.useRef<any>(null);
        const hor_bids = React.useRef<any>(null);
        const hor_asks = React.useRef<any>(null);
        const askTransition = React.useRef<any>(null);
        const bidTransition = React.useRef<any>(null);

        React.useImperativeHandle(ref, () => ({
            verticalStickyTable
        }));

        const queryStickyTable = (query: string | null = null) => {
            // `StickyTable` (react-sticky-table, untyped/unmodified third-
            // party class component) exposes no ref-forwarded DOM node of
            // its own, so `findDOMNode` - deprecated but still functional
            // outside StrictMode - is the only way to reach its rendered
            // DOM, same as the original class did.
            // eslint-disable-next-line react/no-find-dom-node
            const node = (ReactDOM as any).findDOMNode(
                verticalStickyTable.current
            );
            if (query == null) return node;
            return node.querySelector(query);
        };

        const verticalScrollBar = () => queryStickyTable();

        const psUpdate = () => {
            if (!horizontal) {
                Ps.update(verticalScrollBar());
            } else {
                Ps.update(hor_bids.current);
                Ps.update(hor_asks.current);
            }
        };

        const centerVerticalScrollBar = () => {
            if (!horizontal && autoScroll) {
                // Center vertical scroll bar
                const scrollableContainer = queryStickyTable();
                const header = queryStickyTable(".top-header");
                const centerTextContainer = centerText.current;
                const singleRowHeight = elemHeight(
                    queryStickyTable(".order-row")
                );

                const rows =
                    currentGroupOrderLimit !== 0
                        ? !orderBookReversed
                            ? groupedAsks
                            : groupedBids
                        : !orderBookReversed
                        ? combinedAsks
                        : combinedBids;

                const rowsHeight = rows.length * singleRowHeight;

                const scrollableContainerHeight =
                    elemHeight(scrollableContainer) - elemHeight(header);

                const scrollTo =
                    rowsHeight +
                    elemHeight(centerTextContainer) / 2 -
                    scrollableContainerHeight / 2;

                scrollableContainer.scrollTop = scrollTo;
            }
        };

        const isFirstShowAllAsksRender = React.useRef(true);
        React.useLayoutEffect(() => {
            if (isFirstShowAllAsksRender.current) {
                isFirstShowAllAsksRender.current = false;
                return;
            }
            if (horizontal && hideScrollbars) {
                const asksContainer = hor_asks.current;
                if (!showAllAsks) {
                    Ps.destroy(asksContainer);
                } else {
                    Ps.initialize(asksContainer);
                    psUpdate();
                }
                if (askTransition.current) askTransition.current.resetAnimation();
                if (hor_asks.current) hor_asks.current.scrollTop = 0;
            }
        }, [showAllAsks]);

        const isFirstShowAllBidsRender = React.useRef(true);
        React.useLayoutEffect(() => {
            if (isFirstShowAllBidsRender.current) {
                isFirstShowAllBidsRender.current = false;
                return;
            }
            if (horizontal && hideScrollbars) {
                const bidsContainer = hor_bids.current;
                if (!showAllBids) {
                    Ps.destroy(bidsContainer);
                } else {
                    Ps.initialize(bidsContainer);
                    psUpdate();
                }
                if (bidTransition.current) bidTransition.current.resetAnimation();
                if (hor_bids.current) hor_bids.current.scrollTop = 0;
            }
        }, [showAllBids]);

        // Mount-only, matching the original componentDidMount exactly.
        React.useLayoutEffect(() => {
            if (!horizontal) {
                Ps.initialize(verticalScrollBar());
            } else {
                if (!hideScrollbars) {
                    Ps.initialize(hor_bids.current);
                    Ps.initialize(hor_asks.current);
                }
            }
        }, []);

        const [, forceRerender] = React.useReducer(c => c + 1, 0);
        const prevBaseIdRef = React.useRef(base && base.get && base.get("id"));
        const prevQuoteIdRef = React.useRef(quote && quote.get && quote.get("id"));
        const isFirstMarketChangeRender = React.useRef(true);
        React.useLayoutEffect(() => {
            const baseId = base && base.get && base.get("id");
            const quoteId = quote && quote.get && quote.get("id");
            if (isFirstMarketChangeRender.current) {
                isFirstMarketChangeRender.current = false;
                prevBaseIdRef.current = baseId;
                prevQuoteIdRef.current = quoteId;
                return;
            }
            if (baseId !== prevBaseIdRef.current || quoteId !== prevQuoteIdRef.current) {
                if (askTransition.current) {
                    askTransition.current.resetAnimation();
                    if (hor_asks.current) hor_asks.current.scrollTop = 0;
                    if (hor_bids.current) hor_bids.current.scrollTop = 0;
                }

                if (bidTransition.current) {
                    bidTransition.current.resetAnimation();
                }

                if (!horizontal) {
                    // Forces one extra render + effect pass, so
                    // `centerVerticalScrollBar()` (below) re-measures
                    // after the resets above have settled - see the
                    // file-header note.
                    forceRerender();
                }
            }
            prevBaseIdRef.current = baseId;
            prevQuoteIdRef.current = quoteId;
        });

        const prevHideScrollbarsRef = React.useRef(hideScrollbars);
        const isFirstHideScrollbarsRender = React.useRef(true);
        React.useLayoutEffect(() => {
            if (isFirstHideScrollbarsRender.current) {
                isFirstHideScrollbarsRender.current = false;
                prevHideScrollbarsRef.current = hideScrollbars;
                return;
            }
            const prevHideScrollbars = prevHideScrollbarsRef.current;
            if (horizontal && hideScrollbars !== prevHideScrollbars) {
                const bidsContainer = hor_bids.current;
                const asksContainer = hor_asks.current;
                if (hideScrollbars) {
                    Ps.destroy(bidsContainer);
                    Ps.destroy(asksContainer);
                } else {
                    Ps.initialize(bidsContainer);
                    Ps.initialize(asksContainer);
                    if (askTransition.current) askTransition.current.resetAnimation();
                    if (bidTransition.current) bidTransition.current.resetAnimation();
                    if (asksContainer) asksContainer.scrollTop = 0;
                    if (bidsContainer) bidsContainer.scrollTop = 0;
                    psUpdate();
                }
            }
            prevHideScrollbarsRef.current = hideScrollbars;
        });

        const isFirstCenterScrollRender = React.useRef(true);
        React.useLayoutEffect(() => {
            if (isFirstCenterScrollRender.current) {
                isFirstCenterScrollRender.current = false;
                return;
            }
            centerVerticalScrollBar();
        });

        const onSetShowAll = (type: string) => {
            if (type === "asks") {
                setShowAllAsks(prev => {
                    if (prev && hor_asks.current) {
                        hor_asks.current.scrollTop = 0;
                    }
                    return !prev;
                });
            } else {
                setShowAllBids(prev => {
                    if (prev && hor_bids.current) {
                        hor_bids.current.scrollTop = 0;
                    }
                    return !prev;
                });
            }
        };

        const toggleSpreadValue = () => {
            setDisplaySpreadAsPercentage(prev => !prev);
        };

        const toggleAutoScroll = () => {
            setAutoScroll(prev => !prev);
        };

        const toggleTotalAsset = (isBid?: boolean) => {
            if (isBid) {
                setQuoteTotalBids(prev => !prev);
            } else {
                setQuoteTotalAsks(prev => !prev);
            }
        };

        const noOrders = !lowestAsk.sell_price && !highestBid.sell_price;
        const hasAskAndBids = !!(lowestAsk.sell_price && highestBid.sell_price);
        const spread =
            hasAskAndBids &&
            (displaySpreadAsPercentage ? (
                `${(
                    100 *
                    (lowestAsk._real_price / highestBid._real_price - 1)
                ).toFixed(2)}%`
            ) : (
                <PriceText
                    price={lowestAsk._real_price - highestBid._real_price}
                    base={base}
                    quote={quote}
                />
            ));
        let bidRows: any[] | null = null,
            askRows: any[] | null = null;

        /* Sort */
        const tempAsks = currentGroupOrderLimit !== 0 ? groupedAsks : combinedAsks; // RED
        const tempBids = currentGroupOrderLimit !== 0 ? groupedBids : combinedBids; // GREEN

        if (!horizontal && !orderBookReversed) {
            tempBids.sort((a, b) => {
                return b.getPrice() - a.getPrice();
            });
            tempAsks.sort((a, b) => {
                return b.getPrice() - a.getPrice();
            });
        } else if (!horizontal && orderBookReversed) {
            tempBids.sort((a, b) => {
                return a.getPrice() - b.getPrice();
            });
            tempAsks.sort((a, b) => {
                return a.getPrice() - b.getPrice();
            });
        }

        if (base && quote) {
            // limit orders or grouped orders
            if (currentGroupOrderLimit !== 0) {
                bidRows = tempBids.map((order, index) => {
                    return horizontal ? (
                        <GroupedOrderBookRowHorizontal
                            index={index}
                            key={order.getPrice() + (order.isBid() ? "_bid" : "")}
                            order={order}
                            onClick={onClick.bind(null, order)}
                            base={base}
                            quote={quote}
                            position={!flipOrderBook ? "left" : "right"}
                            currentAccount={currentAccount}
                            quoteTotal={quoteTotalBids}
                        />
                    ) : (
                        <GroupedOrderBookRowVertical
                            index={index}
                            key={order.getPrice() + (order.isBid() ? "_bid" : "")}
                            order={order}
                            onClick={onClick.bind(null, order)}
                            base={base}
                            quote={quote}
                            final={index === 0}
                            currentAccount={currentAccount}
                        />
                    );
                });

                askRows = tempAsks.map((order, index) => {
                    return horizontal ? (
                        <GroupedOrderBookRowHorizontal
                            index={index}
                            key={order.getPrice() + (order.isBid() ? "_bid" : "")}
                            order={order}
                            onClick={onClick.bind(null, order)}
                            base={base}
                            quote={quote}
                            type={order.type}
                            position={!flipOrderBook ? "right" : "left"}
                            currentAccount={currentAccount}
                            quoteTotal={quoteTotalAsks}
                        />
                    ) : (
                        <GroupedOrderBookRowVertical
                            index={index}
                            key={order.getPrice() + (order.isBid() ? "_bid" : "")}
                            order={order}
                            onClick={onClick.bind(null, order)}
                            base={base}
                            quote={quote}
                            type={order.type}
                            final={0 === index}
                            currentAccount={currentAccount}
                        />
                    );
                });
            } else {
                const maxBid = tempBids.length
                    ? tempBids[tempBids.length - 1].totalForSale().getAmount()
                    : 0;

                bidRows = tempBids.map((order, index) => {
                    const value = order.totalForSale().getAmount();
                    const percentage = Math.ceil((value * 100) / maxBid);
                    return horizontal ? (
                        <OrderBookRowHorizontal
                            index={index}
                            key={
                                order.getPrice() + (order.isCall() ? "_call" : "")
                            }
                            marketDepthPercentage={percentage}
                            isBid={true}
                            order={order}
                            onClick={onClick.bind(null, order)}
                            base={base}
                            quote={quote}
                            position={!flipOrderBook ? "left" : "right"}
                            currentAccount={currentAccount}
                            quoteTotal={quoteTotalBids}
                        />
                    ) : (
                        <OrderBookRowVertical
                            index={index}
                            key={
                                order.getPrice() + (order.isCall() ? "_call" : "")
                            }
                            order={order}
                            onClick={onClick.bind(null, order)}
                            base={base}
                            quote={quote}
                            final={index === 0}
                            currentAccount={currentAccount}
                        />
                    );
                });

                const maxAsk = tempAsks.length
                    ? tempAsks[tempAsks.length - 1].totalForSale().getAmount()
                    : 0;

                askRows = tempAsks.map((order, index) => {
                    const value = order.totalForSale().getAmount();
                    const percentage = Math.ceil((value * 100) / maxAsk);
                    return horizontal ? (
                        <OrderBookRowHorizontal
                            index={index}
                            marketDepthPercentage={percentage}
                            isBid={false}
                            key={
                                order.getPrice() + (order.isCall() ? "_call" : "")
                            }
                            order={order}
                            onClick={onClick.bind(null, order)}
                            base={base}
                            quote={quote}
                            type={order.type}
                            position={!flipOrderBook ? "right" : "left"}
                            currentAccount={currentAccount}
                            quoteTotal={quoteTotalAsks}
                        />
                    ) : (
                        <OrderBookRowVertical
                            index={index}
                            key={
                                order.getPrice() + (order.isCall() ? "_call" : "")
                            }
                            order={order}
                            onClick={onClick.bind(null, order)}
                            base={base}
                            quote={quote}
                            type={order.type}
                            final={0 === index}
                            currentAccount={currentAccount}
                        />
                    );
                });
            }
        }

        if (horizontal) {
            const totalBidsLength = (bidRows as any[]).length;
            const totalAsksLength = (askRows as any[]).length;

            if (!showAllBids) {
                (bidRows as any[]).splice(rowCount, (bidRows as any[]).length);
            }

            if (!showAllAsks) {
                (askRows as any[]).splice(rowCount, (askRows as any[]).length);
            }

            const leftHeader = (
                <thead>
                    <tr key="top-header" className="top-header">
                        <th className="column-hide-xs">
                            <Translate
                                className="header-sub-title"
                                content="exchange.total"
                            />
                            <a
                                onClick={() => toggleTotalAsset(true)}
                                className="header-sub-title underline-title"
                            >
                                {" "}
                                <AssetName
                                    dataPlace="top"
                                    name={!quoteTotalBids ? baseSymbol : quoteSymbol}
                                    noTip
                                />
                            </a>
                        </th>
                        <th>
                            <span className="header-sub-title">
                                <AssetName dataPlace="top" name={baseSymbol} />
                            </span>
                        </th>
                        <th>
                            <span className="header-sub-title">
                                <AssetName dataPlace="top" name={quoteSymbol} />
                            </span>
                        </th>
                        <th>
                            <Translate
                                className={
                                    (flipOrderBook ? "ask-total" : "bid-total") +
                                    " header-sub-title"
                                }
                                content="exchange.price"
                            />
                        </th>
                    </tr>
                </thead>
            );

            const rightHeader = (
                <thead>
                    <tr key="top-header" className="top-header">
                        <th>
                            <Translate
                                className={
                                    (!flipOrderBook ? "ask-total" : "bid-total") +
                                    " header-sub-title"
                                }
                                content="exchange.price"
                            />
                        </th>
                        <th>
                            <span className="header-sub-title">
                                <AssetName dataPlace="top" name={quoteSymbol} />
                            </span>
                        </th>
                        <th>
                            <span className="header-sub-title">
                                <AssetName dataPlace="top" name={baseSymbol} />
                            </span>
                        </th>
                        <th className="column-hide-xs">
                            <Translate
                                className="header-sub-title"
                                content="exchange.total"
                            />
                            <a
                                onClick={() => toggleTotalAsset()}
                                className="header-sub-title underline-title"
                            >
                                {" "}
                                <AssetName
                                    dataPlace="top"
                                    name={!quoteTotalAsks ? baseSymbol : quoteSymbol}
                                    noTip
                                />
                            </a>
                        </th>
                    </tr>
                </thead>
            );

            return (
                <div
                    style={{marginRight: smallScreen ? 10 : 0}}
                    className={cnames(wrapperClass)}
                >
                    <div
                        className={cnames(
                            innerClass,
                            flipOrderBook ? "order-1" : "order-2"
                        )}
                    >
                        <div>
                            <div className="exchange-content-header ask">
                                <Translate content="exchange.asks" />
                                {flipOrderBook && !hideFunctionButtons ? (
                                    <div style={{display: "inline-block"}}>
                                        <span
                                            onClick={onFlipOrderBook}
                                            style={{
                                                cursor: "pointer",
                                                fontSize: "1rem",
                                                marginLeft: "4px",
                                                position: "relative",
                                                top: "-2px"
                                            }}
                                            className="flip-arrow"
                                        >
                                            {" "}
                                            &#8646;
                                        </span>
                                    </div>
                                ) : null}
                                {flipOrderBook && !hideFunctionButtons ? (
                                    <div className="float-right header-sub-title grouped_order">
                                        {trackedGroupsConfig ? (
                                            <GroupOrderLimitSelector
                                                trackedGroupsConfig={
                                                    trackedGroupsConfig
                                                }
                                                handleGroupOrderLimitChange={
                                                    handleGroupOrderLimitChange
                                                }
                                                currentGroupOrderLimit={
                                                    currentGroupOrderLimit
                                                }
                                            />
                                        ) : null}
                                    </div>
                                ) : null}
                                {onTogglePosition && !hideFunctionButtons ? (
                                    <span
                                        onClick={onTogglePosition}
                                        style={{
                                            cursor: "pointer",
                                            fontSize: "1rem"
                                        }}
                                        className="flip-arrow"
                                    >
                                        {" "}
                                        &#8645;
                                    </span>
                                ) : null}
                                {flipOrderBook && !hideFunctionButtons ? (
                                    <span
                                        className="order-book-button-v"
                                        onClick={moveOrderBook}
                                    >
                                        <Icon
                                            name="thumb-tack"
                                            className="icon-14px icon-fill"
                                        />
                                    </span>
                                ) : null}
                                <div
                                    style={{lineHeight: "16px"}}
                                    className="header-sub-title float-right"
                                >
                                    <Translate content="exchange.market_depth" />
                                    <span>: </span>
                                    {(utils as any).format_number(
                                        totalAsks,
                                        quote.get("precision")
                                    )}
                                    <span>
                                        {" "}
                                        (<AssetName name={quoteSymbol} />)
                                    </span>
                                </div>
                            </div>
                            <div
                                className="market-right-padding-only"
                                style={{paddingRight: "0.6rem"}}
                            >
                                <table className="table order-table table-hover fixed-table text-right">
                                    {!flipOrderBook ? rightHeader : leftHeader}
                                </table>
                            </div>
                            <div
                                className="grid-block"
                                ref={hor_asks}
                                style={{
                                    paddingRight: "0.6rem",
                                    overflow: "hidden",
                                    maxHeight: 260,
                                    lineHeight: "13px"
                                }}
                            >
                                <table
                                    style={{paddingBottom: 5}}
                                    className="table order-table no-stripes table-hover fixed-table text-right no-overflow"
                                >
                                    <TransitionWrapper
                                        ref={askTransition}
                                        className="orderbook clickable"
                                        component="tbody"
                                        transitionName="newrow"
                                        id="top-order-rows"
                                    >
                                        {askRows}
                                    </TransitionWrapper>
                                </table>
                            </div>
                            {totalAsksLength > 11 ? (
                                <div className="orderbook-showall">
                                    <a onClick={() => onSetShowAll("asks")}>
                                        <Translate
                                            content={
                                                showAllAsks
                                                    ? "exchange.hide"
                                                    : "exchange.show_asks"
                                            }
                                            ordercount={totalAsksLength}
                                        />
                                    </a>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div
                        className={cnames(
                            innerClass,
                            flipOrderBook ? "order-2" : "order-1"
                        )}
                    >
                        <div>
                            <div className="exchange-content-header bid">
                                <Translate content="exchange.bids" />
                                {!flipOrderBook && !hideFunctionButtons ? (
                                    <div style={{display: "inline-block"}}>
                                        <span
                                            onClick={onFlipOrderBook}
                                            style={{
                                                cursor: "pointer",
                                                fontSize: "1rem",
                                                marginLeft: "4px",
                                                position: "relative",
                                                top: "-2px"
                                            }}
                                            className="flip-arrow"
                                        >
                                            {" "}
                                            &#8646;
                                        </span>
                                    </div>
                                ) : null}
                                {!flipOrderBook && !hideFunctionButtons ? (
                                    <div className="float-right header-sub-title grouped_order">
                                        {trackedGroupsConfig ? (
                                            <GroupOrderLimitSelector
                                                trackedGroupsConfig={
                                                    trackedGroupsConfig
                                                }
                                                handleGroupOrderLimitChange={
                                                    handleGroupOrderLimitChange
                                                }
                                                currentGroupOrderLimit={
                                                    currentGroupOrderLimit
                                                }
                                            />
                                        ) : null}
                                    </div>
                                ) : null}
                                {currentGroupOrderLimit !== 0 &&
                                    hideFunctionButtons && (
                                        <Icon
                                            name="grouping"
                                            className="float-right icon-14px"
                                            title={(translator as any).translate(
                                                "icons.order_grouping"
                                            )}
                                            style={{
                                                marginLeft: "0.5rem"
                                            }}
                                        />
                                    )}
                                {onTogglePosition && !hideFunctionButtons ? (
                                    <span
                                        onClick={onTogglePosition}
                                        style={{
                                            cursor: "pointer",
                                            fontSize: "1rem"
                                        }}
                                        className="flip-arrow"
                                    >
                                        {" "}
                                        &#8645;
                                    </span>
                                ) : null}
                                {!flipOrderBook && !hideFunctionButtons ? (
                                    <span
                                        className="order-book-button-v"
                                        onClick={moveOrderBook}
                                    >
                                        <Icon
                                            name="thumb-tack"
                                            className="icon-14px"
                                        />
                                    </span>
                                ) : null}
                                <div
                                    style={{lineHeight: "16px"}}
                                    className="float-right header-sub-title"
                                >
                                    <Translate content="exchange.market_depth" />
                                    <span>: </span>
                                    {(utils as any).format_number(
                                        totalBids,
                                        base.get("precision")
                                    )}
                                    <span>
                                        {" "}
                                        (<AssetName name={baseSymbol} />)
                                    </span>
                                </div>
                            </div>
                            <div
                                className="market-right-padding-only"
                                style={{paddingRight: "0.6rem"}}
                            >
                                <table className="table order-table table-hover fixed-table text-right">
                                    {flipOrderBook ? rightHeader : leftHeader}
                                </table>
                            </div>
                            <div
                                className="grid-block"
                                ref={hor_bids}
                                style={{
                                    paddingRight: "0.6rem",
                                    overflow: "hidden",
                                    maxHeight: 260,
                                    lineHeight: "13px"
                                }}
                            >
                                <table
                                    style={{paddingBottom: 5}}
                                    className="table order-table no-stripes table-hover fixed-table text-right no-overflow"
                                >
                                    <TransitionWrapper
                                        ref={bidTransition}
                                        className="orderbook clickable"
                                        component="tbody"
                                        transitionName="newrow"
                                    >
                                        {bidRows}
                                    </TransitionWrapper>
                                </table>
                            </div>
                            {totalBidsLength > rowCount ? (
                                <div className="orderbook-showall">
                                    <a onClick={() => onSetShowAll("bids")}>
                                        <Translate
                                            content={
                                                showAllBids
                                                    ? "exchange.hide"
                                                    : "exchange.show_bids"
                                            }
                                            ordercount={totalBidsLength}
                                        />
                                    </a>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            );
        } else {
            // Vertical orderbook
            return (
                <div className="order-table-container">
                    <StickyTable
                        borderWidth="0px"
                        borderColor="grey"
                        leftStickyColumnCount={0}
                        className="order-table table"
                        ref={verticalStickyTable}
                    >
                        <Row className="top-header sticky-table-header">
                            <Cell className="cell header-cell left">
                                <span className="header-sub-title">
                                    <AssetName name={baseSymbol} />
                                </span>
                            </Cell>
                            <Cell className="cell header-cell">
                                <span className="header-sub-title">
                                    <AssetName name={quoteSymbol} />
                                </span>
                            </Cell>
                            <Cell className="cell header-cell right">
                                <Translate
                                    className="header-sub-title"
                                    content="exchange.price"
                                />
                            </Cell>
                        </Row>
                        {orderBookReversed ? (
                            <OrderRows
                                id="top-order-rows"
                                noOrders={noOrders}
                                orderRows={bidRows as any[]}
                                isBid={true}
                            />
                        ) : (
                            <OrderRows
                                id="top-order-rows"
                                noOrders={noOrders}
                                orderRows={askRows as any[]}
                                isBid={false}
                            />
                        )}

                        {noOrders ? (
                            <Row className="sticky-table-row" ref={centerText}>
                                <Cell className="cell" />
                                <Cell className="cell no-orders padtop">
                                    <Translate content="exchange.no_orders" />
                                </Cell>
                            </Row>
                        ) : (
                            <Row
                                className="sticky-table-row orderbook-latest-price"
                                ref={centerText}
                                style={{padding: 0}}
                            >
                                <Cell className="cell right">
                                    <span
                                        className="clickable left"
                                        onClick={toggleSpreadValue}
                                    >
                                        <Translate
                                            className="orderbook-center-title"
                                            content="exchange.spread"
                                        />{" "}
                                        <span className="spread-value">
                                            {!!spread ? spread : "0"}
                                        </span>
                                    </span>
                                </Cell>
                                <Cell className="cell cell-center">
                                    <span style={{width: 75}}>
                                        {!hideFunctionButtons ? (
                                            <Icon
                                                className="lock-unlock clickable icon-fill"
                                                onClick={toggleAutoScroll}
                                                name={
                                                    autoScroll
                                                        ? "locked"
                                                        : "unlocked"
                                                }
                                                title={
                                                    autoScroll
                                                        ? "icons.unlocked.disable_auto_scroll"
                                                        : "icons.locked.enable_auto_scroll"
                                                }
                                            />
                                        ) : null}
                                        &nbsp;
                                        {!hideFunctionButtons ? (
                                            <Icon
                                                onClick={moveOrderBook}
                                                name="thumb-tack"
                                                className="icon-14px icon-fill order-book-button-v clickable"
                                                title={
                                                    horizontal
                                                        ? "icons.thumb_tack"
                                                        : "icons.thumb_untack"
                                                }
                                                style={{
                                                    marginLeft: 0
                                                }}
                                            />
                                        ) : null}
                                        &nbsp;
                                        {currentGroupOrderLimit == 0 ? null : (
                                            <Icon
                                                name="grouping"
                                                className="icon-14px"
                                                title={(translator as any).translate(
                                                    "icons.order_grouping"
                                                )}
                                                style={{
                                                    marginLeft: 0
                                                }}
                                            />
                                        )}
                                    </span>
                                </Cell>
                                <Cell className="cell" style={{textAlign: "center"}}>
                                    {!!latest && (
                                        <span className="right">
                                            <span
                                                className={
                                                    !changeClass
                                                        ? "spread-value"
                                                        : changeClass
                                                }
                                            >
                                                <PriceText
                                                    price={latest}
                                                    base={base}
                                                    quote={quote}
                                                />
                                            </span>
                                        </span>
                                    )}
                                </Cell>
                            </Row>
                        )}

                        {orderBookReversed ? (
                            <OrderRows
                                noOrders={noOrders}
                                orderRows={askRows as any[]}
                                isBid={false}
                            />
                        ) : (
                            <OrderRows
                                noOrders={noOrders}
                                orderRows={bidRows as any[]}
                                isBid={true}
                            />
                        )}
                    </StickyTable>
                </div>
            );
        }
    }
);

export {OrderBookInner as OrderBook, GroupOrderLimitSelector};
