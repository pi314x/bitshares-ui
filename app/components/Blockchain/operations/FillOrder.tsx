// TypeScript port of the legacy FillOrder.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes. The
// `BindToChainState.Wrapper` render-prop usage is kept exactly as-is
// (not part of this migration's BindToChainState-replacement scope).
//
// Preserved verbatim (not "fixed"): the `fromComponent ===
// "proposed_operation"` branch reads `op.account_id`/`op.pays`
// /`op.receives` directly (not `op[1].account_id`/etc, as every other
// branch and every other operation component does) - kept exactly as in
// the original.
/* eslint-disable react/display-name */
import * as React from "react";
import Translate from "react-translate-component";
import FormattedAsset from "../../Utility/FormattedAsset";
import FormattedPrice from "../../Utility/FormattedPrice";
import BindToChainState from "../../Utility/BindToChainState";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";
import marketUtils from "common/market_utils";

const BindToChainStateWrapper = (BindToChainState as any).Wrapper;

interface FillOrderProps {
    op: any;
    changeColor: (color: string) => void;
    linkToAccount: (nameOrId: any) => React.ReactNode;
    marketDirections: any;
    fromComponent?: string;
}

export const FillOrder = ({
    changeColor,
    op,
    linkToAccount,
    marketDirections,
    fromComponent
}: FillOrderProps) => {
    changeColor("success");
    const o = op[1];
    if (fromComponent === "proposed_operation") {
        return (
            <span>
                {linkToAccount((op as any).account_id)}
                &nbsp;
                <Translate component="span" content="proposal.paid" />
                &nbsp;
                <FormattedAsset
                    style={{fontWeight: "bold"}}
                    amount={(op as any).pays.amount}
                    asset={(op as any).pays.asset_id}
                />
                &nbsp;
                <Translate component="span" content="proposal.obtain" />
                &nbsp;
                <FormattedAsset
                    style={{fontWeight: "bold"}}
                    amount={(op as any).receives.amount}
                    asset={(op as any).receives.asset_id}
                />
                &nbsp;
                <Translate component="span" content="proposal.at" />
                &nbsp;
                <FormattedPrice
                    base_asset={o.pays.asset_id}
                    base_amount={o.pays.amount}
                    quote_asset={o.receives.asset_id}
                    quote_amount={o.receives.amount}
                />
            </span>
        );
    } else {
        return (
            <span>
                <BindToChainStateWrapper
                    base={o.receives.asset_id}
                    quote={o.pays.asset_id}
                >
                    {({base, quote}: any) => {
                        const {
                            marketName,
                            first,
                            second
                        } = (marketUtils as any).getMarketName(base, quote);
                        const inverted = marketDirections.get(marketName);
                        const isBid =
                            o.pays.asset_id ===
                            (inverted ? first.get("id") : second.get("id"));

                        const priceBase = isBid ? o.receives : o.pays;
                        const priceQuote = isBid ? o.pays : o.receives;
                        const amount = isBid ? o.receives : o.pays;
                        const receivedAmount =
                            o.fee.asset_id === amount.asset_id
                                ? amount.amount - o.fee.amount
                                : amount.amount;

                        return (
                            <TranslateWithLinks
                                string={`operation.fill_order_${
                                    isBid ? "buy" : "sell"
                                }`}
                                keys={[
                                    {
                                        type: "account",
                                        value: op[1].account_id,
                                        arg: "account"
                                    },
                                    {
                                        type: "amount",
                                        value: {
                                            amount: receivedAmount,
                                            asset_id: amount.asset_id
                                        },
                                        arg: "amount"
                                    },
                                    {
                                        type: "price",
                                        value: {
                                            base: priceBase,
                                            quote: priceQuote
                                        },
                                        arg: "price"
                                    }
                                ]}
                                params={{
                                    order: o.order_id.substring(4)
                                }}
                            />
                        );
                    }}
                </BindToChainStateWrapper>
            </span>
        );
    }
};
