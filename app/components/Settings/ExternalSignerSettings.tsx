// Settings -> Signing: choose between the local wallet (default) and the
// BitShares wallet browser extension (Phase 6, docs/UI_MIGRATION_PLAN.md
// §7.11). Holds no key material; all it does is flip the preference and ask
// `ExternalSignerActions` to connect or disconnect. The extension is never used
// unless it is both chosen here and connected.
import * as React from "react";
import Translate from "react-translate-component";
import {Alert} from "../../design-system/Alert";
import {Button} from "../../design-system/Button";
import {Radio} from "../../design-system/Radio";
import ExternalSignerActions from "../../actions/ExternalSignerActions";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectExternalSigner} from "../../store/slices/externalSignerSlice";
import styles from "./ExternalSignerSettings.module.scss";

export default function ExternalSignerSettings() {
    const state = useReduxState(selectExternalSigner);
    const connected = state.status === "connected" && !!state.account;
    const connecting = state.status === "connecting";

    function onPreference(e: {target: {value: any}}) {
        const preference =
            e.target.value === "extension" ? "extension" : "local";
        ExternalSignerActions.setPreference(preference);
        if (preference === "extension" && state.status === "disconnected") {
            ExternalSignerActions.restore();
        }
    }

    return (
        <div className={styles.panel}>
            <Translate
                component="p"
                className={styles.intro}
                content="externalSigner.intro"
            />

            <div className={styles.field}>
                <Translate
                    component="label"
                    className={styles.label}
                    content="externalSigner.method"
                />
                <Radio.Group value={state.preference} onChange={onPreference}>
                    <Radio value="local">
                        <Translate content="externalSigner.local" />
                    </Radio>
                    <Radio value="extension">
                        <Translate content="externalSigner.extension" />
                    </Radio>
                </Radio.Group>
            </div>

            {state.preference === "extension" && (
                <div className={styles.field}>
                    <p className={styles.status} data-testid="signer-status">
                        {connected ? (
                            <Translate
                                content="externalSigner.status_connected"
                                account={state.account!.accountName}
                            />
                        ) : (
                            <Translate
                                content={
                                    "externalSigner.status_" + state.status
                                }
                            />
                        )}
                    </p>

                    {connected && state.locked === true && (
                        <Alert
                            type="warning"
                            showIcon
                            message={
                                <Translate content="externalSigner.locked" />
                            }
                        />
                    )}
                    {/* "not found" is already the status line; do not say it twice */}
                    {state.error && state.status !== "unavailable" && (
                        <Alert type="error" showIcon message={state.error} />
                    )}

                    <div className={styles.actions}>
                        {connected ? (
                            <Button
                                onClick={() =>
                                    ExternalSignerActions.disconnect()
                                }
                            >
                                <Translate content="externalSigner.disconnect" />
                            </Button>
                        ) : (
                            <Button
                                variant="accent"
                                disabled={connecting}
                                onClick={() => ExternalSignerActions.connect()}
                            >
                                <Translate content="externalSigner.connect" />
                            </Button>
                        )}
                    </div>

                    <Translate
                        component="p"
                        className={styles.limits}
                        content="externalSigner.limits"
                    />
                </div>
            )}
        </div>
    );
}
