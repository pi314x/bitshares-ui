// TypeScript/functional-component port of the legacy
// AccountOrderRowDescription.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import utils from "common/utils";
import AssetName from "../Utility/AssetName";

interface AccountOrderRowDescriptionProps {
    base: any;
    quote: any;
    order: any;
}

function AccountOrderRowDescription({
    base,
    quote,
    order
}: AccountOrderRowDescriptionProps) {
    const isBid = order.isBid();

    const quoteColor = !isBid ? "value negative" : "value positive";
    const baseColor = isBid ? "value negative" : "value positive";

    return (
        <Translate
            content={
                isBid ? "exchange.buy_description" : "exchange.sell_description"
            }
            baseAsset={utils.format_number(
                order[isBid ? "amountToReceive" : "amountForSale"]().getAmount({
                    real: true
                }),
                base.get("precision"),
                false
            )}
            quoteAsset={utils.format_number(
                order[isBid ? "amountForSale" : "amountToReceive"]().getAmount({
                    real: true
                }),
                quote.get("precision"),
                false
            )}
            baseName={
                <AssetName noTip customClass={quoteColor} name={quote.get("symbol")} />
            }
            quoteName={
                <AssetName noTip customClass={baseColor} name={base.get("symbol")} />
            }
        />
    );
}

export default AccountOrderRowDescription;
