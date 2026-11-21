// TypeScript/functional-component port of the legacy
// WalletRegistration.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Not security-sensitive itself (this component only holds UI-flow state
// and forwards it to its two children, which are the files that actually
// touch `WalletDb`/`WalletActions`/`AccountActions`) - grepped for
// `WalletApi`/`WalletDb`/`ApplicationApi`/`.add_type_operation`/
// `process_transaction` here, none appear.
//
// `UNSAFE_componentWillMount` (dispatches `SettingsActions.changeSetting`)
// and `componentDidMount` (`ReactTooltip.rebuild()`) are combined into one
// mount-only `useEffect`, same treatment as `AccountRegistration.tsx`.
// `shouldComponentUpdate` (a pure `are_equal_shallow` guard) dropped - no
// hooks equivalent, never changes final rendered output.
//
// `toggleConfirmed(checkbox)`'s computed-key toggle
// (`this.setState({[checkbox]: !this.state[checkbox]})`) is preserved via
// a `stateRef` mirror so it always flips the *current* value rather than
// a stale closure's.
import * as React from "react";
import ReactTooltip from "react-tooltip";
import SettingsActions from "actions/SettingsActions";
import WalletRegistrationConfirm from "./WalletRegistrationConfirm";
import WalletRegistrationForm from "./WalletRegistrationForm";

interface WalletRegistrationState {
    confirmationStep: boolean;
    checkboxRemember: boolean;
    checkboxUploaded: boolean;
    checkboxRecover: boolean;
}

interface WalletRegistrationProps {
    history: any;
}

export default function WalletRegistration({history}: WalletRegistrationProps) {
    const [state, setState] = React.useState<WalletRegistrationState>({
        confirmationStep: false,
        checkboxRemember: false,
        checkboxUploaded: false,
        checkboxRecover: false
    });
    const stateRef = React.useRef(state);
    stateRef.current = state;

    React.useEffect(() => {
        (SettingsActions as any).changeSetting({
            setting: "passwordLogin",
            value: false
        });
        (ReactTooltip as any).rebuild();
    }, []);

    const onContinue = () => {
        setState(prev => ({...prev, confirmationStep: true}));
    };

    const toggleConfirmed = (checkbox: string) => {
        setState(prev => ({
            ...prev,
            [checkbox]: !(stateRef.current as any)[checkbox]
        }));
    };

    const {
        confirmationStep,
        checkboxRemember,
        checkboxUploaded,
        checkboxRecover
    } = state;

    return (
        <div className="no-margin grid-block registration-layout registration">
            <div className="grid-block horizontal align-center text-center">
                <div>
                    <img
                        className={`${
                            checkboxRemember &&
                            checkboxUploaded &&
                            checkboxRecover
                                ? "confirmed"
                                : ""
                        } model-img`}
                        src="/model-type-images/flesh-drive.svg"
                        alt="wallet"
                    />
                </div>
                <div className="create-account-block">
                    {!confirmationStep ? (
                        <WalletRegistrationForm
                            history={history}
                            continue={onContinue}
                        />
                    ) : (
                        <WalletRegistrationConfirm
                            history={history}
                            toggleConfirmed={toggleConfirmed}
                            checkboxRemember={checkboxRemember}
                            checkboxUploaded={checkboxUploaded}
                            checkboxRecover={checkboxRecover}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
