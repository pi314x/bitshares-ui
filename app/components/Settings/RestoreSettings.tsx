// TypeScript/functional-component port of the legacy RestoreSettings.jsx
// (Phase 2, docs/UI_MIGRATION_PLAN.md). Wallet-security-sensitive tier
// per AGENTS.md, handled last with extra care: minimal, mechanical hooks
// translation only, no logic changes. This file itself holds no key
// material and does no crypto - it's a tab switcher between
// `BackupRestore`, `ImportKeys`, and `CreateWalletFromBrainkey` (all
// untouched, in ../Wallet/Backup, ../Wallet/ImportKeys, and
// ../Wallet/WalletCreate, holding the actual wallet-file/key-import/
// brainkey-restore logic) and the already-ported, confirmed
// non-sensitive `RestoreFavorites`.
//
// The `default:` switch branch intentionally covers both the "key" and
// "legacy" types (indices 1 and 2 of `types`) by rendering the same
// `ImportKeys` component with `privateKey` toggled by whether
// `restoreType === 1` - preserved exactly as-is, not a bug.
import * as React from "react";
import {BackupRestore} from "../Wallet/Backup";
import ImportKeys from "../Wallet/ImportKeys";
import {CreateWalletFromBrainkey} from "../Wallet/WalletCreate";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import SettingsActions from "actions/SettingsActions";
import RestoreFavorites from "./RestoreFavorites";
import {Button, Select} from "bitshares-ui-style-guide";

const Option = Select.Option;

interface RestoreSettingsProps {
    passwordLogin?: boolean;
}

export default function RestoreSettings({
    passwordLogin
}: RestoreSettingsProps) {
    const types = ["backup", "key", "legacy", "brainkey", "favorites"];
    const [restoreType, setRestoreType] = React.useState(0);

    function setWalletMode() {
        SettingsActions.changeSetting({
            setting: "passwordLogin",
            value: false
        });
    }

    function changeType(value: string) {
        setRestoreType(types.indexOf(value));
    }

    if (passwordLogin) {
        return (
            <div>
                <Translate
                    content="settings.wallet_required"
                    component="h4"
                />
                <p className="dark-text-color">
                    <Translate content="settings.wallet_required_text" />:
                </p>

                <Button
                    type="primary"
                    className="button"
                    onClick={setWalletMode}
                >
                    <Translate content="settings.enable_wallet" />
                </Button>
            </div>
        );
    }

    const options = types.map(type => {
        return (
            <Option key={type} value={type}>
                {counterpart.translate(`settings.backup_${type}`)}{" "}
            </Option>
        );
    });

    let content;

    switch (types[restoreType]) {
        case "backup":
            content = (
                <div>
                    <BackupRestore />
                </div>
            );
            break;

        case "brainkey":
            content = (
                <div>
                    <p style={{maxWidth: "40rem", paddingBottom: 10}}>
                        <Translate content="settings.restore_brainkey_text" />
                    </p>
                    <CreateWalletFromBrainkey nested />
                </div>
            );
            break;

        case "favorites":
            content = (
                <div>
                    <RestoreFavorites />
                </div>
            );
            break;

        default:
            content = <ImportKeys privateKey={restoreType === 1} />;
            break;
    }

    return (
        <div>
            <Select
                onChange={changeType}
                className="bts-select"
                value={types[restoreType]}
            >
                {options}
            </Select>

            {content}
        </div>
    );
}
