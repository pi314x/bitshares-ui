// TypeScript/functional-component port of the legacy PriceText.jsx (Phase
// 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import utils from "common/utils";

interface PriceTextProps {
    price?: any;
    preFormattedPrice?: any;
    quote?: any;
    base?: any;
}

function PriceText({price, preFormattedPrice, quote, base}: PriceTextProps) {
    if (!price && !preFormattedPrice) return null;
    const formattedPrice = preFormattedPrice
        ? preFormattedPrice
        : utils.price_to_text(price, quote, base);

    if (formattedPrice.full >= 1) {
        return (
            <span>
                <span className="price-integer">{formattedPrice.int}.</span>
                {formattedPrice.dec ? (
                    <span className="price-integer">{formattedPrice.dec}</span>
                ) : null}
                {formattedPrice.trailing ? (
                    <span className="price-decimal">
                        {formattedPrice.trailing}
                    </span>
                ) : null}
            </span>
        );
    } else if (formattedPrice.full >= 0.1) {
        return (
            <span>
                <span className="price-decimal">{formattedPrice.int}.</span>
                {formattedPrice.dec ? (
                    <span className="price-integer">{formattedPrice.dec}</span>
                ) : null}
                {formattedPrice.trailing ? (
                    <span className="price-decimal">
                        {formattedPrice.trailing}
                    </span>
                ) : null}
            </span>
        );
    } else {
        return (
            <span>
                <span className="price-decimal">{formattedPrice.int}.</span>
                {formattedPrice.dec ? (
                    <span className="price-decimal">{formattedPrice.dec}</span>
                ) : null}
                {formattedPrice.trailing ? (
                    <span className="price-integer">
                        {formattedPrice.trailing}
                    </span>
                ) : null}
            </span>
        );
    }
}

export default PriceText;
