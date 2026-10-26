// What the Dashboard's pie shows: a list of parts of a whole, the biggest ones kept and the small
// rest folded into one "other" slice, each with its share and where it starts on the circle.

export interface AllocationInput {
    key: string;
    label: string;
    /** in the unit; zero, negative and missing values are not part of the whole */
    value: number | null | undefined;
}

export interface Slice {
    key: string;
    label: string;
    value: number;
    /** 0..1 of the whole */
    share: number;
    /** degrees, 0 at the top, clockwise */
    start: number;
    end: number;
    /** the folded small ones: how many they are */
    folded?: number;
}

/**
 * The slices of a pie: values above zero, biggest first, at most `keep` of them and one more
 * for the rest ("other") when there are more. A pie of a dozen slivers says nothing.
 */
export function allocationSlices(
    parts: AllocationInput[],
    keep = 6
): {slices: Slice[]; total: number} {
    const usable = parts
        .filter(p => typeof p.value === "number" && (p.value as number) > 0)
        .map(p => ({key: p.key, label: p.label, value: p.value as number}))
        .sort((a, b) => b.value - a.value);
    const total = usable.reduce((sum, p) => sum + p.value, 0);
    if (!total) return {slices: [], total: 0};

    let kept = usable.slice(0, keep);
    const rest = usable.slice(keep);
    // one rest item on its own is just that item
    if (rest.length === 1) kept = usable;
    const restValue =
        rest.length > 1 ? rest.reduce((s, p) => s + p.value, 0) : 0;

    const items: Array<{
        key: string;
        label: string;
        value: number;
        folded?: number;
    }> = [...kept];
    if (rest.length > 1) {
        items.push({
            key: "other",
            label: "",
            value: restValue,
            folded: rest.length
        });
    }

    let angle = 0;
    const slices = items.map(item => {
        const share = item.value / total;
        const start = angle;
        angle += share * 360;
        return {...item, share, start, end: angle};
    });
    return {slices, total};
}

/** A point on a circle, degrees clockwise from the top. */
export function pointOnCircle(
    cx: number,
    cy: number,
    radius: number,
    degrees: number
): [number, number] {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)];
}

/**
 * The path of an arc of a ring (stroked, not filled). A gap of `gap` degrees is left at each end
 * so that slices do not touch; a slice smaller than the gap keeps a sliver. A full circle is two
 * half arcs (one arc cannot start and end at the same point).
 */
export function arcPath(
    cx: number,
    cy: number,
    radius: number,
    start: number,
    end: number,
    gap = 0.9
): string {
    const span = end - start;
    const half = Math.min(gap, Math.max(0, span / 4));
    const a = start + half;
    const b = end - half;
    if (b - a >= 359.9) {
        const [x1, y1] = pointOnCircle(cx, cy, radius, 0);
        const [x2, y2] = pointOnCircle(cx, cy, radius, 180);
        return `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${x2} ${y2} A ${radius} ${radius} 0 1 1 ${x1} ${y1}`;
    }
    const [x1, y1] = pointOnCircle(cx, cy, radius, a);
    const [x2, y2] = pointOnCircle(cx, cy, radius, b);
    const large = b - a > 180 ? 1 : 0;
    return `M ${x1.toFixed(3)} ${y1.toFixed(
        3
    )} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`;
}
