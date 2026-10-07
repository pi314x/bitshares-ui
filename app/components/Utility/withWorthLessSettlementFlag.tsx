// TypeScript/functional-component port of the legacy
// withWorthLessSettlementFlag.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// The inner `PureComponent`'s `UNSAFE_componentWillMount` (calls
// `updateFlag()` once before first render) + `componentDidUpdate` (calls
// `updateFlag()` again after *every* update, unconditionally - no props
// comparison) are both replicated by a single `useEffect` with no
// dependency array, which runs after the initial render and after every
// subsequent render - matching the "recompute on every update,
// unconditionally" behavior verbatim (not narrowed to an `[asset,
// shortBackingAsset]` dependency array, which would be a behavior change).
//
// Preserved verbatim (not "fixed"): the `preicision` typo (should be
// `precision`) in the `base` Asset's constructor options.
import * as React from "react";
import {Apis} from "bitsharesjs-ws";
import AssetWrapper from "./AssetWrapper";
import {Asset, Price} from "common/MarketClasses";
import asset_utils from "../../lib/common/asset_utils";

const withShortBackingAsset = (WrappedComponent: React.ComponentType<any>) => {
    const WrappedComponentWithShortBackingAsset = AssetWrapper(
        WrappedComponent,
        {propNames: ["shortBackingAsset"]}
    );
    return AssetWrapper((props: any) => (
        <WrappedComponentWithShortBackingAsset
            {...props}
            shortBackingAsset={props.asset.getIn([
                "bitasset",
                "options",
                "short_backing_asset"
            ])}
        />
    ));
};

interface WorthLessSettlementFlagState {
    worthLessSettlement?: boolean;
    marketPrice?: number;
    settlementPrice?: number;
}

const withWorthLessSettlementFlag = (
    WrappedComponent: React.ComponentType<any>
) =>
    withShortBackingAsset((props: any) => {
        const [state, setState] = React.useState<WorthLessSettlementFlagState>(
            {worthLessSettlement: undefined}
        );

        React.useEffect(() => {
            const {asset, shortBackingAsset} = props;
            const assetId = asset.get("id");
            const shortBackingAssetId = shortBackingAsset.get("id");

            // TODO: maybe properly subscribe to market instead of calling api directly?
            const realMarketPricePromise = Apis.instance()
                .db_api()
                .exec("get_order_book", [shortBackingAssetId, assetId, 1])
                .then((orderBook: any) =>
                    orderBook.bids.length === 0
                        ? 0
                        : Number(orderBook.bids[0].price)
                );

            let feedPrice: any = null;
            let factor = 1;
            let offset = 0;
            if (
                !!asset.get("bitasset") &&
                asset.get("bitasset").get("settlement_fund") > 0
            ) {
                // if globally settled, feed price == settlement price
                feedPrice = asset.get("bitasset").get("settlement_price");
            } else {
                feedPrice = asset_utils.extractRawFeedPrice(asset);
                offset = asset
                    .get("bitasset")
                    .get("options")
                    .get("force_settlement_offset_percent");
                factor = 1 - offset / 10000;
            }

            const realSettlementPrice =
                new (Price as any)({
                    base: new (Asset as any)({
                        asset_id: shortBackingAssetId,
                        amount: feedPrice.getIn(["quote", "amount"]),
                        preicision: shortBackingAsset.get("precision")
                    }),
                    quote: new (Asset as any)({
                        asset_id: assetId,
                        amount: feedPrice.getIn(["base", "amount"]),
                        precision: asset.get("precision")
                    })
                }).toReal() * factor;

            // TODO: compare fractional price instead of real price
            realMarketPricePromise.then((realMarketPrice: number) =>
                setState({
                    worthLessSettlement: realMarketPrice > realSettlementPrice,
                    marketPrice: realMarketPrice,
                    settlementPrice: realSettlementPrice
                })
            );
        });

        return (
            <WrappedComponent
                {...props}
                worthLessSettlement={state.worthLessSettlement}
                marketPrice={state.marketPrice}
                settlementPrice={state.settlementPrice}
            />
        );
    });

export default withWorthLessSettlementFlag;
