// What a deposit screen needs to hand its address over: a button that copies a text
// (the address, the memo) and says it did, and the QR code as an image - the same
// image can be copied, saved, or pressed and held on a phone (a canvas offers none of
// that, an <img> does). `lib/common/clipboard.ts` is the part that talks to the browser.
import * as React from "react";
import counterpart from "counterpart";
import QRCode from "qrcode.react";
import {
    canCopyImage,
    copyImage,
    copyText,
    saveImage
} from "../../lib/common/clipboard";
import styles from "./DepositCopy.module.scss";

const t = (key: string) => counterpart.translate(`gateway.${key}`) as string;

type Feedback = "copied" | "saved" | "failed" | null;

/** Shows `feedback` for a moment, then clears it. */
function useFeedback(): [Feedback, (value: Feedback) => void] {
    const [value, setValue] = React.useState<Feedback>(null);
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    React.useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        []
    );
    const show = (next: Feedback) => {
        setValue(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setValue(null), 2500);
    };
    return [value, show];
}

const feedbackText = (value: Feedback): string =>
    value === "copied"
        ? t("copied")
        : value === "saved"
        ? t("qr_saved")
        : value === "failed"
        ? t("copy_failed")
        : "";

export interface CopyTextButtonProps {
    text: string;
    /** the label (a `gateway.*` key) */
    label: string;
}

export function CopyTextButton({text, label}: CopyTextButtonProps) {
    const [feedback, show] = useFeedback();
    return (
        <span className={styles.copyWrap}>
            <button
                type="button"
                className="button"
                onClick={() => {
                    copyText(text).then(ok => show(ok ? "copied" : "failed"));
                }}
            >
                {counterpart.translate(`gateway.${label}`) as string}
            </button>
            <span className={styles.feedback} role="status" aria-live="polite">
                {feedbackText(feedback)}
            </span>
        </span>
    );
}

export interface CopyOnTapProps {
    /** what goes on the clipboard */
    text: string;
    children: React.ReactNode;
}

/**
 * Text that copies itself when it is clicked or touched (or reached with the keyboard
 * and Enter / Space), and says so next to it. The deposit address and memo are shown
 * this way: a tap is the natural way to copy on a phone, and the text itself cannot
 * be selected on these screens.
 */
export function CopyOnTap({text, children}: CopyOnTapProps) {
    const [feedback, show] = useFeedback();
    const copy = () => {
        copyText(text).then(ok => show(ok ? "copied" : "failed"));
    };
    return (
        <span className={styles.tapWrap}>
            <span
                role="button"
                tabIndex={0}
                className={styles.tap}
                title={t("tap_to_copy")}
                aria-label={`${t("tap_to_copy")}: ${text}`}
                onClick={copy}
                onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        copy();
                    }
                }}
            >
                {children}
            </span>
            <span className={styles.feedback} role="status" aria-live="polite">
                {feedbackText(feedback)}
            </span>
        </span>
    );
}

export interface CopyableQrProps {
    value: string;
    size?: number;
}

export function CopyableQr({value, size = 160}: CopyableQrProps) {
    const holder = React.useRef<HTMLDivElement>(null);
    const [url, setUrl] = React.useState<string | null>(null);
    const [feedback, show] = useFeedback();

    // the code is drawn on a canvas that stays out of sight; what is shown is its image
    React.useEffect(() => {
        const canvas = holder.current
            ? holder.current.querySelector("canvas")
            : null;
        try {
            setUrl(canvas ? canvas.toDataURL("image/png") : null);
        } catch (e) {
            setUrl(null);
        }
    }, [value, size]);

    return (
        <div className={styles.qr}>
            <div ref={holder} className={styles.hidden} aria-hidden="true">
                <QRCode size={size * 2} value={value} />
            </div>
            {url ? (
                <img
                    className={`${styles.qrImage} ${styles.tap}`}
                    src={url}
                    width={size}
                    height={size}
                    alt={t("qr_alt")}
                    title={t(canCopyImage() ? "tap_qr_image" : "tap_qr_text")}
                    onClick={() => {
                        // an image where the browser can take one, else what the
                        // code says (the address)
                        if (canCopyImage()) {
                            copyImage(url, "deposit-qr.png").then(show);
                        } else {
                            copyText(value).then(ok =>
                                show(ok ? "copied" : "failed")
                            );
                        }
                    }}
                />
            ) : (
                <div
                    className={styles.qrImage}
                    style={{width: size, height: size}}
                />
            )}
            {url ? (
                <div className={styles.qrActions}>
                    <button
                        type="button"
                        className="button"
                        onClick={() => {
                            copyImage(url, "deposit-qr.png").then(result =>
                                show(result)
                            );
                        }}
                    >
                        {canCopyImage() ? t("copy_qr") : t("save_qr")}
                    </button>
                    {canCopyImage() ? (
                        <button
                            type="button"
                            className="button"
                            onClick={() =>
                                show(
                                    saveImage(url, "deposit-qr.png")
                                        ? "saved"
                                        : "failed"
                                )
                            }
                        >
                            {t("save_qr")}
                        </button>
                    ) : null}
                </div>
            ) : null}
            <span className={styles.feedback} role="status" aria-live="polite">
                {feedbackText(feedback)}
            </span>
            {url ? (
                <span className={styles.hint}>
                    {t(canCopyImage() ? "tap_qr_image" : "tap_qr_text")}
                    {canCopyImage() ? "" : ` ${t("qr_hold_hint")}`}
                </span>
            ) : null}
        </div>
    );
}
