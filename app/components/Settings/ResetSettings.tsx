// TypeScript/functional-component port of the legacy ResetSettings.jsx
// (the Settings screen's "reset" tab - a button that clears all stored
// settings and navigates away). Phase 2, docs/UI_MIGRATION_PLAN.md. Local
// UI-state-only, no wallet or signing involvement.
import * as React from "react";
import counterpart from "counterpart";
import Translate from "react-translate-component";
import SettingsActions from "actions/SettingsActions";
import {Button} from "bitshares-ui-style-guide";
import willTransitionTo from "../../routerTransition";

export default function ResetSettings() {
    const [message, setMessage] = React.useState<string | null>(null);
    const timerRef = React.useRef<ReturnType<typeof setTimeout>>();

    React.useEffect(() => {
        return () => clearTimeout(timerRef.current);
    }, []);

    function setMessageWithTimeout(key: string) {
        setMessage(counterpart.translate(key));

        timerRef.current = setTimeout(() => {
            setMessage(null);
        }, 4000);
    }

    return (
        <section className="no-border-bottom">
            <header>
                <Translate
                    component="span"
                    style={{
                        fontWeight: "normal",
                        fontFamily: "Roboto-Medium, arial, sans-serif",
                        fontStyle: "normal"
                    }}
                    content={"settings.reset_text_description"}
                    generalName={counterpart.translate("settings.general")}
                    with={{
                        generalName: counterpart.translate(
                            "settings.general"
                        ),
                        accessName: counterpart.translate("settings.access"),
                        faucetName: counterpart.translate(
                            "settings.faucet_address"
                        )
                    }}
                />
            </header>

            <Button
                type="primary"
                style={{height: 60, width: "100%", marginTop: "30px"}}
                onClick={() => {
                    SettingsActions.clearSettings().then(() => {
                        setMessageWithTimeout(
                            "settings.restore_default_success"
                        );
                        setTimeout(() => {
                            willTransitionTo(false);
                        }, 50);
                    });
                }}
            >
                {counterpart.translate("settings.reset")}
            </Button>

            <div
                className="facolor-success"
                style={{marginTop: "20px", height: "18px"}}
            >
                {message}
            </div>
        </section>
    );
}
