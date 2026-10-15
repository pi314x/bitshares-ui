import * as React from "react";

// Tenth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md) - `Row.tsx`'s sibling, the
// other half of antd v3's 24-column flexbox grid. See `Row.tsx`'s header
// comment for what was grepped/scoped out (no responsive breakpoints, no
// `pull`/`push` anywhere in the app) and why there's no CSS Module here.
export interface ColProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Width as a fraction of 24 columns. Omitted (as several real call
     * sites do, when a `Row` is just grouping a couple of elements with
     * no grid math involved): the column sizes to its content instead of
     * taking a fixed fraction, the browser's default flex-item sizing. */
    span?: number;
    /** Left margin as a fraction of 24 columns. */
    offset?: number;
}

export const Col = React.forwardRef<HTMLDivElement, ColProps>(function Col(
    {span, offset, style, ...rest},
    ref
) {
    const colStyle: React.CSSProperties = {
        boxSizing: "border-box",
        flex: span !== undefined ? `0 0 ${(span / 24) * 100}%` : undefined,
        maxWidth: span !== undefined ? `${(span / 24) * 100}%` : undefined,
        marginLeft: offset ? `${(offset / 24) * 100}%` : undefined,
        ...style
    };

    return <div ref={ref} style={colStyle} {...rest} />;
});
