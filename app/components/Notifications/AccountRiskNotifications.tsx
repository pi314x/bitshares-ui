// Tells the user, once, when a borrow position of the connected account is getting close to a margin call: it
// reaches "watch" (the collateral's price may fall 25% before the call), "danger" (10%) or is called (below the
// maintenance ratio). The Dashboard shows the same figures; this puts them in the bell (and a toast) while the app
// is open, because a position is lost when nobody is looking. What was told is remembered per position in this
// browser (`lib/common/riskAlerts.ts`), so a reload does not repeat it.
import * as React from "react";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import {Notification} from "../../design-system/Notification";
import {
    PositionRisk,
    positionInputFromChain,
    positionRisk
} from "../../lib/common/desk";
import {
    RiskAlert,
    RiskMemory,
    forgetPositions,
    parseRiskMemory,
    riskAlerts
} from "../../lib/common/riskAlerts";

const KEY = (account: string) => `__graphene__riskAlerts_${account}`;

function readMemory(account: string): RiskMemory {
    try {
        const raw = window.localStorage.getItem(KEY(account));
        return raw ? parseRiskMemory(JSON.parse(raw)) : {};
    } catch (e) {
        return {};
    }
}

function writeMemory(account: string, memory: RiskMemory) {
    try {
        window.localStorage.setItem(KEY(account), JSON.stringify(memory));
    } catch (e) {
        // told again next time
    }
}

const isMap = (x: any): boolean => !!x && typeof x.get === "function";

/** The positions of the account that are loaded, with how close each is to a call. */
function risksOf(account: any): Array<PositionRisk & {symbol: string}> {
    if (!isMap(account) || !account.get("call_orders")) return [];
    const out: Array<PositionRisk & {symbol: string}> = [];
    account.get("call_orders").forEach((callId: string) => {
        const call: any = (ChainStore as any).getObject(callId);
        if (!isMap(call)) return;
        const collateral: any = (ChainStore as any).getAsset(
            call.getIn(["call_price", "base", "asset_id"])
        );
        const debt: any = (ChainStore as any).getAsset(
            call.getIn(["call_price", "quote", "asset_id"])
        );
        // not loaded yet: the chain store asks for it and tells us when it is there
        if (!isMap(collateral) || !isMap(debt)) return;
        out.push({
            ...positionRisk(positionInputFromChain(call, collateral, debt)),
            symbol: debt.get("symbol")
        });
    });
    return out;
}

const percent = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

function say(
    alert: RiskAlert
): {
    kind: "warning" | "error";
    title: string;
    description: string;
} {
    const t = (key: string, params?: {[name: string]: string}) =>
        counterpart.translate(`notification_center.${key}`, params) as string;
    const ratio = percent(alert.ratio);
    if (alert.level === "called") {
        return {
            kind: "error",
            title: t("risk_called_title"),
            description: t("risk_called", {
                symbol: alert.symbol,
                ratio,
                mcr: alert.mcr === null ? "" : percent(alert.mcr)
            })
        };
    }
    return {
        kind: alert.level === "danger" ? "error" : "warning",
        title: t(
            alert.level === "danger" ? "risk_danger_title" : "risk_watch_title"
        ),
        description: t("risk_watch", {
            symbol: alert.symbol,
            ratio,
            distance: percent(alert.distance === null ? 0 : alert.distance, 1)
        })
    };
}

export function AccountRiskNotifications(): null {
    useChainStoreTick();
    const account = useReduxState<any>(selectAccountState);
    const name: string | null =
        account.currentAccount || account.passwordAccount || null;
    const memory = React.useRef<{[name: string]: RiskMemory}>({});

    const accountObject: any = name
        ? (ChainStore as any).getAccount(name)
        : null;
    const risks = risksOf(accountObject);
    // the effect runs when what it reads changes: a position's id and where it stands
    const key = risks
        .map(
            r =>
                `${r.id}:${r.ratio === null ? "-" : r.ratio.toFixed(3)}:${
                    r.risk
                }`
        )
        .join("|");

    // the positions the account has, whether or not they are loaded yet (null: the account is not loaded)
    const present: string[] | null =
        isMap(accountObject) && accountObject.get("call_orders")
            ? accountObject.get("call_orders").toJS()
            : null;

    React.useEffect(() => {
        if (!name || !present) return;
        const before = memory.current[name] || readMemory(name);
        const out = riskAlerts(before, risks);
        const kept = forgetPositions(out.memory, present);
        memory.current[name] = kept;
        if (JSON.stringify(kept) !== JSON.stringify(before)) {
            writeMemory(name, kept);
        }
        out.alerts.forEach(alert => {
            const note = say(alert);
            Notification[note.kind]({
                message: note.title,
                description: note.description
            });
        });
    }, [name, key, present ? present.join(",") : "-"]);

    return null;
}

export default AccountRiskNotifications;
