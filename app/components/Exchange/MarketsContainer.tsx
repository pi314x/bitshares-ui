// TypeScript/functional-component port of the legacy MarketsContainer.jsx
// + Markets.jsx (Phase 4, docs/UI_MIGRATION_PLAN.md). Renders the starred/
// featured markets list (`MyMarkets`) inside a height-tracking wrapper
// div, sized to fill its parent (used as an Explorer tab's content).
//
// Confirmed dead, dropped: `MarketsContainer.jsx`'s entire purpose was an
// `AltContainer` wrap injecting `starredMarkets`/`viewSettings`/
// `lookupResults`/`marketBase` as props onto its child, `<Markets/>` -
// but `Markets.jsx` never read any of those four props anywhere (its own
// `render()`/methods only manage a local `height` state from a window
// resize listener, and pass fixed layout props to `MyMarkets`, which
// resolves its own store data independently, not via injected props).
// Verified via a case-insensitive whole-file read of `Markets.jsx` - none
// of the four names appear anywhere outside the now-removed
// `MarketsContainer` wrapper. Collapsed into one component under the
// `MarketsContainer` name (`Explorer.tsx`'s external contract - the only
// importer), folding in `Markets.jsx`'s actual logic; `Markets.jsx`
// itself is removed rather than kept as a pass-through, since it had no
// other importer.
import * as React from "react";
import MyMarkets from "./MyMarkets";

export default function MarketsContainer() {
    return (
        <div className="grid-block vertical no-overflow">
            <MyMarkets
                style={{width: "100%"}}
                // no height of its own: the list is as long as it is and the
                // page scrolls, not a box inside the page
                autoHeight
                className="no-overflow"
                headerStyle={{paddingTop: 0, borderTop: "none"}}
                tabHeader={true}
                columns={[
                    {name: "star", index: 1},
                    {name: "market", index: 2},
                    {name: "quoteSupply", index: 3},
                    {name: "vol", index: 4},
                    {name: "price", index: 5},
                    {name: "change", index: 6}
                ]}
            />
        </div>
    );
}
