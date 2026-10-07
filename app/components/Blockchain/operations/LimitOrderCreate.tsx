// TypeScript port of the legacy LimitOrderCreate.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes. The
// `BindToChainState.Wrapper` render-prop usage is kept exactly as-is
// (not part of this migration's BindToChainState-replacement scope).
/* eslint-disable react/display-name */
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";
import BindToChainState from "../../Utility/BindToChainState";
import marketUtils from "common/market_utils";

const BindToChainStateWrapper = (BindToChainState as any).Wrapper;

interface LimitOrderCreateProps {
    op: any;
    changeColor: (color: string) => void;
    fromComponent?: string;
    marketDirections: any;
    result?: any;
}

export const LimitOrderCreate = ({
    op,
    changeColor,
    fromComponent,
    marketDirections,
    result
}: LimitOrderCreateProps) => {
    changeColor("warning");

    if (fromComponent === "proposed_operation") {
        const isAsk = (marketUtils as any).isAskOp(op[1]);

        return (
            <span>
                <TranslateWithLinks
                    string={
                        isAsk
                            ? "proposal.limit_order_sell"
                            : "proposal.limit_order_buy"
                    }
                    keys={[
                        {
                            type: "account",
                            value: op[1].seller,
                            arg: "account"
                        },
                        {
                            type: "amount",
                            value: isAsk
                                ? op[1].amount_to_sell
                                : op[1].min_to_receive,
                            arg: "amount"
                        },
                        {
                            type: "price",
                            value: {
                                base: isAsk
                                    ? op[1].min_to_receive
                                    : op[1].amount_to_sell,
                                quote: isAsk
                                    ? op[1].amount_to_sell
                                    : op[1].min_to_receive
                            },
                            arg: "price"
                        }
                    ]}
                />
            </span>
        );
    } else {
        const o = op[1];
        return (
            <span>
                <BindToChainStateWrapper
                    base={o.min_to_receive.asset_id}
                    quote={o.amount_to_sell.asset_id}
                >
                    {({base, quote}: any) => {
                        const {
                            marketName,
                            first,
                            second
                        } = (marketUtils as any).getMarketName(base, quote);
                        const inverted = marketDirections.get(marketName);

                        const isBid =
                            o.amount_to_sell.asset_id ===
                            (inverted ? first.get("id") : second.get("id"));

                        const priceBase = isBid
                            ? o.amount_to_sell
                            : o.min_to_receive;
                        const priceQuote = isBid
                            ? o.min_to_receive
                            : o.amount_to_sell;
                        const amount = isBid
                            ? op[1].min_to_receive
                            : op[1].amount_to_sell;
                        const orderId = result
                            ? typeof result[1] == "string"
                                ? "#" + result[1].substring(4)
                                : ""
                            : "";

                        return (
                            <TranslateWithLinks
                                string={
                                    isBid
                                        ? "operation.limit_order_buy"
                                        : "operation.limit_order_sell"
                                }
                                keys={[
                                    {
                                        type: "account",
                                        value: op[1].seller,
                                        arg: "account"
                                    },
                                    {
                                        type: "amount",
                                        value: amount,
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
                                    order: orderId
                                }}
                            />
                        );
                    }}
                </BindToChainStateWrapper>
            </span>
        );
    }
};
