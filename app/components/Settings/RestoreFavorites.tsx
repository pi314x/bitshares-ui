// TypeScript/functional-component port of the legacy
// RestoreFavorites.jsx (Phase 2, docs/UI_MIGRATION_PLAN.md). Despite
// living among the wallet-restore-named Settings files, this only
// re-imports the user's starred markets (favorite trading pairs) from a
// JSON file - no key material, no wallet state, no crypto. Read in full
// to confirm this before porting under the standard (non-wallet-
// sensitive) treatment, unlike its same-directory namesake
// `RestoreSettings.jsx`.
import * as React from "react";
import Translate from "react-translate-component";
import SettingsActions from "actions/SettingsActions";
import counterpart from "counterpart";
import {Button, Notification} from "bitshares-ui-style-guide";

export default function RestoreFavorites() {
    const [json, setJson] = React.useState<any>(null);
    const [error, setError] = React.useState<boolean | null>(null);

    function upload(evt: React.ChangeEvent<HTMLInputElement>) {
        setError(false);
        setJson(null);

        const file = (evt.target.files as any)[0];
        const reader = new FileReader();
        reader.onload = (e: any) => {
            const contents = e.target.result;

            try {
                const parsed = JSON.parse(contents);

                for (const key in parsed) {
                    const market = parsed[key];
                    const {quote, base} = market;

                    if (!quote || !base)
                        throw new Error("Cannot parse json data.");
                }

                setJson(parsed);
                // this.finish();
            } catch (message) {
                setError(true);
            }
        };
        reader.readAsText(file);
    }

    function finish() {
        SettingsActions.clearStarredMarkets();

        for (const key in json) {
            const market = json[key];
            const {quote, base} = market;

            SettingsActions.addStarMarket(quote, base);
        }

        Notification.success({
            message: counterpart("settings.backup_favorites_success")
        });
    }

    return (
        <div>
            <input
                type="file"
                id="file_input"
                accept=".json"
                style={{
                    border: "solid",
                    marginBottom: 15
                }}
                onChange={upload}
            />

            {error && (
                <h5>
                    <Translate content="settings.backup_favorites_error" />
                </h5>
            )}

            {json && (
                <p>
                    <Button type={"primary"} onClick={finish}>
                        <Translate content="settings.backup_favorites_finish" />
                    </Button>
                </p>
            )}
        </div>
    );
}
