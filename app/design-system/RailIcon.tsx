import * as React from "react";

// The navigation rail's icons: one stroke style (24 grid, 1.75 line, round
// ends), `currentColor`, so an icon takes the entry's colour (muted, hover,
// accent when current). Drawn here rather than loaded: no request, no font.
const PATHS: {[name: string]: React.ReactNode} = {
    dashboard: (
        <>
            <rect x="3.5" y="3.5" width="7" height="8" rx="1.5" />
            <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
            <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
            <rect x="3.5" y="14.5" width="7" height="6" rx="1.5" />
        </>
    ),
    accounts: (
        <>
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
            <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
            <path d="M18 14.2A6.5 6.5 0 0 1 21.5 20" />
        </>
    ),
    voting: (
        <>
            <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
            <path d="m8 12.5 3 3 5-6" />
        </>
    ),
    settings: (
        <>
            <path d="M4 7h10" />
            <path d="M18 7h2" />
            <circle cx="16" cy="7" r="2" />
            <path d="M4 17h2" />
            <path d="M10 17h10" />
            <circle cx="8" cy="17" r="2" />
        </>
    ),
    send: (
        <>
            <path d="M7 17 17 7" />
            <path d="M8 7h9v9" />
        </>
    ),
    deposit: (
        <>
            <path d="M12 4v11" />
            <path d="m7.5 11 4.5 4.5 4.5-4.5" />
            <path d="M5 20h14" />
        </>
    ),
    withdraw: (
        <>
            <path d="M12 20V9" />
            <path d="m7.5 13 4.5-4.5 4.5 4.5" />
            <path d="M5 4h14" />
        </>
    ),
    timed: (
        <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
        </>
    ),
    trade: (
        <>
            <path d="M7 4v3" />
            <rect x="5" y="7" width="4" height="8" rx="1" />
            <path d="M7 15v4" />
            <path d="M17 5v4" />
            <rect x="15" y="9" width="4" height="7" rx="1" />
            <path d="M17 16v3" />
        </>
    ),
    pools: (
        <path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0C6 9.7 12 3.5 12 3.5Z" />
    ),
    instant: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
    prediction: (
        <>
            <circle cx="12" cy="12" r="8.5" />
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 12h.01" />
        </>
    ),
    credit: (
        <>
            <path d="M18 6 6 18" />
            <circle cx="7.5" cy="7.5" r="2.5" />
            <circle cx="16.5" cy="16.5" r="2.5" />
        </>
    ),
    funds: (
        <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-2.5Z" />
    ),
    explorer: (
        <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
        </>
    ),
    spotlight: (
        <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8L12 3.5Z" />
    ),
    help: (
        <>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M9.7 9.5a2.4 2.4 0 1 1 3.4 2.2c-.7.4-1.1 1-1.1 1.8" />
            <path d="M12 16.8h.01" />
        </>
    )
};

export function RailIcon({
    name,
    className
}: {
    name: string;
    className?: string;
}): JSX.Element | null {
    const shape = PATHS[name];
    if (!shape) return null;
    return (
        <svg
            className={className}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {shape}
        </svg>
    );
}
