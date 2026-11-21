// TypeScript port of the legacy AssetGlobalSettle.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import FormattedPrice from "../../Utility/FormattedPrice";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface AssetGlobalSettleProps {
    op: any;
    changeColor: (color: string) => void;
    linkToAsset: (symbolOrId: any) => React.ReactNode;
    fromComponent?: string;
}

export const AssetGlobalSettle = ({
    op,
    changeColor,
    linkToAsset,
    fromComponent
}: AssetGlobalSettleProps) => {
    changeColor("warning");
    if (fromComponent === "proposed_operation") {
        return (
            <span>
                <Translate
                    component="span"
                    content="proposal.asset_global_settle"
                />
                &nbsp;
                {linkToAsset(op[1].asset_to_settle)}
                &nbsp;
                <Translate component="span" content="proposal.at" />
                &nbsp;
                <FormattedPrice
                    style={{fontWeight: "bold"}}
                    quote_amount={op[1].settle_price.quote.amount}
                    quote_asset={op[1].settle_price.quote.asset_id}
                    base_asset={op[1].settle_price.base.asset_id}
                    base_amount={op[1].settle_price.base.amount}
                />
            </span>
        );
    } else {
        return (
            <span>
                <TranslateWithLinks
                    string="operation.asset_global_settle"
                    keys={[
                        {
                            type: "account",
                            value: op[1].issuer,
                            arg: "account"
                        },
                        {
                            type: "asset",
                            value: op[1].asset_to_settle,
                            arg: "asset"
                        },
                        {
                            type: "price",
                            value: op[1].settle_price,
                            arg: "price"
                        }
                    ]}
                />
            </span>
        );
    }
};
