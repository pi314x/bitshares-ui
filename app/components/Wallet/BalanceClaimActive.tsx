// TypeScript/functional-component port of the legacy BalanceClaimActive.jsx
// (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Same `setPubkeys`-on-`PrivateKeyStore`-key-change lifecycle pattern as
// `BalanceClaimByAsset.tsx` (duplicated here too, matching how the
// original duplicates it across both class components).
//
// Security-sensitive per AGENTS.md: `onClaimBalance` calls the real
// transaction-broadcasting `WalletActions.importBalance(...,
// true /*broadcast*/)` exactly as before - nothing new logged.
import * as React from "react";
import Immutable from "immutable";
import cname from "classnames";
import counterpart from "counterpart";

import LoadingIndicator from "components/LoadingIndicator";
import PrivateKeyStore from "stores/PrivateKeyStore";
import AccountRefsStore from "stores/AccountRefsStore";
import BalanceClaimActiveStore from "stores/BalanceClaimActiveStore";
import BalanceClaimActiveActions from "actions/BalanceClaimActiveActions";
import BalanceClaimSelector from "components/Wallet/BalanceClaimSelector";
import WalletActions from "actions/WalletActions";
import MyAccounts from "components/Forms/MyAccounts";
import Translate from "react-translate-component";
import {Notification} from "bitshares-ui-style-guide";
import {useAltStore} from "../../next/hooks/useAltStore";

export default function BalanceClaimActive() {
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
    const {
        loading,
        balances,
        selected_balances,
        claim_account_name
    } = storeState;
    const account_refs = (AccountRefsStore as any).getAccountRefs();

    const onBack = (e: any) => {
        e.preventDefault();
        window.history.back();
    };

    const onClaimAccountChange = (claimAccountName: any) => {
        (BalanceClaimActiveActions as any).claimAccountChange(claimAccountName);
    };

    const onClaimBalance = () => {
        (WalletActions as any)
            .importBalance(
                claim_account_name,
                selected_balances,
                true //broadcast
            )
            .catch((error: any) => {
                console.error("claimBalance", error);
                let message = error;
                try {
                    message = error.data.message;
                } catch (e) {}
                Notification.error({
                    message: counterpart.translate(
                        "notifications.balance_claim_error",
                        {
                            error_msg: message
                        }
                    )
                });

                throw error;
            });
    };

    if (!account_refs.size) {
        return (
            <div>
                <h5>
                    <Translate content="wallet.no_balance" />
                </h5>
            </div>
        );
    }

    if (loading) {
        return (
            <div>
                <br />
                <h5>
                    <Translate content="wallet.loading_balances" />
                    &hellip;
                </h5>
                <br />
                <LoadingIndicator type="three-bounce" />
            </div>
        );
    }

    if (!balances || !balances.size) {
        return (
            <div>
                <br />
                <h5>
                    <Translate content="wallet.no_balance" />
                </h5>
            </div>
        );
    }

    const import_ready = selected_balances.size && claim_account_name;
    const claim_balance_label = import_ready
        ? ` (${claim_account_name})`
        : null;

    return (
        <div>
            <div className="content-block center-content">
                <h3 className="no-border-bottom">
                    <Translate content="wallet.claim_balances" />
                </h3>
            </div>
            <div className="grid-block vertical">
                <div
                    className="grid-content"
                    style={{overflowY: "hidden !important" as any}}
                >
                    <div className="full-width-content center-content">
                        <MyAccounts
                            key={balances}
                            accounts={Immutable.List(account_refs)}
                            onChange={onClaimAccountChange}
                        />
                    </div>
                    <br />
                </div>
                <br />
                <BalanceClaimSelector />
            </div>
            <br />
            <br />
            <div
                className={cname("button success", {
                    disabled: !import_ready
                })}
                onClick={onClaimBalance}
            >
                <Translate content="wallet.claim_balance" />
                {claim_balance_label}
            </div>
            <div className="button cancel" onClick={onBack}>
                <Translate content="wallet.cancel" />
            </div>
        </div>
    );
}
