// "5 min ago" as a number and a unit: the caller says it in the user's words.
export type AgoUnit = "now" | "minutes" | "hours" | "days";

export function timeAgo(
    at: number,
    now: number = Date.now()
): {unit: AgoUnit; count: number} {
    const seconds = Math.max(0, Math.floor((now - at) / 1000));
    if (seconds < 45) return {unit: "now", count: 0};
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return {unit: "minutes", count: Math.max(1, minutes)};
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return {unit: "hours", count: hours};
    return {unit: "days", count: Math.floor(hours / 24)};
}
