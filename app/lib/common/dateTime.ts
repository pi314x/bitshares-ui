// A date and time as the viewer's locale writes the date, on a 24-hour clock. `Date.toLocaleString()` alone follows the
// locale's own habit, which is AM/PM in some ("11/16/2026, 9:36:42 PM"). `hourCycle: "h23"`, not `hour12: false`: that
// one writes midnight as "24:05:00" in some browsers.
const FIELDS: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
};

export function formatDateTime(value: Date | number | string): string {
    return new Date(value).toLocaleString(undefined, FIELDS);
}
