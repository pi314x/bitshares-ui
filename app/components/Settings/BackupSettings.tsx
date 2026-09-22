// TypeScript/functional-component port of the legacy BackupSettings.jsx
// (Phase 2, docs/UI_MIGRATION_PLAN.md). Wallet-security-sensitive tier
// per AGENTS.md, handled last with extra care: minimal, mechanical hooks
// translation only, no logic changes. This file itself holds no key
// material and does no crypto - it's a tab switcher between
// `BackupCreate` and `BackupBrainkey` (both untouched, in
// ../Wallet/Backup and ../Wallet/BackupBrainkey, holding the actual
// wallet-file/brainkey backup logic) and the already-ported, confirmed
// non-sensitive `BackupFavorites`.
import * as React from "react";
import {BackupCreate} from "../Wallet/Backup";
import BackupBrainkey from "../Wallet/BackupBrainkey";
import counterpart from "counterpart";
import BackupFavorites from "./BackupFavorites";
import {Select} from "bitshares-ui-style-guide";

const Option = Select.Option;

export default function BackupSettings() {
    const types = ["backup", "brainkey", "favorites"];
    const [restoreType, setRestoreType] = React.useState(0);

    function changeType(value: string) {
        setRestoreType(types.indexOf(value));
    }

    const options = types.map(type => {
        return (
            <Option key={type} value={type}>
                {counterpart.translate(`settings.backupcreate_${type}`)}{" "}
            </Option>
        );
    });

    let content;

    switch (types[restoreType]) {
        case "backup":
            content = <BackupCreate />;
            break;

        case "brainkey":
            content = <BackupBrainkey />;
            break;

        case "favorites":
            content = <BackupFavorites />;
            break;

        default:
            break;
    }

    return (
        <div>
            <Select
                onChange={changeType}
                className="bts-select"
                value={types[restoreType]}
                style={{marginBottom: "16px"}}
            >
                {options}
            </Select>

            {content}
        </div>
    );
}
