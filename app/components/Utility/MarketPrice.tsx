// TypeScript/functional-component port of the legacy MarketPrice.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md, `Utility/` batch 11). Mechanical,
// no logic changes to the rendered output.
//
// Dropped export: the original also exported a `MarketStats` base class
// (`class MarketStats extends React.Component`, providing a frozen-at-
// mount `marketName` plus a `shouldComponentUpdate` re-render guard) for
// `MarketChangeComponent.jsx`'s `class MarketChangeComponent extends
// MarketStats` to extend. Grepped the whole app for `extends MarketStats`:
// its only two users are `MarketPriceInner` (this same file) and
// `MarketChangeComponent` (`Utility/MarketChangeComponent.jsx`, ported in
// this same batch) - no out-of-scope file extends it, so (unlike
// `MarketStatsCheck`, see that file's header comment) it was safe to
// retire entirely rather than keep as a class. `MarketChangeComponent
// .tsx`'s header comment explains why it no longer needs any of
// `MarketStats`'s logic at all (its `shouldComponentUpdate` override was
// a pure re-render perf guard that never actually read anything
// `MarketStats` computed).
//
// `MarketPriceInner`'s own inherited pieces:
// - `shouldComponentUpdate` (`_checkStats` comparison plus a `base`/
//   `quote` id check) is a pure re-render perf guard - nothing here has
//   a `componentDidUpdate`/other side effect gated by it - dropped
//   entirely per this migration's established treatment of pure perf
//   guards.
// - `componentWillUnmount`'s `if (this.statsInterval) this.statsInterval()`
//   is confirmed dead: `this.statsInterval` is only ever assigned `null`
//   in the constructor and never reassigned anywhere in this file or
//   `MarketChangeComponent.jsx` (grepped `statsInterval` across `app/`) -
//   dropped, nothing to clean up.
// - The constructor's `marketName` computation
//   (`marketUtils.getMarketName(props.base, props.quote).marketName`)
//   runs once and is never recomputed on later prop changes (no
//   `componentWillReceiveProps` override) - preserved verbatim (not
//   "fixed") via a `useState` lazy initializer, matching the same
//   "freeze the derived value at mount" precedent already established
//   for `Utility/PriceInput.tsx`/`Utility/FormattedTime.tsx`.
//
// Structural change (same substitution used throughout this migration):
// `connect(MarketPrice, {listenTo: [MarketsStore], getProps})` is
// replaced by `useAltStore(MarketsStore)`. `AssetWrapper(MarketPriceInner,
// {propNames: ["quote", "base"]})` wrapping is kept exactly as-is around
// the inner component (shared HOC, ported in this same batch - see
// `AssetWrapper.tsx`'s own header comment), so `base`/`quote` are already
// resolved chain `Asset` objects by the time `MarketPriceInner` runs.
import * as React from "react";
import cnames from "classnames";
import MarketsStore from "stores/MarketsStore";
import marketUtils from "common/market_utils";
import FormattedPrice from "./FormattedPrice";
import AssetWrapper from "./AssetWrapper";
import {useAltStore} from "../../next/hooks/useAltStore";

interface MarketPriceInnerProps {
    base?: any;
    quote?: any;
    allMarketStats: any;
    className?: string;
    force_direction?: any;
    hide_symbols?: boolean;
    [key: string]: any;
}

function MarketPriceInner({
    base,
    quote,
    allMarketStats,
    className,
    force_direction,
    hide_symbols
}: MarketPriceInnerProps) {
    // Frozen at mount, not recomputed on later base/quote changes -
    // matches the original's constructor-only computation.
    const [marketName] = React.useState(
        () => marketUtils.getMarketName(base, quote).marketName
    );

    const marketStats = allMarketStats.get(marketName);
    const price = marketStats && marketStats.price ? marketStats.price : null;

    return (
        <span className={cnames("", className)}>
            {price ? (
                <FormattedPrice
                    base_amount={price.base.amount}
                    base_asset={price.base.asset_id}
                    quote_amount={price.quote.amount}
                    quote_asset={price.quote.asset_id}
                    force_direction={force_direction}
                    hide_symbols={hide_symbols}
                />
            ) : (
                "n/a"
            )}
        </span>
    );
}

const WrappedMarketPriceInner: React.ComponentType<any> = AssetWrapper(
    MarketPriceInner,
    {
        propNames: ["quote", "base"]
    }
);

interface MarketPriceProps {
    [key: string]: any;
}

function MarketPrice(props: MarketPriceProps) {
    const marketsState = useAltStore<any>(MarketsStore as any);

    return (
        <WrappedMarketPriceInner
            {...props}
            allMarketStats={marketsState.allMarketStats}
        />
    );
}

export {MarketPrice};
