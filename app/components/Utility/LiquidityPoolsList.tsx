// TypeScript/functional-component port of the legacy
// LiquidityPoolsList.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Dropped the original's `BindToChainState(LiquidityPoolsList)` wrapping
// entirely (not replaced by a Container, unlike every other
// `BindToChainState` usage ported so far) - found by reading
// `BindToChainState.jsx`'s type-checker list directly: it only recognizes
// `ChainTypes.ChainLiquidityPool` (singular, `isLiquidityPoolType`), not
// the plural `ChainTypes.ChainLiquidityPoolsList` this component's
// `pools` prop actually declares. Since no `isXType` checker matches, the
// prop is never added to any of `BindToChainState`'s resolution
// categories, so it was already being passed straight through unresolved
// - the wrapping was already a behavioral no-op for this component.
// Confirmed by the render code itself, which treats `pools` as an
// already-resolved multi-entry collection (`pools.size`, `pools.get(0)`)
// rather than something `BindToChainState` would have produced from its
// own (unrelated) singular-liquidity-pool resolution path.
import * as React from "react";
import counterpart from "counterpart";
import {Link} from "react-router-dom";
import {Row} from "../../design-system/Row";
import {Col} from "../../design-system/Col";
import {ChainStore} from "bitsharesjs";
import AssetName from "./AssetName";

const LinkComponent = Link as React.ComponentType<any>;

interface LiquidityPoolsListProps {
    pools: any;
    useAs?: string;
}

export default function LiquidityPoolsList({
    pools,
    useAs
}: LiquidityPoolsListProps) {
    if (pools === null) {
        return <div />;
    }
    if (useAs === "single") {
        const pool = pools.size > 0 ? pools.get(0) : null;
        if (pool === null) {
            return null;
        }
        const assetA = (ChainStore as any).getAsset(pool.get("asset_a"));
        const assetAQty =
            pool.get("balance_a") / Math.pow(10, assetA.get("precision"));
        const assetB = (ChainStore as any).getAsset(pool.get("asset_b"));
        const assetBQty =
            pool.get("balance_b") / Math.pow(10, assetB.get("precision"));
        return (
            <div>
                <Row>
                    <Col span={12}>
                        {counterpart.translate(
                            "poolmart.liquidity_pools.asset_a"
                        )}
                    </Col>
                    <Col span={12}>
                        <LinkComponent to={`/asset/${assetA.get("symbol")}`}>
                            {assetAQty}
                            &nbsp;
                            <AssetName name={assetA.get("symbol")} />
                        </LinkComponent>
                    </Col>
                </Row>
                <Row>
                    <Col span={12}>
                        {counterpart.translate(
                            "poolmart.liquidity_pools.asset_b"
                        )}
                    </Col>
                    <Col span={12}>
                        <LinkComponent to={`/asset/${assetB.get("symbol")}`}>
                            {assetBQty}
                            &nbsp;
                            <AssetName name={assetB.get("symbol")} />
                        </LinkComponent>
                    </Col>
                </Row>
                <Row>
                    <Col span={12}>
                        {counterpart.translate(
                            "poolmart.liquidity_pools.taker_fee_percent"
                        )}
                    </Col>
                    <Col span={12}>{pool.get("taker_fee_percent") / 100} %</Col>
                </Row>
            </div>
        );
    } else if (useAs === "list") {
        return <div />;
    } else {
        return <div />;
    }
}
