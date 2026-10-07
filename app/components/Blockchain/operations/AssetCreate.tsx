// TypeScript port of the legacy AssetCreate.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface AssetCreateProps {
    op: any;
    changeColor: (color: string) => void;
    fromComponent?: string;
}

export const AssetCreate = ({
    op,
    changeColor,
    fromComponent
}: AssetCreateProps) => {
    changeColor("warning");
    if (fromComponent === "proposed_operation") {
        return (
            <TranslateWithLinks
                string="proposal.asset_create"
                keys={[
                    {
                        type: "account",
                        value: op[1].issuer,
                        arg: "account"
                    }
                ]}
                params={{
                    asset: op[1].symbol
                }}
            />
        );
    } else {
        return (
            <span>
                <TranslateWithLinks
                    string="operation.asset_create"
                    keys={[
                        {
                            type: "account",
                            value: op[1].issuer,
                            arg: "account"
                        },
                        {
                            type: "asset",
                            value: op[1].symbol,
                            arg: "asset"
                        }
                    ]}
                />
            </span>
        );
    }
};
