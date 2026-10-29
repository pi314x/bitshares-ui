// The least height a list is given where the visible part of the window is small (a phone's keyboard is
// up): it scrolls, and is of use.
export const MIN_LIST_HEIGHT = 120;

/** The gap between a field and its list, and the list's distance from the window's edge. */
const GAP = 4;
const EDGE = 8;

/**
 * How tall a list can be on the side of its field it is drawn on: what is left of the part of the window
 * that is in view. A visual viewport (a phone's keyboard is up, or the page is pinched) is that part;
 * without one it is the window.
 */
export function listRoom(
    field: {top: number; bottom: number},
    up: boolean,
    windowHeight: number,
    visual?: {offsetTop: number; height: number} | null
): number {
    const visibleTop = visual ? visual.offsetTop : 0;
    const visibleBottom = visual
        ? visual.offsetTop + visual.height
        : windowHeight;
    const room = up
        ? field.top - GAP - visibleTop - EDGE
        : visibleBottom - (field.bottom + GAP) - EDGE;
    return Math.max(MIN_LIST_HEIGHT, Math.round(room));
}
