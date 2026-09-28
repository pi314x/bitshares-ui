// TypeScript/functional-component port of the legacy
// MarginPositionsTable.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// `ListGenerator`'s `static getDerivedStateFromProps` (recomputes a
// "cache" of margin items only when `bitAssets.length` or a JSON-
// stringified `callOrders` actually changed) is a textbook `useMemo`
// case - replicated with `useMemo` keyed on `[bitAssets.length,
// callOrdersJson]`, matching the same recomputation trigger exactly.
//
// Structural change (not a behavior change): `ListGenerator`'s
// `BindToChainState(Component)` (optional `callOrders` list) replaced by
// a Container replicating `BindToChainState.jsx`'s `chain_objects_list`
// resolution loop (same sparse-array quirk as prior batches).
// `AssetWrapper(Component, {propNames: ["bitAssets"], asList: true})`
// kept as-is around the Container, per this migration's established
// treatment of shared HOCs.
import * as React from "react";
import MarginPosition from "./MarginPosition";
import AssetWrapper from "../Utility/AssetWrapper";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import utils from "common/utils";

import TranslateWithLinks from "../Utility/TranslateWithLinks";
import Immutable from "immutable";
import {Popover} from "bitshares-ui-style-guide";

const alignRight: React.CSSProperties = {textAlign: "right"};
const alignLeft: React.CSSProperties = {textAlign: "left"};

function resolveObjectsList(prop: any, autosubscribe: boolean): any[] {
    const result: any[] = [];
    if (!prop) return result;
    let index = 0;
    prop.forEach((obj_id: any) => {
        ++index;
        if (obj_id) {
            result[index] = ChainStore.getObject(obj_id, false, autosubscribe);
        }
    });
    return result;
}

/**
 * Renders whole margin list including call orders and placeholders
 */
interface ListGeneratorCoreProps {
    callOrders: any[];
    bitAssets: any[];
    account: any;
    [key: string]: any;
}

function ListGeneratorCore({
    callOrders,
    bitAssets,
    account,
    ...rest
}: ListGeneratorCoreProps) {
    const callOrdersJson = JSON.stringify(callOrders);

    const assets = React.useMemo(() => {
        // construct map of bitassets
        const assetsList: any[] = [];
        const assetsMap: {[id: string]: number} = {};
        // index to track asset info
        let index = 0;

        bitAssets.forEach(o => {
            assetsMap[o.get("id")] = index++;
            assetsList.push({
                asset: o,
                has_margin_order: false
            });
        });

        if (callOrders.length > 0) {
            // add to iterated bitasets items that wasn't listed by default (component's callOrders prop)
            callOrders.forEach((o: any) => {
                // sometimes we get undefined resonses on very first api requests
                if (!!o) {
                    const assetId = o.getIn(["call_price", "quote", "asset_id"]);

                    if (assetsMap[assetId] == null) {
                        const newAssetInfo = ChainStore.getObject(assetId);
                        if (typeof newAssetInfo != "undefined") {
                            assetsMap[assetId] = index++;
                            assetsList.push({
                                asset: newAssetInfo,
                                has_margin_order: true,
                                order: o
                            });
                        }
                    } else {
                        // mark as margin order
                        assetsList[assetsMap[assetId]].has_margin_order = true;
                        assetsList[assetsMap[assetId]].order = o;
                    }
                }
            });
        }

        return assetsList;
    }, [bitAssets.length, callOrdersJson]);

    const rows = assets
        .sort((a, b) => {
            // a,b - order ChainObject's
            // could be done via component's property `order_by`

            // if both have an order, sort by debt
            if (a.has_margin_order && b.has_margin_order) {
                return b.order.get("debt") - a.order.get("debt");
            } else if (a.has_margin_order || b.has_margin_order) {
                // having an order goes above having no order

                return a.has_margin_order ? -1 : 1;
            } else {
                // if both have no order, sort by symbol

                const aName = utils.replaceName(a.asset);
                const bName = utils.replaceName(b.asset);

                const aSymbol =
                    (aName.prefix != null ? aName.prefix : "") + aName.name;
                const bSymbol =
                    (bName.prefix != null ? bName.prefix : "") + bName.name;

                return aSymbol.localeCompare(bSymbol);
            }
        })
        .map(a => {
            let debtAsset, collateralAsset;
            let order_id = null;

            // user has margin on this asset
            if (a.has_margin_order) {
                const order = a.order;

                debtAsset = order.getIn(["call_price", "quote", "asset_id"]);
                collateralAsset = order.getIn(["call_price", "base", "asset_id"]);

                order_id = order.get("id");
            } else {
                debtAsset = a.asset.get("id");
                collateralAsset = a.asset.getIn([
                    "bitasset",
                    "options",
                    "short_backing_asset"
                ]);
            }

            return (
                <MarginPosition
                    key={a.asset.get("id")}
                    object={order_id}
                    account={account}
                    debtAsset={debtAsset}
                    collateralAsset={collateralAsset}
                    {...rest}
                />
            );
        });

    return <tbody>{rows}</tbody>;
}

interface ListGeneratorChainContainerProps {
    callOrders?: any;
    bitAssets: any[];
    account: any;
    [key: string]: any;
}

function ListGeneratorChainContainer({
    callOrders,
    bitAssets,
    account,
    ...rest
}: ListGeneratorChainContainerProps) {
    useChainStoreTick();
    const resolvedCallOrders = resolveObjectsList(callOrders, false);

    return (
        <ListGeneratorCore
            callOrders={resolvedCallOrders}
            bitAssets={bitAssets}
            account={account}
            {...rest}
        />
    );
}

const ListGenerator = AssetWrapper(ListGeneratorChainContainer, {
    propNames: ["bitAssets"],
    defaultProps: {
        bitAssets: [
            "1.3.113",
            "1.3.120",
            "1.3.121",
            "1.3.1325",
            "1.3.105",
            "1.3.106",
            "1.3.103"
        ]
    },
    asList: true
});

interface MarginPositionsTableProps {
    callOrders?: any;
    account: any;
    className?: string;
    children?: React.ReactNode;
    preferredUnit?: string;
}

const MarginPositionsTable = ({
    callOrders,
    account,
    className,
    children,
    preferredUnit
}: MarginPositionsTableProps) => {
    return (
        <table className={"table table-hover " + className}>
            <thead>
                <tr>
                    <th style={alignLeft}>
                        <Translate content="explorer.asset.title" />
                    </th>
                    <th style={alignRight}>
                        <Translate content="exchange.balance" />
                    </th>
                    <th style={alignRight}>
                        <Translate content="transaction.borrow_amount" />
                    </th>
                    <th style={alignRight} className="column-hide-medium">
                        <Translate content="transaction.collateral" />
                    </th>
                    <th>
                        <Popover
                            placement="top"
                            title={counterpart.translate(
                                "header.collateral_ratio"
                            )}
                            content={counterpart.translate("tooltip.coll_ratio")}
                        >
                            <Translate content="borrow.coll_ratio" />
                        </Popover>
                    </th>
                    <th>
                        <Popover
                            placement="top"
                            content={
                                <div style={{width: "600px"}}>
                                    {counterpart.translate(
                                        "borrow.target_collateral_ratio_explanation"
                                    )}
                                </div>
                            }
                            title={counterpart.translate(
                                "borrow.target_collateral_ratio"
                            )}
                        >
                            <Translate content="borrow.target_collateral_ratio_short" />
                        </Popover>
                    </th>
                    <th style={alignRight}>
                        <TranslateWithLinks
                            noLink
                            string="account.total"
                            keys={[
                                {
                                    type: "asset",
                                    value: preferredUnit,
                                    arg: "asset"
                                }
                            ]}
                        />
                    </th>
                    <th style={alignRight} className="column-hide-small">
                        <Popover
                            placement="top"
                            content={counterpart.translate("tooltip.call_price")}
                        >
                            <Translate content="exchange.call" />
                        </Popover>
                    </th>
                    <th style={alignRight} className="column-hide-small">
                        <Popover
                            placement="top"
                            content={counterpart.translate("tooltip.feed_price")}
                        >
                            <Translate content="exchange.feed_price" />
                        </Popover>
                    </th>
                    <th className="column-hide-small" style={alignLeft}>
                        <Translate content="explorer.assets.units" />
                    </th>
                    <th style={{textAlign: "center"}}>
                        <Translate content="exchange.market" />
                    </th>
                    <th>
                        <Translate content="borrow.adjust_short" />
                    </th>
                    <th>
                        <Translate content="transfer.close" />
                    </th>
                </tr>
            </thead>
            <ListGenerator
                account={account}
                callOrders={Immutable.List(callOrders)}
            />
            <tbody>{children}</tbody>
        </table>
    );
};

export default MarginPositionsTable;
