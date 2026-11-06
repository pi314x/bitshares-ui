import * as React from "react";
import {RailIcon} from "./RailIcon";
import styles from "./Star.module.scss";

// The favourite star of a list row (a market, an account) and of its column header: the
// navigation rail's line star, filled and amber when it is on, the quiet outline when not (and
// amber under the pointer: it can be turned on). The lists each drew the legacy icon font's star
// in a hard-coded gold and grey, a different size from the header's star on the market page.
//
//   <Star on={starred} title="Add to favourites" />
export interface StarProps {
    on?: boolean;
    /** The width and height in px (16: the row's text height). */
    size?: number;
    title?: string;
    className?: string;
}

export function Star({
    on = false,
    size = 16,
    title,
    className
}: StarProps): JSX.Element {
    return (
        <span
            className={[styles.star, on ? styles.on : "", className]
                .filter(Boolean)
                .join(" ")}
            title={title}
        >
            <RailIcon name={on ? "star-filled" : "star"} size={size} />
        </span>
    );
}
