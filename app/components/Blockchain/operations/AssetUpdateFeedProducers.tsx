// TypeScript port of the legacy AssetUpdateFeedProducers.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface AssetUpdateFeedProducersProps {
    op: any;
    changeColor: (color: string) => void;
    fromComponent?: string;
}

export const AssetUpdateFeedProducers = ({
    op,
    changeColor,
    fromComponent
}: AssetUpdateFeedProducersProps) => {
    changeColor("warning");

    if (fromComponent === "proposed_operation") {
        return (
            <TranslateWithLinks
                string="proposal.feed_producer"
                keys={[
                    {
                        type: "account",
                        value: op[1].issuer,
                        arg: "account"
                    },
                    {
                        type: "asset",
                        value: op[1].asset_to_update,
                        arg: "asset"
                    }
                ]}
            />
        );
    } else {
        return (
            <span>
                <TranslateWithLinks
                    string="operation.asset_update_feed_producers"
                    keys={[
                        {
                            type: "account",
                            value: op[1].issuer,
                            arg: "account"
                        },
                        {
                            type: "asset",
                            value: op[1].asset_to_update,
                            arg: "asset"
                        }
                    ]}
                />
            </span>
        );
    }
};
