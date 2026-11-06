import * as React from "react";

/** Whether a CSS media query matches, kept up to date. False where
 * `matchMedia` does not exist (tests). */
export function useMediaQuery(query: string): boolean {
    const get = () =>
        typeof window !== "undefined" && typeof window.matchMedia === "function"
            ? window.matchMedia(query).matches
            : false;
    const [matches, setMatches] = React.useState(get);
    React.useEffect(() => {
        if (typeof window.matchMedia !== "function") return;
        const list = window.matchMedia(query);
        const onChange = () => setMatches(list.matches);
        onChange();
        // Safari before 14 only has the deprecated addListener
        if (list.addEventListener) list.addEventListener("change", onChange);
        else list.addListener(onChange);
        return () => {
            if (list.removeEventListener) {
                list.removeEventListener("change", onChange);
            } else {
                list.removeListener(onChange);
            }
        };
    }, [query]);
    return matches;
}
