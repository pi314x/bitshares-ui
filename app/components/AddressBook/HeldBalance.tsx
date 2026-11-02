// On the card of an address book entry that is for an asset: what the logged in account holds of that asset - what
// a withdrawal of it can take. Read from the chain store, like the balances of the Dashboard; nothing while the
// account or the asset is not loaded, and nothing without an account.
import * as React from "react";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import {formatAssetAmount} from "../../lib/common/fills";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import styles from "./AddressBook.module.scss";

export interface HeldBalanceProps {
    /** the symbol of the asset */
    symbol: string;
}

/** The units the account holds of the asset (0 when it holds none); null until it is known. */
export function heldUnits(account: any, assetId: string): number | null {
    if (!account || typeof account.get !== "function") return null;
    const balances = account.get("balances");
    if (!balances) return null;
    let units: number | null = 0;
    let pending = false;
    balances.forEach((balanceId: string) => {
        const balance: any = (ChainStore as any).getObject(balanceId);
        if (!balance || typeof balance.get !== "function") {
            // (balance objects arrive one by one after the account)
            pending = true;
            return;
        }
        if (balance.get("asset_type") === assetId) {
            // (an empty balance comes as the number 0)
            units = parseInt(String(balance.get("balance") || 0), 10) || 0;
        }
    });
    // a balance object that is not there yet may be the one: it is not known until they all are
    return units === 0 && pending ? null : units;
}

export default function HeldBalance({
    symbol
}: HeldBalanceProps): JSX.Element | null {
    useChainStoreTick();
    const accountState = useReduxState<any>(selectAccountState);
    const name = accountState.currentAccount || accountState.passwordAccount;
    if (!name) return null;
    const account = (ChainStore as any).getAccount(name);
    const asset = (ChainStore as any).getAsset(symbol);
    if (!asset || typeof asset.get !== "function") return null;
    const units = heldUnits(account, asset.get("id"));
    if (units === null) return null;
    return (
        <p className={styles.memo}>
            <span className={styles.memoLabel}>
                {counterpart.translate("address_book.balance")}
            </span>{" "}
            <span>
                {formatAssetAmount(
                    {amount: String(units), asset_id: asset.get("id")},
                    {
                        symbol: asset.get("symbol"),
                        precision: asset.get("precision")
                    }
                )}
            </span>
        </p>
    );
}
