// The detail of an operation the block explorer has no table of its own for: one
// row per field of the operation, the value in the form its kind asks for - an
// account or an asset as a link, an amount with its asset, a price as a price, a
// time as a time - and the JSON inspector only for what has no such form.
// (Before this, such an operation was a single JSON tree.)
import * as React from "react";
import Inspector from "react-json-inspector";
import moment from "moment";
import FormattedAsset from "../../Utility/FormattedAsset";
import FormattedPrice from "../../Utility/FormattedPrice";

const ACCOUNT_ID = /^1\.2\.\d+$/;
const ASSET_ID = /^1\.3\.\d+$/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/** "new_taker_fee_percent" -> "New taker fee percent" */
export function humanize(name: string): string {
    const words = name.replace(/_/g, " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
}

const isAmount = (v: any) =>
    v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    v.amount !== undefined &&
    typeof v.asset_id === "string";

const isPrice = (v: any) =>
    v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    isAmount(v.base) &&
    isAmount(v.quote);

export interface GenericHelpers {
    linkToAccount: (id: string) => React.ReactNode;
    linkToAsset: (id: string) => React.ReactNode;
}

/** The node for one value; null for "nothing to show" (an empty list, an empty set). */
export function valueNode(
    value: any,
    helpers: GenericHelpers
): React.ReactNode | null {
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") return String(value);
    if (typeof value === "string") {
        if (ACCOUNT_ID.test(value)) return helpers.linkToAccount(value);
        if (ASSET_ID.test(value)) return helpers.linkToAsset(value);
        if (TIME.test(value)) {
            return moment
                .utc(value)
                .local()
                .format("YYYY-MM-DD HH:mm:ss");
        }
        return value;
    }
    if (Array.isArray(value)) {
        if (!value.length) return null;
        if (value.every(v => typeof v === "string" || typeof v === "number")) {
            return value.join(", ");
        }
        return <Inspector data={value} search={false} />;
    }
    if (isAmount(value)) {
        return <FormattedAsset amount={value.amount} asset={value.asset_id} />;
    }
    if (isPrice(value)) {
        return (
            <FormattedPrice
                base_amount={value.base.amount}
                base_asset={value.base.asset_id}
                quote_amount={value.quote.amount}
                quote_asset={value.quote.asset_id}
            />
        );
    }
    return <Inspector data={value} search={false} />;
}

/** The rows (`<tr>`s) of an operation's fields; the fee has its own place. */
export function genericOperationRows(
    data: {[field: string]: any},
    helpers: GenericHelpers,
    firstKey = 0
): React.ReactNode[] {
    const rows: React.ReactNode[] = [];
    let key = firstKey;
    Object.keys(data || {}).forEach(field => {
        if (field === "fee") return;
        const node = valueNode(data[field], helpers);
        // an empty list or an empty set (extensions) says nothing
        if (node === null) return;
        rows.push(
            <tr key={key++}>
                <td>{humanize(field)}</td>
                <td>{node}</td>
            </tr>
        );
    });
    return rows;
}
