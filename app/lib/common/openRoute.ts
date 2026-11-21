// "Open this page of the app" for what has no router of its own: a toast (drawn by the design system), the
// bell. The shell mounts `<RouteOpener />`, which hands the router's `navigate` to `setRouteOpener`; until
// something has (a test, the start-up) asking to open a page does nothing, and the entry is only text.
type Opener = (to: string) => void;

let opener: Opener | null = null;

/** The router's way of opening a page; returns the function that takes it away again. */
export function setRouteOpener(next: Opener): () => void {
    opener = next;
    return () => {
        if (opener === next) opener = null;
    };
}

/** Opens a route of the app (`/block/7/1`); false when nothing can open it. */
export function openRoute(to: string): boolean {
    if (!opener || !/^\/[^/\\]/.test(to)) return false;
    opener(to);
    return true;
}
