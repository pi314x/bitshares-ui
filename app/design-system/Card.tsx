import * as React from "react";
import styles from "./Card.module.scss";

// Thirteenth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`/`Select`/`Icon`/`Notification`/`Table`/`Row`/`Col`/
// `Radio`/`Switch`'s precedent. Replaces `bitshares-ui-style-guide`'s
// `Card` (antd v3).
//
// Grepped every real call site before designing this: a plain
// bordered box, `className`/`style`/`children` and one real `onKeyDown`
// (`Showcases/Borrow.tsx`). No `title`/`extra`/`actions`/`cover`/
// `bordered`/`hoverable`/`loading` anywhere - every real call site just
// wants a styled container, not antd's fuller card-with-header-and-footer
// layout.
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    function Card({className, ...rest}, ref) {
        return (
            <div
                ref={ref}
                className={[styles.card, className].filter(Boolean).join(" ")}
                {...rest}
            />
        );
    }
);
