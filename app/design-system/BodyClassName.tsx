import * as React from "react";

// Eighteenth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`/`Select`/`Icon`/`Notification`/`Table`/`Row`/`Col`/
// `Radio`/`Switch`/`Card`/`Popover`/`Checkbox`/`Alert`/`Tabs`'s
// precedent. Replaces `bitshares-ui-style-guide`'s `BodyClassName` - not
// a visible UI piece at all, just a side-effecting wrapper that adds its
// `className` to `document.body` for as long as it's mounted (both real
// call sites, `App.jsx`/`AppInit.jsx`, use it to put the current theme
// name on `<body>`) and otherwise renders its `children` unchanged.
//
// Grepped both real call sites: `className` (a single, possibly
// space-separated string - the theme name) and `children`. No other
// props used anywhere.
export interface BodyClassNameProps {
    className?: string;
    children?: React.ReactNode;
}

export function BodyClassName({
    className,
    children
}: BodyClassNameProps): JSX.Element {
    React.useEffect(() => {
        if (!className) return undefined;
        const classes = className.split(/\s+/).filter(Boolean);
        if (classes.length === 0) return undefined;
        document.body.classList.add(...classes);
        return () => {
            document.body.classList.remove(...classes);
        };
    }, [className]);

    return <>{children}</>;
}
