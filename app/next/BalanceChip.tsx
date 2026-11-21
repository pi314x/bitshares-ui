// The current account's balance of the core asset (BTS) in the top bar, with an eye to hide it: the amount is
// replaced by dots (a screen shared, a shoulder looked over) and the choice is remembered in the view settings.
// It sits in the top bar's `balance` slot, which shows it only while the bar has room for it.
//
// It follows the chain store, which is how everything else in the app follows the chain: the node pushes every
// changed object (a transfer, a fill, a fee, a new balance object), `AccountFreshness` reads the account again
// when a push was missed, and the chip is computed from the store on each such event, from the name of the
// account that is current at that moment - so it is new after every operation and the moment the account is
// switched. While the store has not loaded what it needs (an account just switched to) it says "…", never the
// amount of the account before or a zero that is not known.
import * as React from "react";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import SettingsActions from "actions/SettingsActions";
import {Icon} from "../design-system/Icon";
import {chainAsset, chainField} from "../lib/chain/chainLookup";
import {formatUnitsLocal} from "../lib/common/formatUnitsLocal";
import {useChainStoreTick} from "./hooks/useChainStoreTick";
import {useReduxState} from "./hooks/useReduxState";
import {selectAccountState} from "../store/slices/accountSlice";
import {selectSettingsState} from "../store/slices/settingsSlice";
import {selectIntlState} from "../store/slices/intlSlice";
import styles from "./BalanceChip.module.scss";

const CORE_ASSET = "1.3.0";
/** The view setting that says the amount is hidden. */
export const BALANCE_HIDDEN_KEY = "topbarBalanceHidden";
const MASK = "••••••";

export interface CoreBalance {
    amount: bigint;
    precision: number;
    symbol: string;
}

/**
 * The account's balance of the core asset; "loading" while the chain store has not loaded what it needs (the
 * account with its balances, the balance object, the asset); null where there is nothing to show (no account,
 * an account that does not exist). An account with no balance object of the core asset holds none: zero.
 */
export function coreBalance(
    accountName: string | null
): CoreBalance | "loading" | null {
    if (!accountName) return null;
    const account = ChainStore.getAccount(accountName);
    if (account === undefined) return "loading";
    if (!account || typeof account.get !== "function") return null;
    // an account the store knows only by name has no balances yet (the full account is on its way)
    const balances = account.get("balances");
    if (!balances || typeof balances.get !== "function") return "loading";
    const asset = chainAsset(CORE_ASSET);
    const precision = asset ? asset.get("precision") : undefined;
    const symbol = asset ? asset.get("symbol") : undefined;
    if (typeof precision !== "number" || typeof symbol !== "string") {
        return "loading";
    }
    const balanceId = balances.get(CORE_ASSET);
    const raw = balanceId ? chainField(balanceId, "balance") : 0;
    if (raw === null) return "loading";
    try {
        return {amount: BigInt(raw), precision, symbol};
    } catch (e) {
        return null;
    }
}

const translate = (key: string) =>
    counterpart.translate(`header.${key}`) as string;

export default function BalanceChip(): JSX.Element | null {
    useChainStoreTick();
    const account = useReduxState<{
        currentAccount: string | null;
        passwordAccount: string | null;
    }>(selectAccountState);
    const settings = useReduxState<{
        viewSettings: {get(key: string): unknown};
    }>(selectSettingsState);
    const intl = useReduxState<{currentLocale: string}>(selectIntlState);
    const balance = coreBalance(
        account.currentAccount || account.passwordAccount
    );
    if (balance === null) return null;
    const loading = balance === "loading";
    const hidden = !!settings.viewSettings.get(BALANCE_HIDDEN_KEY);
    const toggleLabel = translate(hidden ? "balance_show" : "balance_hide");
    const amount = loading
        ? "\u2026"
        : formatUnitsLocal(
              balance.amount,
              balance.precision,
              intl.currentLocale
          );
    return (
        <span
            className={styles.chip}
            role="group"
            aria-label={translate("balance")}
            title={translate("balance")}
            data-balance={loading ? "loading" : hidden ? "hidden" : "shown"}
        >
            <span className={styles.amount}>
                <span aria-hidden={hidden && !loading ? "true" : undefined}>
                    {hidden && !loading ? MASK : amount}
                </span>
                {!loading && (
                    <>
                        {" "}
                        <span className={styles.symbol}>{balance.symbol}</span>
                    </>
                )}
            </span>
            <button
                type="button"
                className={styles.eye}
                aria-label={toggleLabel}
                title={toggleLabel}
                onClick={() =>
                    SettingsActions.changeViewSetting({
                        [BALANCE_HIDDEN_KEY]: !hidden
                    })
                }
            >
                <Icon type={hidden ? "eye-off" : "eye"} />
            </button>
        </span>
    );
}
