// Search in the recent activity: what a row says, as plain text, so that typing finds it. The text of an operation is
// its kind (as written on the label and as the chain names it), its id and block, and everything its fields hold with
// the ids read as the names people know them by - accounts as their names, assets as their symbols, an amount as the
// number the row shows ("820.211111 XBTSX.HIVE"). The fee and the memo are left out: the fee is on every row, and
// the memo is encrypted.

/** Smallest units -> "12.5" (no trailing zeros), the way the rows show an amount. */
function plainAmount(units: bigint, precision: number): string {
    const negative = units < BigInt(0);
    const abs = negative ? -units : units;
    // (no `**`: the build turns it into Math.pow, which is not for a bigint)
    let base = BigInt(1);
    for (let i = 0; i < precision; i++) base = base * BigInt(10);
    const fraction = (abs % base)
        .toString()
        .padStart(precision, "0")
        .replace(/0+$/, "");
    return `${negative ? "-" : ""}${abs / base}${
        fraction ? "." + fraction : ""
    }`;
}

export interface SearchEnv {
    /** the name of an account by its id; null while it is not loaded */
    account(id: string): string | null;
    /** the symbol and precision of an asset by its id; null while it is not loaded */
    asset(id: string): {symbol: string; precision: number} | null;
}

export interface SearchText {
    /** lower case */
    text: string;
    /** every account and asset it names was loaded (otherwise the text is built again later) */
    complete: boolean;
}

export interface SearchEntry {
    id: string;
    block_num?: number;
    op: [number | string, any];
}

const ACCOUNT = /^1\.2\.\d+$/;
const ASSET = /^1\.3\.\d+$/;
const LEFT_OUT = new Set(["fee", "memo", "extensions", "signatures"]);
const MAX_DEPTH = 6;

export function searchText(
    entry: SearchEntry,
    kind: {name: string; label: string},
    env: SearchEnv
): SearchText {
    const parts: string[] = [kind.label, kind.name, entry.id];
    if (entry.block_num !== undefined) parts.push(String(entry.block_num));
    let complete = true;

    const asset = (id: string): string => {
        const found = env.asset(id);
        if (!found) complete = false;
        return found ? found.symbol : id;
    };

    const walk = (value: any, depth: number) => {
        if (depth > MAX_DEPTH || value === null || value === undefined) return;
        if (typeof value === "string") {
            if (ACCOUNT.test(value)) {
                const name = env.account(value);
                if (!name) complete = false;
                parts.push(value);
                if (name) parts.push(name);
            } else if (ASSET.test(value)) {
                parts.push(value, asset(value));
            } else {
                parts.push(value);
            }
            return;
        }
        if (typeof value === "number") {
            parts.push(String(value));
            return;
        }
        if (Array.isArray(value)) {
            value.forEach(item => walk(item, depth + 1));
            return;
        }
        if (typeof value !== "object") return;
        // an amount: the number the row shows, and the symbol
        if (
            value.amount !== undefined &&
            typeof value.asset_id === "string" &&
            ASSET.test(value.asset_id)
        ) {
            const found = env.asset(value.asset_id);
            if (!found) complete = false;
            let shown = String(value.amount);
            if (found) {
                try {
                    shown = plainAmount(
                        BigInt(String(value.amount)),
                        found.precision
                    );
                } catch (e) {
                    // not a whole number: as it is
                }
            }
            parts.push(shown, found ? found.symbol : value.asset_id);
            return;
        }
        Object.keys(value).forEach(key => {
            if (!LEFT_OUT.has(key)) walk(value[key], depth + 1);
        });
    };
    walk(entry.op[1], 0);
    return {text: parts.join(" ").toLowerCase(), complete};
}

/** Whether every word typed is somewhere in the text (case does not matter; no word: everything matches). */
export function matchesQuery(text: string, query: string): boolean {
    const words = query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    return words.every(word => text.includes(word));
}
