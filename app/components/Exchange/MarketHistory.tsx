// TypeScript/functional-component port of the legacy MarketHistory.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - the trade-history panel (both
// "market history" and "my history" tabs), rendered inside `Exchange.jsx`
// (not yet ported, its only caller). Mechanical translation, no logic
// changes, but several lifecycle methods needed care to preserve exactly:
//
// - `rowCount` was declared as state but never once updated via
//   `setState` anywhere in the file - a de facto constant (always 20).
//   Kept as a plain `const`, not a `useState`, since nothing ever
//   changes it.
// - The two internal refs `MarketHistoryView.jsx` used to expose
//   (`refs.history`/`refs.historyTransition`, reached via
//   `this.refs.view.refs...`) are now accepted directly as props by the
//   ported `MarketHistoryView` - see that file's header comment -
//   avoiding the double ref-indirection a functional child can't provide
//   anyway.
// - `componentDidUpdate(prevState) { ... if (prevState.showAll !=
//   showAll) ... }` has a genuine pre-existing bug, preserved exactly:
//   React always passes `componentDidUpdate(prevProps, prevState, ...)`
//   - the single parameter here is actually `prevProps`, mislabeled
//   `prevState`. Since nothing passes a `showAll` *prop* to this
//   component, `prevState.showAll` here is always `undefined`, and
//   `undefined != <any boolean>` is always `true` in JS - so this "did
//   showAll change" check is not actually a change check at all; it
//   fires its `updateContainer` branch on *every* update, unconditionally.
//   Replicated with a no-dependency-array effect (runs after every
//   render, mount excluded, matching `componentDidUpdate`'s own timing)
//   that always executes the branch, using the same current
//   `showAll`/`hideScrollbars` values the original always ended up
//   reading from `this.state`/`this.props` regardless of what the
//   (effectively inert) comparison found.
// - `UNSAFE_componentWillReceiveProps`'s three independent checks
//   (`activeTab` prop change -> `changeTab`; `baseSymbol`/`quoteSymbol`
//   change -> reset `showAll` + reinit the scroll container;
//   `hideScrollbars` change -> reinit the scroll container) become three
//   separate effects, each guarded to skip its first (mount) run and
//   keyed on exactly the prop(s) its own condition checked.
// - `shouldComponentUpdate` is a third confirmed-real (non-no-op) SCU
//   gate in this migration: it checks a specific subset of props
//   (`history` via `Immutable.is`, `baseSymbol`, `quoteSymbol`,
//   `className`, `activeTab`, `currentAccount`, `isPanelActive`,
//   `hideScrollbars`) plus state - deliberately *not* every prop `render()`
//   reads (`myHistory`/`base`/`quote`/`isNullAccount`/`innerClass`/
//   `innerStyle`/`noHeader`/`headerStyle`/`tinyScreen` are all read in
//   render but absent from the gate). Preserved via a `React.memo`
//   comparator replicating exactly the checked-props subset; the
//   state-comparison half needs no replication, since a functional
//   component's own `useState` updates always trigger its re-render
//   regardless of `React.memo`, which only gates parent-triggered
//   re-renders.
import * as React from "react";
import Immutable from "immutable";
import Ps from "perfect-scrollbar";
import SettingsActions from "actions/SettingsActions";
import SettingsStore from "stores/SettingsStore";
import {ChainTypes as grapheneChainTypes} from "bitsharesjs";
const {operations} = (grapheneChainTypes as any);
import ReactTooltip from "react-tooltip";
import {FillOrder} from "common/MarketClasses";
import {MarketHistoryView, MarketHistoryViewRow} from "./View/MarketHistoryView";
import {useAltStore} from "../../next/hooks/useAltStore";

interface MarketHistoryProps {
    history?: any;
    myHistory?: any;
    base: any;
    quote: any;
    baseSymbol?: string;
    quoteSymbol?: string;
    isNullAccount?: boolean;
    activeTab?: string;
    className?: string;
    innerClass?: string;
    innerStyle?: any;
    noHeader?: boolean;
    headerStyle?: any;
    tinyScreen?: boolean;
    currentAccount?: any;
    isPanelActive?: boolean;
    hideScrollbars?: boolean;
}

function MarketHistoryInner(props: MarketHistoryProps) {
    const {
        history = [],
        myHistory,
        base,
        quote,
        baseSymbol,
        quoteSymbol,
        isNullAccount,
        className,
        innerClass,
        innerStyle,
        noHeader,
        headerStyle,
        tinyScreen,
        hideScrollbars
    } = props;
    let {activeTab} = props;

    const settingsState = useAltStore<any>(SettingsStore);
    const viewSettings = settingsState.viewSettings;

    const rowCount = 20;
    // Mirrors props.activeTab, matching the original's this.state.activeTab -
    // written by changeTab() below but never read by render(), which always
    // uses props.activeTab directly. Kept anyway: the setState call itself
    // forces a re-render, an observable effect independent of the value.
    const [, setActiveTabState] = React.useState(() =>
        viewSettings.get("historyTab", "history")
    );
    const [showAll, setShowAll] = React.useState(false);

    const historyContainerRef = React.useRef<any>(null);
    const historyTransitionRef = React.useRef<any>(null);

    function updateContainer(type = 2) {
        const containerNode = historyContainerRef.current;
        const containerTransition = historyTransitionRef.current;

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
            historyTab: tab
        });
        setActiveTabState(tab);

        // Ensure that focus goes back to top of scrollable container when tab is changed
        updateContainer(3);

        setTimeout((ReactTooltip as any).rebuild, 1000);
    }

    React.useEffect(() => {
        if (!hideScrollbars) {
            updateContainer(1);
        }
        // eslint-disable-next-line
    }, []);

    const isFirstActiveTabEffect = React.useRef(true);
    React.useEffect(() => {
        if (isFirstActiveTabEffect.current) {
            isFirstActiveTabEffect.current = false;
            return;
        }
        changeTab(activeTab);
        // eslint-disable-next-line
    }, [activeTab]);

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

    let historyRows: any = null;

    if (isNullAccount) {
        activeTab = "history";
    }

    if (activeTab === "my_history" && myHistory && myHistory.size) {
        // User History

        const assets = {
            [quote.get("id")]: {
                precision: quote.get("precision")
            },
            [base.get("id")]: {
                precision: base.get("precision")
            }
        };

        historyRows = myHistory
            .filter((a: any) => {
                const opType = a.getIn(["op", 0]);
                return opType === operations.fill_order;
            })
            .filter((a: any) => {
                const quoteID = quote.get("id");
                const baseID = base.get("id");
                const pays = a.getIn(["op", 1, "pays", "asset_id"]);
                const receives = a.getIn(["op", 1, "receives", "asset_id"]);
                const hasQuote = quoteID === pays || quoteID === receives;
                const hasBase = baseID === pays || baseID === receives;
                return hasQuote && hasBase;
            })
            .sort((a: any, b: any) => {
                return b.get("block_num") - a.get("block_num");
            })
            .map((trx: any) => {
                const fill = new (FillOrder as any)(
                    trx.toJS(),
                    assets,
                    quote.get("id")
                );

                return (
                    <MarketHistoryViewRow
                        key={fill.id}
                        fill={fill}
                        base={base}
                        quote={quote}
                    />
                );
            })
            .toArray();
    } else if (history && history.size) {
        // Market History
        historyRows = history
            .take(100)
            .map((fill: any) => {
                return (
                    <MarketHistoryViewRow
                        key={fill.id}
                        fill={fill}
                        base={base}
                        quote={quote}
                    />
                );
            })
            .toArray();
    }

    const totalRows = historyRows ? historyRows.length : null;
    if (!showAll && historyRows) {
        historyRows.splice(rowCount, historyRows.length);
    }

    return (
        <MarketHistoryView
            historyContainerRef={historyContainerRef}
            historyTransitionRef={historyTransitionRef}
            className={className}
            innerClass={innerClass}
            innerStyle={innerStyle}
            noHeader={noHeader}
            headerStyle={headerStyle}
            activeTab={activeTab}
            quoteSymbol={quoteSymbol}
            baseSymbol={baseSymbol}
            tinyScreen={tinyScreen}
            historyRows={historyRows}
            totalRows={totalRows}
            showAll={showAll}
            onSetShowAll={onSetShowAll}
        />
    );
}

function arePropsEqual(
    prevProps: MarketHistoryProps,
    nextProps: MarketHistoryProps
) {
    return (
        Immutable.is(nextProps.history, prevProps.history) &&
        nextProps.baseSymbol === prevProps.baseSymbol &&
        nextProps.quoteSymbol === prevProps.quoteSymbol &&
        nextProps.className === prevProps.className &&
        nextProps.activeTab === prevProps.activeTab &&
        nextProps.currentAccount === prevProps.currentAccount &&
        nextProps.isPanelActive === prevProps.isPanelActive &&
        nextProps.hideScrollbars === prevProps.hideScrollbars
    );
}

const MarketHistory = React.memo(MarketHistoryInner, arePropsEqual);

export default MarketHistory;
