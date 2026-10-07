// TypeScript port of the legacy EquivalentPrice.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes, EXCEPT one
// deliberate deviation from this migration's usual "convert to a
// function component" rule, matching the precedent already set by
// `MarketStatsCheck.tsx` (`Utility/` batch 11) - see that file's own
// header comment for the full reasoning, summarized here:
//
// `class EquivalentPrice extends MarketStatsCheck` genuinely relies on
// *inheriting* `MarketStatsCheck`'s React lifecycle methods
// (`UNSAFE_componentWillMount`/`UNSAFE_componentWillReceiveProps`/
// `componentWillUnmount`, which start/stop live
// `MarketsActions.getMarketStatsInterval(...)` subscriptions) and calls
// `super.shouldComponentUpdate(np)` directly. `MarketStatsCheck.tsx` was
// deliberately kept as an ES6 class (not converted to a hook-based
// mixin) specifically so this `extends` chain keeps working; converting
// *this* file to a function component would have the same effect as
// converting the base class would have - the inherited lifecycle methods
// would silently stop being invoked by React, killing the live
// market-stats subscriptions this component's siblings/parents rely on,
// with no compile-time or test signal. So `EquivalentPrice` itself also
// stays an ES6 class here - typed, mechanically cleaned up, no logic
// changes - completing the chain `MarketStatsCheck.tsx` already started.
//
// Not otherwise security-sensitive per AGENTS.md: grepped for `WalletDb`,
// `WalletApi`, `.add_type_operation`, `process_transaction` - none
// appear. This component only displays a computed price, no transaction
// is built here.
//
// The outer `EquivalentPriceWrapper` (an `AltContainer` wrapping
// `EquivalentPrice`, deriving `toAsset`/`allMarketStats` from
// `SettingsStore`/`MarketsStore`) IS converted to a function component,
// using `useAltStore(SettingsStore)`/`useAltStore(MarketsStore)` - this
// outer layer has no lifecycle/inheritance of its own, so the usual
// Container+Core translation applies cleanly. Store-derived props are
// spread after the passed-in `{...props}`, matching alt-container's own
// precedence (store-derived wins) - `toAsset`'s `this.props.toAsset ||
// SettingsStore...` fallback is preserved by computing it the same way
// (explicit prop wins over the store default) and placing the result in
// the post-passed-in-props spread position, same net effect as the
// original's own `||`.
import * as React from "react";
import utils from "common/utils";
import SettingsStore from "stores/SettingsStore";
import FormattedPrice from "./FormattedPrice";
import MarketStatsCheck from "./MarketStatsCheck";
import MarketsStore from "stores/MarketsStore";
import MarketUtils from "common/market_utils";
import AssetWrapper from "./AssetWrapper";
import {ChainStore} from "bitsharesjs";
import {useAltStore} from "../../next/hooks/useAltStore";

const getFinalPrice = function(
    fromAsset: any,
    toAsset: any,
    coreAsset: any = null,
    allMarketStats: any = null,
    real = false
) {
    try {
        return (MarketUtils as any).getFinalPrice(
            coreAsset ? coreAsset : (ChainStore as any).getAsset("1.3.0"),
            fromAsset,
            toAsset ? toAsset : (ChainStore as any).getAsset("1.3.0"),
            allMarketStats
                ? allMarketStats
                : (MarketsStore.getState() as any).allMarketStats,
            real
        );
    } catch (err) {
        console.log(err);
    }
};

class EquivalentPrice extends MarketStatsCheck {
    static defaultProps = {
        forceDirection: true
    };

    shouldComponentUpdate(np: any, nextState?: any): boolean {
        return (
            super.shouldComponentUpdate(np) ||
            np.base_amount !== this.props.base_amount ||
            np.quote_amount !== this.props.quote_amount ||
            np.decimals !== this.props.decimals ||
            !(utils as any).are_equal_shallow(np.pulsate, this.props.pulsate) ||
            !(utils as any).are_equal_shallow(nextState, this.state)
        );
    }

    render() {
        const {
            coreAsset,
            fromAsset,
            toAsset,
            allMarketStats,
            forceDirection,
            ...others
        } = this.props as any;

        const finalPrice = getFinalPrice(
            toAsset,
            fromAsset,
            coreAsset,
            allMarketStats
        );

        if (finalPrice === 1) {
            return <span>1.00</span>;
        }

        if (!finalPrice) return <span>--</span>;

        return (
            <FormattedPrice
                force_direction={forceDirection ? toAsset.get("symbol") : false}
                base_amount={finalPrice.base.amount}
                base_asset={finalPrice.base.asset_id}
                quote_amount={finalPrice.quote.amount}
                quote_asset={finalPrice.quote.asset_id}
                {...others}
            />
        );
    }
}

const WrappedEquivalentPrice = AssetWrapper(EquivalentPrice as any, {
    propNames: ["toAsset", "fromAsset", "coreAsset"],
    defaultProps: {
        toAsset: "1.3.0",
        coreAsset: "1.3.0"
    }
});

interface EquivalentPriceWrapperProps {
    toAsset?: any;
    refCallback?: (ref: any) => void;
    [key: string]: any;
}

function EquivalentPriceWrapper(props: EquivalentPriceWrapperProps) {
    const settingsState = useAltStore<any>(SettingsStore);
    const marketsState = useAltStore<any>(MarketsStore);

    const toAsset =
        props.toAsset || settingsState.settings.get("unit", "1.3.0");
    const allMarketStats = marketsState.allMarketStats;

    return (
        <WrappedEquivalentPrice
            {...props}
            toAsset={toAsset}
            allMarketStats={allMarketStats}
            ref={props.refCallback}
        />
    );
}

export default EquivalentPriceWrapper;
export {getFinalPrice};
