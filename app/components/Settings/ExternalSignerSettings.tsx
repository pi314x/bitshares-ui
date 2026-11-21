// Settings -> Signing: connect the BitShares wallet browser extension (Phase 6,
// docs/UI_MIGRATION_PLAN.md §7.11). Holds no key material and has no "signing
// method" choice: the account selected in the account menu is the one that
// signs - the extension's account through the extension, every other account
// through the local wallet. All this panel does is ask `ExternalSignerActions`
// to connect or disconnect and say which of the two signs for the current
// account.
import * as React from "react";
import Translate from "react-translate-component";
import {Alert} from "../../design-system/Alert";
import {Button} from "../../design-system/Button";
import ExternalSignerActions from "../../actions/ExternalSignerActions";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectExternalSigner} from "../../store/slices/externalSignerSlice";
import {selectAccountState} from "../../store/slices/accountSlice";
import styles from "./ExternalSignerSettings.module.scss";

export default function ExternalSignerSettings() {
    const state = useReduxState(selectExternalSigner);
    const accountState = useReduxState<{
        currentAccount: string | null;
        passwordAccount: string | null;
    }>(selectAccountState);
    const connected = state.status === "connected" && !!state.account;
    const connecting = state.status === "connecting";
    const currentAccount =
        accountState.currentAccount || accountState.passwordAccount;
    // Connect was pressed: with no extension in the browser the status line says "not found" already (it did before the
    // button was pressed), so pressing it seemed to do nothing. Now it says what to do about it.
    const [tried, setTried] = React.useState(false);
    // (`isSecureContext` is true for HTTPS and for localhost, which is what the extension accepts; a browser that does not
    // have it is not said to be insecure)
    const insecure =
        typeof window !== "undefined" && window.isSecureContext === false;

    return (
        <div className={styles.panel}>
            <Translate
                component="p"
                className={styles.intro}
                content="externalSigner.intro"
            />

            <div className={styles.field}>
                <p className={styles.status} data-testid="signer-status">
                    {connected ? (
                        <Translate
                            content="externalSigner.status_connected"
                            account={state.account!.accountName}
                        />
                    ) : (
                        <Translate
                            content={"externalSigner.status_" + state.status}
                        />
                    )}
                </p>

                {connected && currentAccount && (
                    <p className={styles.signing} data-testid="signer-for">
                        <Translate
                            content={
                                ExternalSignerActions.isSigningFor(
                                    currentAccount
                                )
                                    ? "externalSigner.signing_extension"
                                    : "externalSigner.signing_local"
                            }
                            account={currentAccount}
                        />
                    </p>
                )}

                {connected && state.locked === true && (
                    <Alert
                        type="warning"
                        showIcon
                        message={<Translate content="externalSigner.locked" />}
                    />
                )}
                {/* "not found" is already the status line; do not say it twice */}
                {state.error && state.status !== "unavailable" && (
                    <Alert type="error" showIcon message={state.error} />
                )}
                {/* the extension connects only to pages opened over HTTPS (or as localhost): said before Connect is pressed */}
                {insecure && !connected && (
                    <Alert
                        type="warning"
                        showIcon
                        message={
                            <Translate
                                content="externalSigner.insecure"
                                origin={window.location.origin}
                            />
                        }
                    />
                )}
                {/* ... but what to do about it is said after Connect is pressed */}
                {tried && !connected && state.status === "unavailable" && (
                    <Alert
                        type="warning"
                        showIcon
                        message={
                            <Translate content="externalSigner.not_found_help" />
                        }
                    />
                )}

                <div className={styles.actions}>
                    {connected ? (
                        <Button
                            onClick={() => ExternalSignerActions.disconnect()}
                        >
                            <Translate content="externalSigner.disconnect" />
                        </Button>
                    ) : (
                        <Button
                            variant="accent"
                            disabled={connecting}
                            onClick={() => {
                                setTried(true);
                                ExternalSignerActions.connect();
                            }}
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
        </div>
    );
}
