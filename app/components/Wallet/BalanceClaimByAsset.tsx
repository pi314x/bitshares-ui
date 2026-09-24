// TypeScript/functional-component port of the legacy
// BalanceClaimByAsset.jsx (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical,
// no logic changes.
//
// The original's `UNSAFE_componentWillMount`/`UNSAFE_componentWillReceiveProps`
// pair (unconditional `setPubkeys` on mount, then only when
// `PrivateKeyStore`'s key set actually changes) is replicated with a
// `useRef`-tracked previous `keySeq`, checked synchronously in the render
// body on every render - the same semantics as the class lifecycle
// methods, which both run before paint. This pattern is duplicated
// (not extracted into a shared hook) in `BalanceClaimActive.tsx`, matching
// how the original duplicates it across both class components verbatim.
import * as React from "react";
import LoadingIndicator from "components/LoadingIndicator";
import PrivateKeyStore from "stores/PrivateKeyStore";
import BalanceClaimActiveStore from "stores/BalanceClaimActiveStore";
import BalanceClaimActiveActions from "actions/BalanceClaimActiveActions";
import FormattedAsset from "components/Utility/FormattedAsset";
import Translate from "react-translate-component";
import {Card} from "bitshares-ui-style-guide";
import {useAltStore} from "../../next/hooks/useAltStore";

export default function BalanceClaimByAsset({children}: {children?: any}) {
    const privateKeyState = useAltStore<any>(PrivateKeyStore as any);
    const existingKeysRef = React.useRef<any>(null);
    const keySeq = privateKeyState.keys.keySeq();
    if (
        existingKeysRef.current === null ||
        !keySeq.equals(existingKeysRef.current)
    ) {
        existingKeysRef.current = keySeq;
        (BalanceClaimActiveActions as any).setPubkeys(keySeq);
    }

    const storeState = useAltStore<any>(BalanceClaimActiveStore as any);
    const {loading, balances} = storeState;

    let total_by_asset;
    if (balances !== undefined)
        total_by_asset = balances
            .groupBy((v: any) => {
                // K E Y S
                return v.balance.asset_id;
            })
            .map((l: any) =>
                l.reduce(
                    (r: any, v: any) => {
                        // V A L U E S
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
                    {unclaimed: 0, vesting: {unclaimed: 0, total: 0}}
                )
            )
            .sortBy((k: any) => k);

    if (loading || balances === undefined)
        return (
            <div className="center-content">
                <p />
                <h5>
                    <Translate content="wallet.loading_balances" />
                    &hellip;
                </h5>
                <LoadingIndicator type="circle" />
            </div>
        );

    let content;
    if (!total_by_asset.size)
        content = (
            <h5>
                <Translate content="wallet.no_balance" />
            </h5>
        );
    else {
        let key = 0;
        content = (
            <span>
                <label>Unclaimed Balances</label>
                {total_by_asset
                    .map((r: any, asset: any) => (
                        <div key={key++}>
                            <FormattedAsset
                                color="info"
                                amount={r.unclaimed + r.vesting.unclaimed}
                                asset={asset}
                            />
                        </div>
                    ))
                    .valueSeq()
                    .toArray()}
                {children}
            </span>
        );
    }
    return <Card>{content}</Card>;
}
