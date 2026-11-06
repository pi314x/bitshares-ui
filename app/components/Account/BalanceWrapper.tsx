// TypeScript/functional-component port of the legacy BalanceWrapper.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(BalanceWrapper)` HOC (resolving the optional
// `balances`/`orders` list props via `ChainStore.getObject` per entry)
// is replaced by a Container replicating `BindToChainState.jsx`'s exact
// `chain_objects_list` resolution loop, including its sparse-array quirk
// (the loop increments its index *before* assigning, so real items start
// at array index 1, with a hole at 0) - harmless here since the render
// logic only ever calls `.filter(...)`/`.reduce(...)` on the results
// (both skip array holes), matching the same reasoning already
// documented for `Utility/AssetSelect.tsx`'s `chain_assets_list` port.
import * as React from "react";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import Immutable from "immutable";

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

interface BalanceWrapperProps {
    wrap: React.ComponentType<any>;
    balances?: any;
    orders?: any;
    [key: string]: any;
}

function BalanceWrapper({
    wrap,
    balances = Immutable.List(),
    orders = Immutable.List(),
    ...others
}: BalanceWrapperProps) {
    useChainStoreTick();
    const resolvedBalances = resolveObjectsList(balances, false);
    const resolvedOrders = resolveObjectsList(orders, false);

    const balanceAssets = resolvedBalances
        .filter(b => {
            return !!b && b.get("balance") !== 0;
        })
        .map(b => {
            return b.get("asset_type");
        });

    const ordersByAsset = resolvedOrders
        .filter(o => !!o)
        .reduce((ordersAcc: any, o: any) => {
            const asset_id = o.getIn(["sell_price", "base", "asset_id"]);
            if (!ordersAcc[asset_id]) ordersAcc[asset_id] = 0;
            ordersAcc[asset_id] += parseInt(o.get("for_sale"), 10);
            return ordersAcc;
        }, {});

    for (const id in ordersByAsset) {
        if (balanceAssets.indexOf(id) === -1) {
            balanceAssets.push(id);
        }
    }

    const Component = wrap;
    return (
        <Component
            {...others}
            orders={ordersByAsset}
            balanceAssets={Immutable.List(balanceAssets)}
        />
    );
}

export default BalanceWrapper;
