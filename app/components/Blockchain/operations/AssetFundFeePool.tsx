// TypeScript port of the legacy AssetFundFeePool.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import {ChainStore} from "bitsharesjs";
import FormattedAsset from "../../Utility/FormattedAsset";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface AssetFundFeePoolProps {
    op: any;
    changeColor: (color: string) => void;
    linkToAccount: (nameOrId: any) => React.ReactNode;
    fromComponent?: string;
}

export const AssetFundFeePool = ({
    op,
    changeColor,
    linkToAccount,
    fromComponent
}: AssetFundFeePoolProps) => {
    changeColor("warning");
    if (fromComponent === "proposed_operation") {
        let asset: any = ChainStore.getAsset(op[1].asset_id);
        if (asset) asset = asset.get("symbol");
        else asset = op[1].asset_id;
        return (
            <span>
                {linkToAccount(op[1].from_account)} &nbsp;
                <Translate
                    component="span"
                    content="proposal.fund_pool"
                    asset={asset}
                />
                &nbsp;
                <FormattedAsset
                    style={{fontWeight: "bold"}}
                    amount={op[1].amount}
                    asset="1.3.0"
                />
            </span>
        );
    } else {
        return (
            <span>
                <TranslateWithLinks
                    string="operation.asset_fund_fee_pool"
                    keys={[
                        {
                            type: "account",
                            value: op[1].from_account,
                            arg: "account"
                        },
                        {
                            type: "asset",
                            value: op[1].asset_id,
                            arg: "asset"
                        },
                        {
                            type: "amount",
                            value: {
                                amount: op[1].amount,
                                asset_id: "1.3.0"
                            },
                            arg: "amount"
                        }
                    ]}
                />
            </span>
        );
    }
};
