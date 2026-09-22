// TypeScript/functional-component port of the legacy BackupFavorites.jsx
// (Phase 2, docs/UI_MIGRATION_PLAN.md). Despite living among the wallet-
// backup-named Settings files, this only exports the user's starred
// markets (favorite trading pairs) as JSON - no key material, no wallet
// state, no crypto. Read in full to confirm this before porting under
// the standard (non-wallet-sensitive) treatment, unlike its
// same-directory namesake `BackupSettings.jsx`.
import * as React from "react";
import {saveAs} from "file-saver";
import Translate from "react-translate-component";
import SettingsStore from "stores/SettingsStore";
import {Button} from "bitshares-ui-style-guide";
import {useAltStore} from "../../next/hooks/useAltStore";

export default function BackupFavorites() {
    const settingsState = useAltStore<any>(SettingsStore);
    const starredMarkets = settingsState.starredMarkets;

    function makeBackup() {
        const data = starredMarkets.toJS();

        const blob = new Blob([JSON.stringify(data)], {
            type: "application/json; charset=us-ascii"
        });

        saveAs(blob, "favorites.json");
    }

    return (
        <div>
            <p>
                <Translate content="settings.backup_favoritestext" />
            </p>
            <Button type="primary" onClick={makeBackup}>
                <Translate content="settings.backup_favoritesbtn" />
            </Button>
        </div>
    );
}
