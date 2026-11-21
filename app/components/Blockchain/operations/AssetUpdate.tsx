// TypeScript port of the legacy AssetUpdate.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface AssetUpdateProps {
    op: any;
    changeColor: (color: string) => void;
    fromComponent?: string;
}

export const AssetUpdate = ({
    op,
    changeColor,
    fromComponent
}: AssetUpdateProps) => {
    changeColor("warning");

    return (
        <TranslateWithLinks
            string={
                fromComponent === "proposed_operation"
                    ? "proposal.asset_update"
                    : "operation.asset_update"
            }
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
};
