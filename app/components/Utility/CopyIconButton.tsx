// A small icon button that puts a piece of text (an operation id, a hash) on the
// clipboard and says that it did: the clipboard icon turns into a check for a
// moment, or into a warning when the browser refused. `copyText` works over
// plain http too, where `navigator.clipboard` does not exist.
import * as React from "react";
import counterpart from "counterpart";
import {Icon} from "../../design-system/Icon";
import {copyText} from "../../lib/common/clipboard";
import styles from "./CopyIconButton.module.scss";

type CopyState = "idle" | "copied" | "failed";

interface CopyIconButtonProps {
    text: string;
    /** How long the answer ("Copied") stays, in ms. */
    resetAfter?: number;
}

const t = (key: string) =>
    counterpart.translate(`icons.clippy.${key}`) as string;

export default function CopyIconButton({
    text,
    resetAfter = 1500
}: CopyIconButtonProps) {
    const [state, setState] = React.useState<CopyState>("idle");
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        []
    );

    const onClick = (event: React.MouseEvent) => {
        // the id sits in a row that opens something on click
        event.stopPropagation();
        copyText(text).then(ok => {
            setState(ok ? "copied" : "failed");
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setState("idle"), resetAfter);
        });
    };

    const label =
        state === "copied"
            ? t("copied")
            : state === "failed"
            ? t("copy_failed")
            : t("copy");

    return (
        <button
            type="button"
            className={[
                styles.button,
                state === "copied" ? styles.copied : "",
                state === "failed" ? styles.failed : ""
            ]
                .filter(Boolean)
                .join(" ")}
            onClick={onClick}
            title={label}
            aria-label={`${label}: ${text}`}
        >
            <Icon
                type={
                    state === "copied"
                        ? "check"
                        : state === "failed"
                        ? "warning"
                        : "copy"
                }
            />
        </button>
    );
}
