import * as React from "react";
import styles from "./PageHead.module.scss";

// The head of a page: what it is (the title), what it is for (a lead of one or two
// sentences), an optional muted note under it, and the page's one main action. Every
// page that has a head draws it the same: the pages each sized their own (a 24px
// title with a 16px lead on one, a 22px with a 14.5px on the next, a second h1 inside
// a card on a third) and no two lined up.
//
//   <PageHead title="Voting" lead="..." action={<Button>Create lock</Button>} />
//
// The action sits at the end of the row; when the row is too narrow it goes under the
// text. `lead` and `note` are for text only; anything larger belongs in the page's
// own content.
export interface PageHeadProps {
    title: React.ReactNode;
    lead?: React.ReactNode;
    note?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
    /** Space under the head (default: the standard 16px). */
    flush?: boolean;
}

export function PageHead({
    title,
    lead,
    note,
    action,
    className,
    flush
}: PageHeadProps): JSX.Element {
    return (
        <div
            className={[styles.head, flush ? styles.flush : "", className]
                .filter(Boolean)
                .join(" ")}
        >
            <div className={styles.text}>
                <h1
                    className={[styles.title, lead ? styles.withLead : ""].join(
                        " "
                    )}
                >
                    {title}
                </h1>
                {lead ? <p className={styles.lead}>{lead}</p> : null}
                {note ? <p className={styles.note}>{note}</p> : null}
            </div>
            {action ? <div className={styles.action}>{action}</div> : null}
        </div>
    );
}
