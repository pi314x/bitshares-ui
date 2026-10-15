// TypeScript/functional-component port of the legacy
// AccountRegistration.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md itself (this component only holds
// UI-flow state and forwards `accountName`/`password` down to
// `AccountRegistrationForm`/`AccountRegistrationConfirm`, which are the
// files that actually touch `WalletDb`/`AccountActions`) - grepped for
// `WalletApi`/`WalletDb`/`ApplicationApi`/`.add_type_operation`/
// `process_transaction` here, none appear.
//
// `UNSAFE_componentWillMount` (dispatches `SettingsActions.changeSetting`)
// and `componentDidMount` (`ReactTooltip.rebuild()`) are combined into one
// mount-only `useEffect` in the original order - both are independent,
// unconditional side effects with no interaction between them.
// `shouldComponentUpdate` (a pure `are_equal_shallow` guard) dropped -
// no hooks equivalent, never changes final rendered output.
import * as React from "react";
import Translate from "react-translate-component";
import ReactTooltip from "react-tooltip";
import SettingsActions from "actions/SettingsActions";
import AccountRegistrationForm from "./AccountRegistrationForm";
import AccountRegistrationConfirm from "./AccountRegistrationConfirm";

interface AccountRegistrationState {
    accountName: string;
    password?: string;
    confirmationStep?: boolean;
    active?: boolean;
}

interface AccountRegistrationProps {
    history: any;
}

export default function AccountRegistration({
    history
}: AccountRegistrationProps) {
    const [state, setState] = React.useState<AccountRegistrationState>({
        accountName: ""
    });

    React.useEffect(() => {
        (SettingsActions as any).changeSetting({
            setting: "passwordLogin",
            value: true
        });
        (ReactTooltip as any).rebuild();
    }, []);

    const onContinue = ({
        accountName,
        password
    }: {
        accountName: string;
        password: string;
    }) => {
        setState(prev => ({
            ...prev,
            accountName,
            password,
            confirmationStep: true
        }));
    };

    const toggleConfirmed = () => {
        setState(prev => ({...prev, active: !prev.active}));
    };

    return (
        <div className="no-margin grid-block registration-layout registration">
            <div className="grid-block horizontal align-center text-center">
                <div>
                    <img
                        className={`model-img ${
                            state.active ? "confirmed" : ""
                        }`}
                        src="/model-type-images/account.svg"
                        alt="account"
                    />
                </div>
                <div className="create-account-block">
                    <Translate
                        component="h3"
                        className="registration-account-title"
                        content="registration.createByPassword"
                    />
                    {!state.confirmationStep ? (
                        <AccountRegistrationForm continue={onContinue} />
                    ) : (
                        <AccountRegistrationConfirm
                            accountName={state.accountName}
                            password={state.password}
                            toggleConfirmed={toggleConfirmed}
                            history={history}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
