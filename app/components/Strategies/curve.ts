// The path of the result-over-time chart: the strategy's line and the line of holding, on one scale that has the zero line in it.
export interface CurvePoint {
    t: number;
    pnl: number;
    hold: number;
}

export interface CurvePaths {
    strategy: string;
    hold: string;
    /** the y of the zero line */
    zero: number;
}

export function curvePaths(
    curve: CurvePoint[],
    width: number,
    height: number,
    pad = 4
): CurvePaths | null {
    if (curve.length < 2) return null;
    const values = curve.flatMap(p => [p.pnl, p.hold]).concat(0);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const span = high - low || 1;
    const t0 = curve[0].t;
    const tSpan = curve[curve.length - 1].t - t0 || 1;
    const x = (t: number) => pad + ((t - t0) / tSpan) * (width - 2 * pad);
    const y = (v: number) => pad + (1 - (v - low) / span) * (height - 2 * pad);
    const line = (pick: (p: CurvePoint) => number) =>
        curve
            .map(
                (p, i) =>
                    `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(pick(p)).toFixed(
                        1
                    )}`
            )
            .join("");
    return {
        strategy: line(p => p.pnl),
        hold: line(p => p.hold),
        zero: Number(y(0).toFixed(1))
    };
}
