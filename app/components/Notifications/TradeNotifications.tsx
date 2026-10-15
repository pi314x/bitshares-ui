// Tells the user when one of their orders was (partly) filled: a toast, kept
// in the notification history. It reads the account's operation history from
// the chain store; the first read only sets the baseline (nothing is announced
// for what happened before the page opened), and what happened while the page
// was closed is announced once, the newest few.
import * as React from "react";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import {Notification} from "../../design-system/Notification";
import {HistoryEntry, newFills, newestSequence} from "../../lib/common/fills";

const KEY = (account: string) => `__graphene__lastFillNotified_${account}`;

function readBaseline(account: string): number | null {
    try {
        const v = window.localStorage.getItem(KEY(account));
        return v === null ? null : Number(v);
    } catch (e) {
        return null;
    }
}

function writeBaseline(account: string, value: number) {
    try {
        window.localStorage.setItem(KEY(account), String(value));
    } catch (e) {
        // announced again next time
    }
}

function amountText(amount: any): string {
    if (!amount) return "";
    const asset: any = (ChainStore as any).getAsset(amount.asset_id);
    if (!asset || typeof asset.get !== "function") {
        return `${amount.amount} ${amount.asset_id}`;
    }
    const precision: number = asset.get("precision");
    const value = Number(amount.amount) / Math.pow(10, precision);
    const digits = Math.min(precision, value >= 1000 ? 2 : value >= 1 ? 4 : 6);
    return `${value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits
    })} ${asset.get("symbol")}`;
}

export function TradeNotifications(): null {
    useChainStoreTick();
    const account = useReduxState<any>(selectAccountState);
    const name: string | null =
        account.currentAccount || account.passwordAccount || null;
    const baseline = React.useRef<{[name: string]: number}>({});

    const accountObject: any = name
        ? (ChainStore as any).getAccount(name)
        : null;
    const accountId: string | null =
        accountObject && typeof accountObject.get === "function"
            ? accountObject.get("id")
            : null;
    const history: any = accountObject ? accountObject.get("history") : null;

    React.useEffect(() => {
        if (!name || !accountId || !history || !history.toJS) return;
        const entries: HistoryEntry[] = history
            .toJS()
            .filter((e: any) => e && e.id && e.op);
        if (!entries.length) return;
        const newest = newestSequence(entries);
        let known = baseline.current[name];
        if (known === undefined) {
            // first look in this page: what the user was last told about, or,
            // with nothing stored, now
            const stored = readBaseline(name);
            known = stored === null ? newest : stored;
            baseline.current[name] = known;
        }
        const fills = newFills(entries, accountId, known, 3);
        fills.forEach(entry => {
            const op = entry.op[1];
            const pays = amountText(op.pays);
            const receives = amountText(op.receives);
            Notification.success({
                message: counterpart.translate(
                    "notification_center.trade_done"
                ),
                description: counterpart.translate(
                    op.is_maker
                        ? "notification_center.trade_sold_maker"
                        : "notification_center.trade_sold",
                    {pays, receives}
                )
            });
        });
        if (newest > known) {
            baseline.current[name] = newest;
            writeBaseline(name, newest);
        } else if (readBaseline(name) === null) {
            writeBaseline(name, known);
        }
    }, [name, accountId, history]);

    return null;
}

export default TradeNotifications;
