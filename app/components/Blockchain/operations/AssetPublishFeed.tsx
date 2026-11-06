// TypeScript port of the legacy AssetPublishFeed.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import FormattedPrice from "../../Utility/FormattedPrice";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface AssetPublishFeedProps {
    op: any;
    changeColor: (color: string) => void;
    linkToAccount: (nameOrId: any) => React.ReactNode;
    fromComponent?: string;
}

export const AssetPublishFeed = ({
    op,
    changeColor,
    linkToAccount,
    fromComponent
}: AssetPublishFeedProps) => {
    changeColor("warning");
    if (fromComponent === "proposed_operation") {
        return (
            <span>
                {linkToAccount(op[1].publisher)}
                &nbsp;
                <Translate component="span" content="proposal.publish_feed" />
                &nbsp;
                <FormattedPrice
                    base_asset={op[1].feed.settlement_price.base.asset_id}
                    quote_asset={op[1].feed.settlement_price.quote.asset_id}
                    base_amount={op[1].feed.settlement_price.base.amount}
                    quote_amount={op[1].feed.settlement_price.quote.amount}
                />
            </span>
        );
    } else {
        return (
            <span>
                <TranslateWithLinks
                    string="operation.publish_feed"
                    keys={[
                        {
                            type: "account",
                            value: op[1].publisher,
                            arg: "account"
                        },
                        {
                            type: "price",
                            value: op[1].feed.settlement_price,
                            arg: "price"
                        }
                    ]}
                />
            </span>
        );
    }
};
