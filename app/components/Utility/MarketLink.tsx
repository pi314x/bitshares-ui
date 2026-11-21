// TypeScript/functional-component port of the legacy MarketLink.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `AssetWrapper` (the `quote`/`base`-resolving HOC, itself built on
// `BindToChainState`) is left as-is and still used to wrap the export -
// like `BindToChainState.Wrapper`, it's a shared HOC used across ~29 other
// files, out of scope for this migration's leaf-component conversion pass.
//
// The commented-out dead `ObjectWrapper`/`BindToChainState` code (with its
// own "hangs the page on MarketLink import with firefox 62.0" note) is
// dropped rather than carried forward as a comment - it was never live
// code, just a documented historical dead end.
import * as React from "react";
import AssetWrapper from "./AssetWrapper";
import AssetName from "./AssetName";
import MarketsActions from "actions/MarketsActions";

// `@types/react-router-dom`'s `Link` return type isn't assignable to
// `JSX.Element` under this repo's `@types/react` version (a `key: Key |
// null` vs `key: string | null` mismatch) - cast to a generic component
// type, matching this migration's established handling of similar
// third-party typing friction.
import {Link} from "react-router-dom";
const LinkComponent = Link as React.ComponentType<any>;

interface MarketLinkProps {
    base: any;
    quote: any;
}

function MarketLink({base, quote}: MarketLinkProps) {
    if (base.get("id") === quote.get("id")) {
        return null;
    }
    const marketID = quote.get("symbol") + "_" + base.get("symbol");
    const marketName = (
        <span>
            <AssetName name={quote.get("symbol")} /> /{" "}
            <AssetName name={base.get("symbol")} />
        </span>
    );
    return (
        <LinkComponent
            to={`/market/${marketID}`}
            onClick={() => MarketsActions.switchMarket()}
        >
            {marketName}
        </LinkComponent>
    );
}

export default AssetWrapper(MarketLink, {
    propNames: ["quote", "base"],
    defaultProps: {base: "1.3.0"}
});
