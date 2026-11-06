import * as React from "react";
import styles from "./ButtonRow.module.scss";

// The buttons of a form or a card: Save / Reset / Remove, Submit / Cancel. The legacy
// screens spaced theirs with an inline `marginLeft` on the second button, so when the row
// ran out of room a button went to the next line with its margin and stood indented, and
// the gap differed from screen to screen. One row that wraps, with one gap and no
// margins on the buttons themselves:
//
//   <ButtonRow>
//       <Button variant="accent">Save</Button>
//       <Button>Reset</Button>
//   </ButtonRow>
export interface ButtonRowProps {
    children?: React.ReactNode;
    /** The buttons at the right end of the row (a dialog's footer does that). */
    end?: boolean;
    /** Space above it, for a row that follows a field (16px). */
    spaced?: boolean;
    className?: string;
}

export function ButtonRow({
    children,
    end,
    spaced,
    className
}: ButtonRowProps): JSX.Element {
    return (
        <div
            className={[
                styles.row,
                end ? styles.end : "",
                spaced ? styles.spaced : "",
                className
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {children}
        </div>
    );
}
