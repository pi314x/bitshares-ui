// TypeScript/functional-component port of the legacy
// BalanceClaimSelector.jsx (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical,
// no logic changes.
//
// The original's `UNSAFE_componentWillReceiveProps` (not `WillMount` - it
// does NOT run on the initial mount) auto-selects checkboxes for a newly
// arrived `claim_account_name`, reading the *incoming* props. Replicated
// with a "skip first render" ref plus the same computation run
// synchronously in the render body on every subsequent render, so it sees
// the same freshly-computed `claim_account_name`/`checked` values the
// original's `nextProps` held. `onClaimAccount`'s own
// `if (checked.size) return` guard (only auto-selects when nothing is
// selected yet) prevents this from looping.
//
// One deliberate, documented deviation: the original's `onClaimAccount`
// reads `this.props.total_by_account_asset` - which inside
// `UNSAFE_componentWillReceiveProps` is still the *previous* render's
// value, since React hasn't applied `nextProps` yet at that point. This
// port uses the current render's `total_by_account_asset` instead. The
// two are only observably different if `balances`/`address_to_pubkey`
// change in the very same store update as `claim_account_name` - and this
// component's only mount path (`BalanceClaimActive`) already gates
// rendering on `balances` being loaded, so that window isn't reachable in
// practice; the original's version would additionally crash (`.forEach`
// on `undefined`) the first time it were.
import * as React from "react";
import Immutable from "immutable";

import PrivateKeyStore from "stores/PrivateKeyStore";
import BalanceClaimActiveStore from "stores/BalanceClaimActiveStore";
import BalanceClaimActiveActions from "actions/BalanceClaimActiveActions";
import FormattedAsset from "components/Utility/FormattedAsset";
import Translate from "react-translate-component";
import {useAltStore} from "../../next/hooks/useAltStore";

export default function BalanceClaimSelector() {
    const storeState = useAltStore<any>(BalanceClaimActiveStore as any);
    const {balances, address_to_pubkey, claim_account_name} = storeState;
    const {checked} = storeState;

    const private_keys = (PrivateKeyStore as any).getState().keys;
    const groupCountMap = Immutable.Map().asMutable();
    const groupCount = (group: any, distinct: any) => {
        let set: any = groupCountMap.get(group);
        if (!set) {
            set = Immutable.Set().asMutable();
            groupCountMap.set(group, set);
        }
        set.add(distinct);
        return set.size;
    };

    let total_by_account_asset: any;
    if (balances)
        total_by_account_asset = balances
            .groupBy((v: any) => {
                // K E Y S
                let names = "";
                const pubkey = address_to_pubkey.get(v.owner);
                const private_key_object = private_keys.get(pubkey);
                // Imported Account Names (just a visual aid, helps to auto select a real account)
                if (
                    private_key_object &&
                    private_key_object.import_account_names
                )
                    names = private_key_object.import_account_names.join(", ");

                // Signing is very slow, further divide the groups based on the number of signatures required
                const batch_number = Math.ceil(
                    groupCount(
                        Immutable.List([names, v.balance.asset_id]),
                        v.owner
                    ) / 60
                );
                const name_asset_key = Immutable.List([
                    names,
                    v.balance.asset_id,
                    batch_number
                ]);
                return name_asset_key;
            })
            .map((l: any) =>
                l.reduce(
                    (r: any, v: any) => {
                        // V A L U E S
                        v.public_key_string = address_to_pubkey.get(v.owner);
                        r.balances = r.balances.add(v);
                        if (v.vested_balance != undefined) {
                            r.vesting.unclaimed += Number(
                                v.vested_balance.amount
                            );
                            r.vesting.total += Number(v.balance.amount);
                        } else {
                            r.unclaimed += Number(v.balance.amount);
                        }
                        return r;
                    },
                    {
                        unclaimed: 0,
                        vesting: {unclaimed: 0, total: 0},
                        balances: Immutable.Set()
                    }
                )
            )
            .sortBy((k: any) => k);

    const onClaimAccount = (claimAccountName: any, currentChecked: any) => {
        // A U T O  S E L E C T  A C C O U N T S
        // only if nothing is selected (play it safe)
        if (currentChecked.size) return;
        let newChecked = currentChecked;
        let index = -1;
        total_by_account_asset.forEach((v: any, k: any) => {
            index++;
            const name = k.get(0);
            if (name === claimAccountName) {
                if (v.unclaimed || v.vesting.unclaimed)
                    newChecked = newChecked.set(index, v.balances);
            }
        });
        if (newChecked.size)
            (BalanceClaimActiveActions as any).setSelectedBalanceClaims(
                newChecked
            );
    };

    const isFirstRenderRef = React.useRef(true);
    if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;
    } else if (claim_account_name && total_by_account_asset) {
        onClaimAccount(claim_account_name, checked);
    }

    const onCheckbox = (index: number, itemBalances: any) => {
        let newChecked = checked;
        if (newChecked.get(index)) {
            newChecked = newChecked.delete(index);
        } else {
            newChecked = newChecked.set(index, itemBalances);
        }

        (BalanceClaimActiveActions as any).setSelectedBalanceClaims(newChecked);
    };

    if (balances === undefined || !total_by_account_asset.size) return <div />;

    let index = -1;
    return (
        <div>
            <table className="table">
                <thead>
                    <tr>
                        <th>{/* C H E C K B O X */}</th>
                        <th style={{textAlign: "center"}}>
                            <Translate content="wallet.unclaimed" />
                        </th>
                        <th style={{textAlign: "center"}}>
                            <Translate content="wallet.unclaimed_vesting" />
                        </th>
                        <th style={{textAlign: "center"}}>
                            <Translate content="account.name" />
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {total_by_account_asset
                        .valueSeq()
                        .map((r: any, name_asset: any) => {
                            const rowIndex = ++index;
                            return (
                                <tr key={rowIndex}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={!!checked.get(rowIndex)}
                                            onChange={() =>
                                                onCheckbox(rowIndex, r.balances)
                                            }
                                        />
                                    </td>
                                    <td style={{textAlign: "right"}}>
                                        {r.unclaimed ? (
                                            <FormattedAsset
                                                color="info"
                                                amount={r.unclaimed}
                                                asset={name_asset.get(1)}
                                            />
                                        ) : null}
                                    </td>
                                    <td style={{textAlign: "right"}}>
                                        {r.vesting.unclaimed ? (
                                            <div>
                                                <FormattedAsset
                                                    color="info"
                                                    amount={r.vesting.unclaimed}
                                                    hide_asset={true}
                                                    asset={name_asset.get(1)}
                                                />
                                                <span> of </span>
                                                <FormattedAsset
                                                    color="info"
                                                    amount={r.vesting.total}
                                                    asset={name_asset.get(1)}
                                                />
                                            </div>
                                        ) : null}
                                    </td>
                                    <td> {name_asset.get(0)} </td>
                                </tr>
                            );
                        })
                        .toArray()}
                </tbody>
            </table>
        </div>
    );
}
