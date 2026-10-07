import * as React from "react";
import moment from "moment";
import styles from "./DatePicker.module.scss";

// Twenty-fourth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md). Replaces `bitshares-ui-style-
// guide`'s `DatePicker` (antd v3) - the last of the components this
// migration deferred for its own build, following the same "grep every
// real call site first" discipline as the other twenty-three, including
// `Tabs`/`InputNumber`/`Collapse`'s precedent of accepting-but-no-op-ing
// a prop this component's native-HTML approach genuinely can't replicate
// rather than silently dropping it (documented per prop below).
//
// Grepped all 4 real call sites (`Modal/HtlcModal.tsx`, `PredictionMarkets
// /CreateMarketModal.tsx`, `Account/CreditOffer/CreateModal.tsx`/
// `EditModal.tsx`): every single one sets `showTime` - no real call site
// ever renders a bare date-only picker, though `showTime` is still a real
// prop here (defaulting to `false`) rather than assumed always-on, for
// API fidelity. `value`/`onChange` are always a `moment` object (or
// `null`) - every real `onChange` handler either reads a `moment`
// directly or explicitly checks `event instanceof moment`
// (`CreateMarketModal.tsx`'s `handleChange`), never antd's second
// `dateString` argument, so this component's `onChange` only ever passes
// the one argument. Rendered as a native `<input type="datetime-local">`
// (or `type="date"` when `showTime` is false) rather than a custom
// calendar grid - the same "native form element over a from-scratch
// recreation" choice as `InputNumber`/`Slider`, trading antd's popup
// calendar UI for the browser's own native date/time picker.
//
// Real-but-unsupportable props, accepted for API compatibility and
// documented as no-ops rather than silently dropped at the call site:
// - `locale` (real in `CreditOffer/CreateModal.tsx`/`EditModal.tsx`,
//   switching the calendar to Chinese via antd's `zh_CN` locale pack) -
//   a native date/time input's displayed language follows the browser's
//   own locale setting, not anything a component can control per-
//   instance, so this is accepted but has no effect.
// - `showToday` (real in `HtlcModal.tsx`, antd's "today" quick-select
//   link in the calendar popup) - no native equivalent; accepted,
//   ignored, same treatment as `Tabs`'s `animated` prop.
//
// `disabledDate` (real in `HtlcModal.tsx`/`CreditOffer/{Create,Edit}
// Modal.tsx`, always a simple min/max-style range check in practice) is
// enforced on change instead of in the picker UI itself: a native date
// input has no way to grey out individual disabled calendar cells, so a
// value failing `disabledDate` is simply rejected (the change is
// dropped, the field keeps its previous value) rather than calling
// `onChange` - behaviorally equivalent (the user still can never land on
// a disabled date), just without the visual hint.
//
// `HtlcModal.tsx`'s `ref={onDatepickerRef}` (an imperative reach into
// antd's internal DOM - `el.picker.input.readOnly = false`, forcing
// antd's own DatePicker, read-only by default, to accept direct typing)
// has no counterpart here and was dropped at that one call site: a
// native `<input type="datetime-local">` is never read-only to begin
// with, so the workaround's entire purpose is already satisfied by
// construction.
//
// UPDATE (`Exchange/ScaledOrderTab.tsx`'s managed-form-API rewrite):
// forwards its ref to the native `<input>` element (`React.forwardRef`,
// matching `Input`'s own established ref-to-native-DOM pattern) - added
// for that one real call site, which previously reached into antd's own
// `DatePicker` ref (`datePickerRef.current.picker.handleOpenChange(...)`,
// antd's own imperative open/close API for its calendar popup) to
// programmatically open the picker when a separate dropdown selects
// "Specific time". A native input's closest equivalent is
// `.showPicker()` - called at that one call site via the forwarded ref -
// with no native equivalent for closing it again; see that file's own
// comment for the resulting behavior change (documented, not silently
// dropped).
export interface DatePickerProps {
    value?: moment.Moment | null;
    onChange?: (value: moment.Moment | null) => void;
    /** Fired alongside `onChange` - antd's `showTime` popup has a
     * separate "OK" confirm step this native picker has no equivalent
     * for, so both fire together on every change (matching every real
     * call site, which passes the same handler to both). */
    onOk?: (value: moment.Moment | null) => void;
    showTime?: boolean;
    /** Accepted for API compatibility, no native equivalent - see this
     * file's header comment. */
    showToday?: boolean;
    /** Accepted for API compatibility, no native equivalent - see this
     * file's header comment. */
    locale?: unknown;
    disabledDate?: (current: moment.Moment) => boolean;
    placeholder?: string;
    disabled?: boolean;
    tabIndex?: number;
    className?: string;
    style?: React.CSSProperties;
}

const DATE_FORMAT = "YYYY-MM-DD";
const DATETIME_FORMAT = "YYYY-MM-DDTHH:mm";

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
    function DatePicker(
        {
            value,
            onChange,
            onOk,
            showTime,
            disabledDate,
            placeholder,
            disabled,
            tabIndex,
            className,
            style
        },
        ref
    ) {
        const format = showTime ? DATETIME_FORMAT : DATE_FORMAT;
        const displayValue =
            value && value.isValid() ? value.format(format) : "";

        function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
            const raw = e.target.value;
            if (!raw) {
                if (onChange) onChange(null);
                if (onOk) onOk(null);
                return;
            }
            const next = moment(raw, format);
            if (!next.isValid()) return;
            if (disabledDate && disabledDate(next)) return;
            if (onChange) onChange(next);
            if (onOk) onOk(next);
        }

        return (
            <input
                ref={ref}
                type={showTime ? "datetime-local" : "date"}
                className={[styles.input, className]
                    .filter(Boolean)
                    .join(" ")}
                style={style}
                value={displayValue}
                placeholder={placeholder}
                disabled={disabled}
                tabIndex={tabIndex}
                onChange={handleChange}
            />
        );
    }
);
