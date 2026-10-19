// Tells the user when one of their orders was (partly) filled: a toast, kept
// in the notification history. It reads the account's operation history from
// the chain store; the first read only sets the baseline (nothing is announced
// for what happened before the page opened), and what happened while the page
// was closed is announced once, the newest few.
import * as React from "react";
import counterpart from "counterpart";
import {ChainStore, FetchChain} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import {Notification} from "../../design-system/Notification";
import {
    HistoryEntry,
    formatAssetAmount,
    newFills,
    newestSequence
} from "../../lib/common/fills";

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

// The asset of an amount as far as the chain store knows it now.
function knownAsset(
    assetId: string
): {symbol: string; precision: number} | null {
    const asset: any = (ChainStore as any).getAsset(assetId);
    if (!asset || typeof asset.get !== "function") return null;
    return {symbol: asset.get("symbol"), precision: asset.get("precision")};
}

// An amount with its asset's name and precision. An asset the store has not
// loaded yet is asked for first (the fill used to be announced as "545967
// 1.3.120"); when it cannot be had, the raw amount is all there is.
async function amountText(amount: any): Promise<string> {
    if (!amount) return "";
    if (!knownAsset(amount.asset_id) && amount.asset_id !== "1.3.0") {
        try {
            await FetchChain("getAsset", amount.asset_id);
        } catch (e) {
            // announced with what is known
        }
    }
    return formatAssetAmount(amount, knownAsset(amount.asset_id));
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
            Promise.all([amountText(op.pays), amountText(op.receives)]).then(
                ([pays, receives]) => {
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
                }
            );
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
