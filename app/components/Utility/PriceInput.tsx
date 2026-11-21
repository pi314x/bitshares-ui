// TypeScript/functional-component port of the legacy PriceInput.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `AssetWrapper(Component)` HOC usage kept as-is (shared HOC, out of
// scope).
//
// Preserved verbatim (not "fixed"): the constructor computed its initial
// `price`/`realPriceValue` state once from the *initial* `quote`/`base`
// props and never recomputed it on later prop changes (no
// `componentWillReceiveProps`) - replicated with a `useState` lazy
// initializer (runs once, matching constructor timing). Also preserved:
// `onPriceChanged` mutates the `price` object in `state` directly
// (`state.price.setPriceFromReal(...)`) rather than creating a new one,
// then triggers a re-render via a *partial* state update for
// `realPriceValue` only - replicated with a manual `{...prev, ...}`
// merge, since hooks' `setState` (unlike class `setState`) doesn't
// auto-merge.
import * as React from "react";
import AmountSelector from "./AmountSelector";
import {Price, Asset} from "common/MarketClasses";
import AssetWrapper from "../Utility/AssetWrapper";

interface PriceInputProps {
    quote: any;
    base: any;
    label?: string;
    onPriceChanged?: (price: any) => void;
}

function PriceInput({quote, base, label, onPriceChanged}: PriceInputProps) {
    const [state, setState] = React.useState(() => {
        const quoteAsset = new (Asset as any)({
            amount: 0,
            asset_id: quote.get("id"),
            precision: quote.get("precision")
        });
        const baseAsset = new (Asset as any)({
            amount: 0,
            asset_id: base.get("id"),
            precision: base.get("precision")
        });

        const price = new (Price as any)({
            quote: quoteAsset,
            base: baseAsset
        });

        return {
            price,
            realPriceValue: price.toReal()
        };
    });

    const onChanged = ({amount}: {amount: any}) => {
        state.price.setPriceFromReal(parseFloat(amount));
        setState(prev => ({...prev, realPriceValue: amount}));

        if (onPriceChanged) onPriceChanged(state.price.clone());
    };

    const {realPriceValue, price} = state;

    return (
        <AmountSelector
            label={label}
            amount={realPriceValue}
            onChange={onChanged}
            asset={price.base.asset_id}
            base={quote.get("symbol")}
            isPrice
            assets={[price.quote.asset_id]}
            placeholder="0.0"
            tabIndex={1}
            style={{
                width: "100%",
                paddingRight: "10px"
            }}
        />
    );
}

export default AssetWrapper(PriceInput, {
    propNames: ["quote", "base"],
    defaultProps: {
        base: "1.3.0"
    }
});
