// Tells the user what happened to the connected account: every operation the chain recorded
// for it - a transfer in or out, an order placed, filled or cancelled, a settlement, a margin
// call, a vote - as an entry in the notification history (the bell). The newest few that the
// account did not start itself also show as a toast (what it started, the app has already
// confirmed). It reads the account's operation history from the chain store; the first read
// only sets the baseline (nothing is announced for what happened before the user first came),
// and what happened while the page was closed is announced once, the newest ones.
import * as React from "react";
import counterpart from "counterpart";
import {ChainStore, ChainTypes} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import {Notification} from "../../design-system/Notification";
import {recordNotification} from "../../lib/common/notificationHistory";
import {
    loadTelegram,
    subscribeTelegram,
    telegramNotify
} from "../../lib/common/telegram";
import SametFundActions from "../../actions/SametFundActions";
import {HistoryEntry, newestSequence} from "../../lib/common/fills";
import {
    ActivityContext,
    ActivityNote,
    describeActivity,
    newOperations,
    referencedIds
} from "../../lib/common/accountActivity";

const KEY = (account: string) => `__graphene__lastActivityNotified_${account}`;
// what Telegram was told is its own baseline: the other accounts are told about there, and not in the bell
const TELEGRAM_KEY = (account: string) =>
    `__graphene__lastTelegramNotified_${account}`;
// the newest this many that the account did not start show as toasts; all go in the history
const TOASTS = 3;
const KEPT = 30;

function readBaseline(key: string): number | null {
    try {
        const v = window.localStorage.getItem(key);
        return v === null ? null : Number(v);
    } catch (e) {
        return null;
    }
}

function writeBaseline(key: string, value: number) {
    try {
        window.localStorage.setItem(key, String(value));
    } catch (e) {
        // announced again next time
    }
}

// what the chain was asked for already: names do not change
const assets = new Map<string, {symbol: string; precision: number}>();
const accounts = new Map<string, string>();

// The assets and accounts the operations name, asked for in one request each (not through the
// chain store: that would subscribe to every account the user ever paid).
async function lookUp(entries: HistoryEntry[]): Promise<void> {
    const wanted = referencedIds(entries);
    const missingAssets = wanted.assets.filter(id => !assets.has(id));
    const missingAccounts = wanted.accounts.filter(id => !accounts.has(id));
    await Promise.all([
        missingAssets.length
            ? SametFundActions.getAssets(missingAssets)
                  .then(found =>
                      Object.keys(found).forEach(id =>
                          assets.set(id, {
                              symbol: found[id].symbol,
                              precision: found[id].precision
                          })
                      )
                  )
                  .catch(() => undefined)
            : undefined,
        missingAccounts.length
            ? SametFundActions.getAccounts(missingAccounts)
                  .then(found =>
                      Object.keys(found).forEach(id =>
                          accounts.set(id, found[id].name)
                      )
                  )
                  .catch(() => undefined)
            : undefined
    ]);
}

const OP_NAMES: {[code: number]: string} = {};
function opName(code: number): string | undefined {
    if (!Object.keys(OP_NAMES).length) {
        const operations: {[name: string]: number} = (ChainTypes as any)
            .operations;
        Object.keys(operations).forEach(name => {
            OP_NAMES[operations[name]] = name;
        });
    }
    return OP_NAMES[code];
}

function contextFor(accountId: string): ActivityContext {
    return {
        accountId,
        opName,
        assetOf: id =>
            assets.get(id) ||
            (id === "1.3.0" ? {symbol: "BTS", precision: 5} : null),
        accountName: id => accounts.get(id),
        t: (key, params) =>
            counterpart.translate(
                `notification_center.${key}`,
                params
            ) as string,
        // the shim has no `fallback` option: an operation without a name in the locale is shown by
        // the chain's own name
        typeLabel: name => {
            const text = counterpart.translate(
                `transaction.trxTypes.${name}`
            ) as string;
            return !text || /^missing translation/.test(text) ? name : text;
        }
    };
}

/**
 * Watches the operations of the account `name` and hands those the user was not told about yet, as notes (oldest
 * first), to `deliver`. The first look only sets the baseline (nothing is announced for what happened before),
 * and what happened while the page was closed is announced once, the newest ones.
 */
function useFreshActivity(
    name: string | null,
    keyFor: (account: string) => string,
    deliver: (notes: ActivityNote[], accountName: string) => void
): void {
    useChainStoreTick();
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
            const stored = readBaseline(keyFor(name));
            known = stored === null ? newest : stored;
            baseline.current[name] = known;
        }
        const fresh = newOperations(entries, known, KEPT);
        // the baseline moves now, before the names are fetched: a second change of the
        // history while they are on their way must not announce the same operations twice
        if (newest > known) {
            baseline.current[name] = newest;
            writeBaseline(keyFor(name), newest);
        } else if (readBaseline(keyFor(name)) === null) {
            writeBaseline(keyFor(name), known);
        }
        if (!fresh.length) return;
        lookUp(fresh).then(() => {
            const ctx = contextFor(accountId);
            deliver(
                fresh.map(entry => describeActivity(entry, ctx)),
                name
            );
        });
    }, [name, accountId, history]);
}

/** What happened to the account of the page, in toasts and the bell, and to Telegram. */
export function AccountActivityNotifications(): null {
    const account = useReduxState<any>(selectAccountState);
    const name: string | null =
        account.currentAccount || account.passwordAccount || null;
    useFreshActivity(name, KEY, (notes, accountName) => {
        // the toasts are the newest of those the account did not start itself
        let toasts = 0;
        const toast = new Set<number>();
        for (let i = notes.length - 1; i >= 0 && toasts < TOASTS; i--) {
            if (!notes[i].mine) {
                toast.add(i);
                toasts++;
            }
        }
        notes.forEach((note, i) => {
            if (toast.has(i)) {
                Notification[note.kind]({
                    message: note.title,
                    description: note.description || undefined,
                    to: note.link
                });
            } else {
                recordNotification(
                    note.kind,
                    note.title,
                    note.description,
                    Date.now(),
                    note.link
                );
            }
        });
        tellTelegram(notes, accountName);
    });
    return null;
}

function tellTelegram(notes: ActivityNote[], accountName: string) {
    telegramNotify(
        accountName,
        notes.map(note => ({
            topic: note.topic,
            title: note.title,
            description: note.description,
            link: note.link
        }))
    );
}

function TelegramWatch({name}: {name: string}): null {
    useFreshActivity(name, TELEGRAM_KEY, tellTelegram);
    return null;
}

/**
 * Tells Telegram about the other accounts of the user too (the one of the page is watched above): a
 * wallet that is not the one on screen is still "his wallet". Nothing is watched while Telegram is not set up.
 */
export function TelegramActivity(): null {
    const account = useReduxState<any>(selectAccountState);
    const current: string | null =
        account.currentAccount || account.passwordAccount || null;
    const [on, setOn] = React.useState(() => loadTelegram().enabled);
    React.useEffect(() => {
        setOn(loadTelegram().enabled);
        return subscribeTelegram(() => setOn(loadTelegram().enabled));
    }, []);
    const mine = account.myActiveAccounts;
    const names: string[] = !on
        ? []
        : (mine && typeof mine.toArray === "function"
              ? mine.toArray()
              : Array.from(mine || [])
          ).filter((n: any) => typeof n === "string" && n !== current);
    // (rendered as components, one watch for each account: a hook cannot be called in a loop)
    return (names.length
        ? React.createElement(
              React.Fragment,
              null,
              names.map(n =>
                  React.createElement(TelegramWatch, {key: n, name: n})
              )
          )
        : null) as any;
}

export default AccountActivityNotifications;
