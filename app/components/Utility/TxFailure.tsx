// A failed transaction, in words: when the error is a common case (an order the book could not fill
// whole, a floor that was missed, ...) one sentence says what it means and that nothing was spent;
// the node's own text stays under "Show details", wrapped, where it cannot run out of the box.
import * as React from "react";
import counterpart from "counterpart";
import {Alert} from "../../design-system/Alert";
import {txErrorExplanationKey} from "../../lib/common/txErrors";
import styles from "./OperationDialog.module.scss";

export function TxFailure({error}: {error: string}) {
    const [open, setOpen] = React.useState(false);
    const box = React.useRef<HTMLDivElement>(null);
    const key = txErrorExplanationKey(error);
    // a new failure starts closed, and is brought into view: in a tall dialog it is not where the
    // button was pressed
    React.useEffect(() => {
        setOpen(false);
        const node = box.current as any;
        if (node && typeof node.scrollIntoView === "function") {
            node.scrollIntoView({block: "nearest"});
        }
    }, [error]);
    if (!key) {
        return (
            <div ref={box}>
                <Alert
                    type="error"
                    showIcon
                    message={<span className={styles.wrap}>{error}</span>}
                />
            </div>
        );
    }
    return (
        <div ref={box}>
            <Alert
                type="error"
                showIcon
                message={
                    <span className={styles.wrap}>
                        {counterpart.translate(key) as string}
                    </span>
                }
                description={
                    <div className={styles.failureDetails}>
                        <button
                            type="button"
                            className={styles.linkButton}
                            aria-expanded={open}
                            onClick={() => setOpen(o => !o)}
                        >
                            {
                                counterpart.translate(
                                    open
                                        ? "operation_dialog.details_hide"
                                        : "operation_dialog.details_show"
                                ) as string
                            }
                        </button>
                        {open ? (
                            <pre className={styles.raw}>{error}</pre>
                        ) : null}
                    </div>
                }
            />
        </div>
    );
}
