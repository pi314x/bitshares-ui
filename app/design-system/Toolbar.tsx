import * as React from "react";
import styles from "./Toolbar.module.scss";

// The row of filter fields, option groups and buttons above a list or table.
// The legacy screens each laid theirs out by hand (inline-block fields with
// `marginLeft: 24px`, a float for a spinner), so no two lined up and on a phone
// they ran off the edge or stacked at random. One row that wraps:
//
//   <Toolbar>
//       <Toolbar.Grow><SearchInput .../></Toolbar.Grow>   // takes what is left
//       <Radio.Group>...</Radio.Group>                     // as wide as it is
//       <Toolbar.End><RowsSelect .../></Toolbar.End>       // pushed to the end
//   </Toolbar>
export interface ToolbarProps {
    children?: React.ReactNode;
    className?: string;
    /** Space under the toolbar (default: the standard 16px). */
    flush?: boolean;
}

function ToolbarRoot({children, className, flush}: ToolbarProps): JSX.Element {
    return (
        <div
            className={[styles.toolbar, flush ? styles.flush : "", className]
                .filter(Boolean)
                .join(" ")}
        >
            {children}
        </div>
    );
}

function Grow({children}: {children?: React.ReactNode}): JSX.Element {
    return <div className={styles.grow}>{children}</div>;
}

function End({children}: {children?: React.ReactNode}): JSX.Element {
    return <div className={styles.end}>{children}</div>;
}

export const Toolbar = Object.assign(ToolbarRoot, {Grow, End});
