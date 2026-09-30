// TypeScript/functional-component port of the legacy Help.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `ApplicationApi`, `.add_type_operation`, `process_transaction`,
// `PrivateKey`, `brainkey` - none appear. Purely renders static help
// content by URL path.
//
// Rendered via several `<Route exact path="/help[/:path1[/:path2[/:path3]]]"
// component={Help} />` entries in `App.jsx` (react-router-dom v5), which
// inject `match` as a prop - `props.match.params` is real, not dead.
import * as React from "react";
import HelpContent from "./Utility/HelpContent";
import {toPairs} from "lodash-es";

interface HelpProps {
    match: {params: Record<string, any>};
}

export default function Help({match}: HelpProps) {
    const path = toPairs(match.params)
        .map((p: any) => p[1])
        .join("/");

    return (
        <div className="grid-container page-layout help-content-layout">
            <div className="grid-block page-layout">
                <div className="grid-block main-content wrap regular-padding">
                    <div className="grid-block medium-3">
                        <div className="grid-content help-toc responsive-list">
                            <HelpContent path="toc" />
                        </div>
                    </div>

                    <div className="grid-block medium-9">
                        <div className="grid-content main-content">
                            <HelpContent path={path || "index"} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
