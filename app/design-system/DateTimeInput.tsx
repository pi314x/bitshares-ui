import * as React from "react";
import counterpart from "counterpart";
import dateStyles from "./DatePicker.module.scss";
import styles from "./DateTimeInput.module.scss";

// A date and a time of day on a 24-hour clock. The browser's own `<input type="datetime-local">` writes the time the
// way the browser's language does (AM/PM in some), and a page cannot change that, not by `lang` either. So the date is
// the native date input, and the hour (00-23) and the minute are two selects: the same on every browser, and a wheel on
// a phone.
export interface DateTimeInputProps {
    /** "YYYY-MM-DDTHH:mm" as `datetime-local` writes it, or "" while there is no date. */
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    tabIndex?: number;
    className?: string;
    style?: React.CSSProperties;
    "aria-label"?: string;
}

const VALUE = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;
const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({length: 24}, (_, i) => pad(i));
const MINUTES = Array.from({length: 60}, (_, i) => pad(i));

const t = (key: string) => counterpart.translate(`datetime_input.${key}`);

/** The ref goes to the date input, which is the one `showPicker()` opens. */
export const DateTimeInput = React.forwardRef<
    HTMLInputElement,
    DateTimeInputProps
>(function DateTimeInput(
    {
        value,
        onChange,
        disabled,
        tabIndex,
        className,
        style,
        "aria-label": label
    },
    ref
) {
    const match = VALUE.exec(value);
    const date = match ? match[1] : "";
    // the time shown while there is no date yet: a date picked next gets it
    const [draft, setDraft] = React.useState({hour: "00", minute: "00"});
    const hour = match ? match[2] : draft.hour;
    const minute = match ? match[3] : draft.minute;

    const change = (nextDate: string, nextHour: string, nextMinute: string) => {
        setDraft({hour: nextHour, minute: nextMinute});
        onChange(nextDate ? `${nextDate}T${nextHour}:${nextMinute}` : "");
    };

    return (
        <div
            className={[styles.root, className].filter(Boolean).join(" ")}
            style={style}
            role="group"
            aria-label={label}
        >
            <input
                ref={ref}
                type="date"
                className={`${dateStyles.input} ${styles.date}`}
                value={date}
                disabled={disabled}
                tabIndex={tabIndex}
                aria-label={t("date")}
                onChange={e => change(e.target.value, hour, minute)}
            />
            <select
                className={styles.part}
                value={hour}
                disabled={disabled}
                aria-label={t("hour")}
                onChange={e => change(date, e.target.value, minute)}
            >
                {HOURS.map(h => (
                    <option key={h} value={h}>
                        {h}
                    </option>
                ))}
            </select>
            <span className={styles.colon} aria-hidden="true">
                :
            </span>
            <select
                className={styles.part}
                value={minute}
                disabled={disabled}
                aria-label={t("minute")}
                onChange={e => change(date, hour, e.target.value)}
            >
                {MINUTES.map(m => (
                    <option key={m} value={m}>
                        {m}
                    </option>
                ))}
            </select>
        </div>
    );
});
