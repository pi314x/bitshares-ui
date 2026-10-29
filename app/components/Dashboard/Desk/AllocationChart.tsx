// A pie (a thin ring) of what an account holds, with its legend: each slice a part of the whole, its
// share in the middle when it is pointed at, the total otherwise. The legend is the same data as a
// list - the pie is not the only way to read it - and pointing at a row lights its slice.
import * as React from "react";
import {
    Slice,
    allocationSlices,
    arcPath,
    AllocationInput
} from "../../../lib/common/allocation";
import styles from "./AllocationChart.module.scss";

const SIZE = 120;
const CENTER = SIZE / 2;
const RADIUS = 44;
const WIDTH = 16;

// the palette's own order (theme.scss: --cat-1..6, --cat-other)
const colorOf = (slice: Slice, index: number) =>
    slice.key === "other"
        ? "var(--cat-other)"
        : `var(--cat-${(index % 6) + 1})`;

export interface AllocationChartProps {
    parts: AllocationInput[];
    /** what the "other" slice is called ("Other (4)") */
    otherLabel: (count: number) => string;
    /** the total in the middle, already formatted */
    totalText: string;
    unitSymbol: string;
    /** a value of a slice, formatted */
    format: (value: number) => string;
    percent: (share: number) => string;
    emptyText: string;
    /** a link or other element for a legend row's label */
    renderLabel?: (slice: Slice) => React.ReactNode;
    ariaLabel: string;
}

export default function AllocationChart({
    parts,
    otherLabel,
    totalText,
    unitSymbol,
    format,
    percent,
    emptyText,
    renderLabel,
    ariaLabel
}: AllocationChartProps): JSX.Element {
    const {slices, total} = React.useMemo(() => allocationSlices(parts), [
        parts
    ]);
    const [active, setActive] = React.useState<string | null>(null);

    if (!slices.length) {
        return <div className={styles.empty}>{emptyText}</div>;
    }

    const labelOf = (slice: Slice) =>
        slice.key === "other" ? otherLabel(slice.folded || 0) : slice.label;
    const chosen = slices.find(s => s.key === active) || null;

    return (
        <div className={styles.wrap}>
            <svg
                className={styles.pie}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                role="img"
                aria-label={ariaLabel}
            >
                <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    className={styles.track}
                    strokeWidth={WIDTH}
                />
                {slices.map((slice, i) => (
                    <path
                        key={slice.key}
                        d={arcPath(
                            CENTER,
                            CENTER,
                            RADIUS,
                            slice.start,
                            slice.end
                        )}
                        className={styles.slice}
                        style={{
                            stroke: colorOf(slice, i),
                            opacity:
                                chosen && chosen.key !== slice.key ? 0.35 : 1
                        }}
                        strokeWidth={
                            chosen && chosen.key === slice.key
                                ? WIDTH + 3
                                : WIDTH
                        }
                        onMouseEnter={() => setActive(slice.key)}
                        onMouseLeave={() => setActive(null)}
                    >
                        <title>{`${labelOf(slice)}: ${percent(
                            slice.share
                        )}`}</title>
                    </path>
                ))}
                <text
                    x={CENTER}
                    y={CENTER - 3}
                    className={styles.centerMain}
                    textAnchor="middle"
                >
                    {chosen ? percent(chosen.share) : totalText}
                </text>
                <text
                    x={CENTER}
                    y={CENTER + 10}
                    className={styles.centerSub}
                    textAnchor="middle"
                >
                    {chosen ? labelOf(chosen) : unitSymbol}
                </text>
            </svg>
            <ul className={styles.legend}>
                {slices.map((slice, i) => (
                    <li
                        key={slice.key}
                        className={`${styles.row} ${
                            chosen && chosen.key === slice.key
                                ? styles.rowOn
                                : ""
                        }`}
                        onMouseEnter={() => setActive(slice.key)}
                        onMouseLeave={() => setActive(null)}
                    >
                        <span
                            className={styles.swatch}
                            style={{background: colorOf(slice, i)}}
                            aria-hidden="true"
                        />
                        <span className={styles.name}>
                            {renderLabel && slice.key !== "other"
                                ? renderLabel(slice)
                                : labelOf(slice)}
                        </span>
                        <span className={styles.value}>
                            {format(slice.value)}
                        </span>
                        <span className={styles.share}>
                            {percent(slice.share)}
                        </span>
                    </li>
                ))}
            </ul>
            <span className={styles.srOnly}>{format(total)}</span>
        </div>
    );
}
