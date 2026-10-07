// TypeScript/functional-component port of the legacy
// MarketChangeComponent.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md,
// `Utility/` batch 11). Mechanical, no logic changes to the rendered
// output.
//
// The original's `class MarketChangeComponent extends MarketStats`
// (`MarketStats` was `Utility/MarketPrice.jsx`'s now-retired base class)
// inherited a frozen-at-mount `marketName` plus a `shouldComponentUpdate`
// override combining `super.shouldComponentUpdate(np)` (a `_checkStats`
// comparison keyed on that `marketName`) with `np.base !== this.props
// .base`. Read `render()`/`getValue()` closely: neither `this.state
// .marketName` nor `this.props.base`/`this.props.quote` (the two assets
// `AssetWrapper` resolves for this component) is ever referenced outside
// `shouldComponentUpdate` - the component only ever reads `this.props
// .marketStats`. So the entire inherited `MarketStats` machinery was
// *only* a pure re-render perf guard with nothing else depending on it
// (no `componentDidUpdate` gated by it) - dropped entirely per this
// migration's established treatment of pure perf guards, which also
// means this file no longer needs any shared base with `MarketPrice.tsx`
// at all.
// `componentWillUnmount` (inherited from `MarketStats`,
// `if (this.statsInterval) this.statsInterval()`) is confirmed dead the
// same way documented in `MarketPrice.tsx`'s header comment
// (`statsInterval` is only ever assigned `null`, never reassigned,
// anywhere in either file) - dropped.
//
// Preserved verbatim (not "fixed"): `fullPrecision`/`noDecimals`/
// `hide_asset` are declared in `static defaultProps` but read nowhere in
// `render()`/`getValue()` - already-dead props before this migration
// touched the file (confirmed by reading the class in full) - kept as
// real, unused optional fields on the new props interface so existing
// callers passing them (if any) keep type-checking/compiling.
//
// Dropped as confirmed dead (grepped `refCallback` across `app/`): the
// `Market24HourChangeComponent` class's `let {refCallback, ...others} =
// this.props; return <MarketChangeComponent {...others} ref={refCallback} />`
// - the only in-scope JSX caller (`Account/AccountPortfolioList.tsx`)
// never passes a `refCallback` prop, and a plain function component
// couldn't forward it as a real DOM/instance ref via `ref=` without
// `forwardRef` anyway (which nothing requires here) - so `refCallback` is
// no longer destructured/forwarded at all.
//
// Structural change (same substitution used throughout this migration):
// `connect(Market24HourChangeComponent, {listenTo: [MarketsStore],
// getProps})` is replaced by `useAltStore(MarketsStore)`.
// `AssetWrapper(MarketChangeComponent, {propNames: ["quote", "base"],
// defaultProps: {quote: "1.3.0"}})` wrapping is kept exactly as-is around
// the inner component (shared HOC, ported in this same batch - see
// `AssetWrapper.tsx`'s own header comment) - even though its resolved
// `quote`/`base` props are never read by `render()` (see above), keeping
// the wrap unchanged preserves its other real effect: blocking the whole
// subtree from rendering until both referenced assets are resolved in
// `ChainStore`, exactly as before.
import * as React from "react";
import {FormattedNumber} from "react-intl";
import AssetWrapper from "./AssetWrapper";
import MarketsStore from "stores/MarketsStore";
import {useAltStore} from "../../next/hooks/useAltStore";

/**
 *  Displays change in market value for an asset
 *
 *  Expects three properties
 *  -'quote' which should be a asset id
 *  -'base' which is the asset id of the original asset amount
 */

interface MarketChangeComponentInnerProps {
    marketStats?: any;
    fullPrecision?: boolean;
    noDecimals?: boolean;
    hide_asset?: boolean;
    [key: string]: any;
}

function MarketChangeComponentInner({
    marketStats
}: MarketChangeComponentInnerProps) {
    const marketChangeValue =
        marketStats && marketStats.change ? marketStats.change : 0;
    const parsedValue = parseFloat(marketChangeValue);
    const dayChangeClass =
        parsedValue === 0 ? "" : parsedValue < 0 ? "change-down" : "change-up";

    // this is treating a sympton when MarketStore does not provide a proper value! #2511
    if (!isNaN(parsedValue)) {
        return (
            <span className={"value " + dayChangeClass}>
                <FormattedNumber
                    style="decimal"
                    value={marketChangeValue}
                    minimumFractionDigits={2}
                    maximumFractionDigits={2}
                />
                %
            </span>
        );
    } else {
        return <span className={"value " + dayChangeClass}>-</span>;
    }
}

const WrappedMarketChangeComponent: React.ComponentType<any> = AssetWrapper(
    MarketChangeComponentInner,
    {
        propNames: ["quote", "base"],
        defaultProps: {quote: "1.3.0"}
    }
);

interface Market24HourChangeComponentProps {
    marketId?: any;
    [key: string]: any;
}

function Market24HourChangeComponent({
    marketId,
    ...others
}: Market24HourChangeComponentProps) {
    const marketsState = useAltStore<any>(MarketsStore as any);
    const allMarketStats = marketsState.allMarketStats;
    const marketStats = allMarketStats.get(marketId);

    return (
        <WrappedMarketChangeComponent
            {...others}
            marketStats={marketStats}
            allMarketStats={allMarketStats}
        />
    );
}

export {Market24HourChangeComponent};
