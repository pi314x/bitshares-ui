import * as React from "react";

// Ninth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`/`Select`/`Icon`/`Notification`/`Table`'s precedent.
// Replaces `bitshares-ui-style-guide`'s `Row` half of antd v3's 24-column
// flexbox grid (`Col` is this file's sibling, `Col.tsx`).
//
// Grepped every real `<Row ...>` call site before designing this: no
// `type="flex"`/`justify`/`align` anywhere in the app (every real `Row`
// is already a flex container by default, so there's nothing those props
// would need to toggle), no responsive `xs`/`sm`/`md`/`lg`/`xl` Col
// breakpoints, and exactly one real `gutter` usage (`gutter={16}`,
// `Modal/View/BorrowModalView.tsx`). `ref` forwards to the rendered
// `<div>` - one real call site (`Exchange/OrderBook.tsx`) measures it
// directly via `elemHeight(ref.current)`.
//
// No CSS Module here (unlike every other design-system component so
// far): the entire grid - gutter spacing, column widths - is computed
// inline from `gutter`/`span`/`offset`, matching antd v3's own largely
// inline-style-driven grid implementation. There's nothing fixed to put
// in a stylesheet.
export interface RowProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Horizontal spacing (px) between columns - split as left/right
     * padding on each child plus a matching negative margin on the row
     * itself, the same technique antd v3's `Row` uses. */
    gutter?: number;
    children?: React.ReactNode;
}

export const Row = React.forwardRef<HTMLDivElement, RowProps>(function Row(
    {gutter = 0, style, children, ...rest},
    ref
) {
    const halfGutter = gutter / 2;

    const rowStyle: React.CSSProperties = {
        display: "flex",
        flexWrap: "wrap",
        marginLeft: gutter ? -halfGutter : undefined,
        marginRight: gutter ? -halfGutter : undefined,
        ...style
    };

    const items = gutter
        ? React.Children.map(children, child =>
              React.isValidElement(child)
                  ? React.cloneElement(child as React.ReactElement<any>, {
                        style: {
                            ...((child.props as any).style || {}),
                            paddingLeft: halfGutter,
                            paddingRight: halfGutter
                        }
                    })
                  : child
          )
        : children;

    return (
        <div ref={ref} style={rowStyle} {...rest}>
            {items}
        </div>
    );
});
