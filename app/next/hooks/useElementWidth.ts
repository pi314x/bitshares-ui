import * as React from "react";

/**
 * The width of an element, kept up to date. Null until it is measured, and
 * for good where `ResizeObserver` does not exist (tests), so a caller has a
 * fallback (a media query) for that case.
 *
 * A viewport media query cannot say how wide a page's own box is: the same
 * table sits in a full-width page and in an Explorer tab that is narrower by
 * the rail and the panel's inset.
 */
export function useElementWidth<T extends HTMLElement>(): [
    React.RefObject<T>,
    number | null
] {
    const ref = React.useRef<T>(null);
    const [width, setWidth] = React.useState<number | null>(null);
    React.useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver !== "function") return;
        const measure = () => setWidth(Math.round(el.clientWidth));
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return [ref, width];
}
