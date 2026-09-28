// TypeScript/functional-component port of the legacy LinkToAssetById.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `AssetWrapper` (the `asset`-resolving HOC, itself built on
// `BindToChainState`) is left as-is and still used to wrap the export -
// like `BindToChainState.Wrapper`, it's a shared HOC used across ~29 other
// files (several already migrated), out of scope for this migration's
// leaf-component conversion pass.
import * as React from "react";
import {Link} from "react-router-dom";
import AssetWrapper from "./AssetWrapper";
import AssetName from "./AssetName";

interface LinkToAssetByIdProps {
    asset: any;
    noLink?: boolean;
}

function LinkToAssetById({asset, noLink}: LinkToAssetByIdProps) {
    const symbol = asset.get("symbol");
    const assetName = <AssetName name={symbol} noTip />;
    return noLink ? (
        assetName
    ) : (
        <Link to={`/asset/${symbol}/`}>{assetName}</Link>
    );
}

export default AssetWrapper(LinkToAssetById);
