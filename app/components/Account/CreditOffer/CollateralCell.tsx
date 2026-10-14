// The assets an offer accepts as collateral: the first few, the rest on
// request. A list of fifteen made every row of the offers table tall.
import * as React from "react";
import counterpart from "counterpart";
import LinkToAssetById from "../../Utility/LinkToAssetById";

const SHOWN = 3;

export function CollateralCell({
    items
}: {
    /** `[assetId, price]` pairs, as the offer carries them */
    items: any[];
}): JSX.Element {
    const [all, setAll] = React.useState(false);
    const shown = all ? items : items.slice(0, SHOWN);
    return (
        <div>
            {shown.map((v: any) => (
                <div key={v[0]}>
                    <LinkToAssetById asset={v[0]} />
                </div>
            ))}
            {items.length > SHOWN ? (
                <button
                    type="button"
                    onClick={() => setAll(a => !a)}
                    style={{
                        border: 0,
                        background: "transparent",
                        padding: 0,
                        color: "var(--accent)",
                        font: "inherit",
                        fontSize: 13,
                        cursor: "pointer"
                    }}
                >
                    {all
                        ? counterpart.translate("desk.show_less")
                        : counterpart.translate("desk.more_n", {
                              count: items.length - SHOWN
                          })}
                </button>
            ) : null}
        </div>
    );
}

export default CollateralCell;
