// TypeScript/functional-component port of the legacy PoolmartPage.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Trivial wrapper, mechanical port:
// the class's empty `this.state = {}` (never read or written anywhere)
// is dropped since a function component needs no such placeholder.
import * as React from "react";
import LiquidityPools from "./LiquidityPools";

export default function PoolmartPage() {
    return (
        <div className="grid-content">
            <div className="grid-wrapper padding">
                <LiquidityPools />
            </div>
        </div>
    );
}
