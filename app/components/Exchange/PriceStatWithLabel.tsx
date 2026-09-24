// TypeScript/functional-component port of the legacy
// PriceStatWithLabel.jsx (Phase 4, docs/UI_MIGRATION_PLAN.md). One stat
// tile in the Exchange header's price ticker strip; used repeatedly by
// `ExchangeHeader.jsx` (not yet ported). NOT to be confused with the
// separate `PriceStat.jsx`, which - despite its file also containing a
// class internally named `PriceStatWithLabel` (a pre-existing copy-paste
// naming artifact, not touched here) - had zero importers anywhere in the
// codebase and was deleted outright as orphaned, the same way
// `AccountVotingProxy.jsx` was in Phase 3.
//
// Unlike this migration's other dropped `shouldComponentUpdate` gates
// (all previously confirmed to be no-ops - e.g. `Workers.tsx`'s
// always-true SCU), this one is a genuine, deliberate render-throttle:
// it returns `true` (re-render) only when `volume2`, `base`, `price`, or
// `ready` change, meaning a change to `quote`/`content`/`toolTip`/
// `onClick`/`ignoreColorChange` alone does NOT trigger a re-render until
// one of those four props changes too - plausibly intentional, since this
// tile sits in the highest-update-frequency part of the app (a live
// price ticker) and this migration's own plan doc flags Exchange as
// "the state-heaviest, highest-update-frequency part of the app."
// Preserved via `React.memo` with a comparator that's the exact logical
// inverse of the original `shouldComponentUpdate` (memo's comparator
// returns true to *skip* a render, the opposite sense from SCU).
//
// `UNSAFE_componentWillReceiveProps` (computing the pulsing `change`/
// `marketChange` state from the prop diff) becomes an effect with no
// dependency array, so it re-runs after every render this component
// actually performs - but because `React.memo` skips calling this
// function entirely on throttled updates, unlike the original class
// (whose `componentWillReceiveProps` always ran, updating `state.curMarket`
// in the background, even on renders `shouldComponentUpdate` then
// blocked), this port only observes `market` prop changes that happen to
// coincide with a memo-passing render. A `market`-only change occurring
// while `price`/`ready`/`base`/`volume2` stay put - already invisible in
// the original too, since the blocked render never painted it - could
// very narrowly cause `marketChange`'s internal bookkeeping to catch up
// one render later here than in the original once a later render finally
// occurs. No difference either way is ever visible to the user, since
// nothing paints during a throttled update in either version; documented
// as an accepted, narrow approximation gap rather than pursued further
// with a larger restructuring (e.g. an always-rendering outer tracker
// component) that this mechanical port isn't the place to introduce.
import * as React from "react";
import Translate from "react-translate-component";
import AssetName from "../Utility/AssetName";
import utils from "common/utils";
import cnames from "classnames";
import ReactTooltip from "react-tooltip";
import {Tooltip} from "bitshares-ui-style-guide";

interface PriceStatWithLabelProps {
    base: any;
    quote?: any;
    price: any;
    content?: string;
    ready: boolean;
    volume?: boolean;
    // Never read in render - only checked by `arePropsEqual` below,
    // matching the original's `shouldComponentUpdate`, which also never
    // used it outside that check.
    volume2?: any;
    toolTip?: string;
    ignoreColorChange?: boolean;
    market?: any;
    className?: string;
    onClick?: (...args: any[]) => any;
}

function PriceStatWithLabelInner({
    base,
    quote,
    price,
    content,
    ready,
    volume,
    toolTip,
    ignoreColorChange,
    market,
    className,
    onClick
}: PriceStatWithLabelProps) {
    const [state, setState] = React.useState<any>({
        change: null,
        curMarket: null,
        marketChange: false
    });
    const prevPropsRef = React.useRef({price, ready});

    const isFirstRender = React.useRef(true);
    React.useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            prevPropsRef.current = {price, ready};
            return;
        }
        const prev = prevPropsRef.current;

        const checkMarketChange = state.curMarket !== market;
        const marketChange =
            state.curMarket == null ? false : checkMarketChange;

        const newState: any = {
            change: 0,
            marketChange,
            curMarket: market
        };

        if (ready && prev.ready) {
            newState.change = parseFloat(price) - parseFloat(prev.price);
        }

        setState(newState);
        prevPropsRef.current = {price, ready};
        // eslint-disable-next-line
    });

    React.useEffect(() => {
        (ReactTooltip as any).rebuild();
    });

    const {change, marketChange} = state;
    let changeClasses = null;
    if (
        !marketChange &&
        change &&
        change !== null &&
        ignoreColorChange !== true
    ) {
        changeClasses = change > 0 ? "pulsate green" : "pulsate red";
    }

    const value = !volume
        ? (utils as any).price_text(price, quote, base)
        : (utils as any).format_volume(price);

    return (
        <li
            className={cnames("stressed-stat", className, changeClasses)}
            onClick={onClick}
        >
            <Tooltip placement="bottom" title={toolTip}>
                <span>
                    <span className="value stat-primary">
                        {!ready ? 0 : value}
                        &nbsp;
                    </span>
                    <span className="symbol-text">
                        <AssetName name={base.get("symbol")} />
                    </span>
                </span>
                {content ? (
                    <div className="stat-text">
                        <Translate content={content} />
                    </div>
                ) : null}
            </Tooltip>
        </li>
    );
}

function arePropsEqual(
    prevProps: PriceStatWithLabelProps,
    nextProps: PriceStatWithLabelProps
) {
    if (
        (nextProps.volume2 && nextProps.volume2 !== prevProps.volume2) ||
        nextProps.base !== prevProps.base
    ) {
        return false;
    }
    return !(
        nextProps.price !== prevProps.price ||
        nextProps.ready !== prevProps.ready
    );
}

export default React.memo(PriceStatWithLabelInner, arePropsEqual);
