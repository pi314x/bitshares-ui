// TypeScript/functional-component port of the legacy WalletSettings.jsx
// (Phase 2, docs/UI_MIGRATION_PLAN.md). Wallet-security-sensitive tier per
// AGENTS.md, handled last with extra care: minimal, mechanical hooks
// translation only, no logic changes. This file itself holds no key
// material and does no crypto - `ChangeActiveWallet`, `WalletDelete`, and
// `BalanceClaimActive` (all reused unchanged) hold the actual wallet
// switching/deletion/balance-claim logic, and the one direct call this
// file makes into wallet internals, `WalletDb.resetBrainKeySequence()`,
// is passed through to the untouched, already-audited `WalletDb` module
// exactly as before - only the local `lookupActive`/`resetMessage` UI
// state and the `deprecated`-mode branch are ported.
import * as React from "react";
import {ChangeActiveWallet, WalletDelete} from "../Wallet/WalletManager";
import BalanceClaimActive from "../Wallet/BalanceClaimActive";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import WalletDb from "stores/WalletDb";
import {Form, Button} from "bitshares-ui-style-guide";

const FormItem = Form.Item;

interface WalletSettingsProps {
    deprecated?: boolean;
}

export default function WalletSettings({deprecated}: WalletSettingsProps) {
    const [lookupActive, setLookupActive] = React.useState(false);
    const [resetMessage, setResetMessage] = React.useState<string | null>(
        null
    );

    function onLookup() {
        setLookupActive(true);
    }

    function onResetBrainkeySequence() {
        (WalletDb as any).resetBrainKeySequence();
        setResetMessage(
            counterpart.translate("wallet.brainkey_reset_success")
        );
    }

    if (deprecated) {
        return (
            <div>
                <ChangeActiveWallet />
                <WalletDelete />
            </div>
        );
    }

    return (
        <div>
            <ChangeActiveWallet />
            <WalletDelete />

            <FormItem
                label={counterpart.translate("wallet.balance_claims")}
                className="no-offset"
                style={{padding: "15px 0"}}
            >
                <div style={{paddingBottom: 10}}>
                    <Translate content="settings.lookup_text" />:
                </div>
                <Button onClick={onLookup}>
                    <Translate content="wallet.balance_claim_lookup" />
                </Button>
            </FormItem>

            {lookupActive ? <BalanceClaimActive /> : null}

            <FormItem
                label={counterpart.translate("wallet.brainkey_seq_reset")}
                className="no-offset"
                style={{paddingBottom: "15px"}}
            >
                <div style={{paddingBottom: 10}}>
                    <p>
                        <Translate
                            unsafe
                            content="wallet.brainkey_seq_reset_text"
                        />
                    </p>
                    <Button onClick={onResetBrainkeySequence}>
                        <Translate content="wallet.brainkey_seq_reset_button" />
                    </Button>
                    {resetMessage ? (
                        <p style={{paddingTop: 10}} className="facolor-success">
                            {resetMessage}
                        </p>
                    ) : null}
                </div>
            </FormItem>
        </div>
    );
}
