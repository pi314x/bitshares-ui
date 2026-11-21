import * as React from "react";

// Closes a dropdown-style UI (AccountSwitcher, etc.) when the user clicks
// outside it or presses Escape. Plain mousedown/keydown listeners rather
// than a UI-library dependency, since this is the only place that needs it
// so far.
export function useClickOutside<T extends HTMLElement>(
    onOutside: () => void,
    active: boolean
): React.RefObject<T> {
    const ref = React.useRef<T>(null);

    React.useEffect(() => {
        if (!active) return;

        function handlePointer(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onOutside();
            }
        }

        function handleKey(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onOutside();
            }
        }

        document.addEventListener("mousedown", handlePointer);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handlePointer);
            document.removeEventListener("keydown", handleKey);
        };
    }, [active, onOutside]);

    return ref;
}
