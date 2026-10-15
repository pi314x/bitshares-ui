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

// `@types/react-router-dom`'s `Link` return type isn't assignable to
// `JSX.Element` under this repo's `@types/react` version (key type
// mismatch) - cast to a generic component type, as done elsewhere in this
// migration for similar third-party typing friction.
const LinkComponent = Link as React.ComponentType<any>;

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
        <LinkComponent to={`/asset/${symbol}/`}>{assetName}</LinkComponent>
    );
}

export default AssetWrapper(LinkToAssetById);
