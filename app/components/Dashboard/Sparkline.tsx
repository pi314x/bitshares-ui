import * as React from "react";
import {sparkPath, trend} from "../../lib/common/sparkline";

const W = 64;
const H = 22;

/** A price line, coloured by its direction. Nothing when there is no shape. */
export function Sparkline({prices}: {prices: number[] | undefined}) {
    if (!prices || prices.length < 2) {
        return <span style={{color: "var(--faint)"}}>-</span>;
    }
    const direction = trend(prices);
    const colour =
        direction === "up"
            ? "var(--up)"
            : direction === "down"
            ? "var(--down)"
            : "var(--muted)";
    return (
        <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={direction}
            style={{display: "block", marginLeft: "auto"}}
        >
            <path
                d={sparkPath(prices, W, H)}
                fill="none"
                stroke={colour}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}
