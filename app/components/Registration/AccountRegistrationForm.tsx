// TypeScript/functional-component port of the legacy
// AccountRegistrationForm.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `state.generatedPassword` is a real
// wallet password, auto-generated once via `bitsharesjs`'s `key` module
// (`` `P${key.get_random_key().toWif()}` ``) - computed once through a
// `useState` lazy initializer (matching the established pattern from
// `Account/CreateAccountPassword.tsx`), never logged (grepped this file
// for `console.` - no matches at all), only ever rendered into a
// disabled, copy-only text area and forwarded to `props.continue(...)`
// on submit, exactly as the original did.
//
// `connect(AccountRegistrationForm, {listenTo: [AccountStore], getProps:
// () => ({})})` - `getProps` returns an empty object, so the only
// observable effect of this `connect` wrap is forcing a re-render
// whenever `AccountStore` changes (the component reads `AccountStore
// .getMyAccounts()` directly in its render body, not through props) -
// replicated with `useAltStore(AccountStore)`, called purely for its
// re-render-on-change side effect (its returned state is intentionally
// unused, matching the original's empty `getProps()`).
//
// `UNSAFE_componentWillMount` (dispatches `SettingsActions.changeSetting`)
// and `componentDidMount` (`ReactTooltip.rebuild()`) are combined into one
// mount-only `useEffect`, same treatment as `AccountRegistration.tsx`.
// `shouldComponentUpdate` (a pure `are_equal_shallow` guard) dropped - no
// hooks equivalent, never changes final rendered output.
//
// Dropped as confirmed dead (grepped):
// - `this.accountNameInput = null` (constructor-only, never read or
//   reassigned anywhere else in the file).
// - `isValid()`'s `if (!WalletDb.getWallet()) { valid = valid; }` - a
//   self-assignment with zero effect regardless of whether the branch is
//   taken (also something a linter's `no-self-assign` rule would reject
//   outright in this ported form) - dropped as a provably inert no-op,
//   not merely "probably dead," taking the now-unused `WalletDb` import
//   with it.
import * as React from "react";
import AccountStore from "stores/AccountStore";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import {ChainStore, key} from "bitsharesjs";
import ReactTooltip from "react-tooltip";
import SettingsActions from "actions/SettingsActions";
import AccountNameInput from "./../Forms/AccountNameInputStyleGuide";
import AccountSelect from "../Forms/AccountSelect";
import LoadingIndicator from "../LoadingIndicator";
import Icon from "../Icon/Icon";
import CopyButton from "../Utility/CopyButton";
import {Form, Input, Button, Tooltip} from "bitshares-ui-style-guide";
import {useAltStore} from "../../next/hooks/useAltStore";

interface AccountRegistrationFormState {
    validAccountName: boolean;
    accountName: string;
    registrarAccount: any;
    loading: boolean;
    generatedPassword: string;
    confirmPassword: string;
    passwordConfirmed?: boolean;
}

interface AccountRegistrationFormProps {
    continue: (result: {accountName: string; password: string}) => void;
}

function AccountRegistrationForm({continue: onContinue}: AccountRegistrationFormProps) {
    useAltStore<any>(AccountStore);

    const [state, setState] = React.useState<AccountRegistrationFormState>(
        () => ({
            validAccountName: false,
            accountName: "",
            registrarAccount: null,
            loading: false,
            generatedPassword: `P${(key as any).get_random_key().toWif()}`,
            confirmPassword: ""
        })
    );

    const mergeState = (patch: Partial<AccountRegistrationFormState>) =>
        setState(prev => ({...prev, ...patch}));

    React.useEffect(() => {
        (SettingsActions as any).changeSetting({
            setting: "passwordLogin",
            value: true
        });
        (ReactTooltip as any).rebuild();
    }, []);

    const onAccountNameChange = (e: any) => {
        const patch: Partial<AccountRegistrationFormState> = {};
        if (e.valid !== undefined) {
            patch.validAccountName = e.valid;
        }
        if (e.value !== undefined) {
            patch.accountName = e.value;
        }
        mergeState(patch);
    };

    const onRegistrarAccountChange = (registrarAccount: any) => {
        mergeState({registrarAccount});
    };

    const isValid = () => {
        const firstAccount = (AccountStore as any).getMyAccounts().length === 0;
        let valid: any = state.validAccountName;
        if (!firstAccount) {
            valid = valid && state.registrarAccount;
        }
        return valid;
    };

    const onSubmit = (e: any) => {
        e.preventDefault();
        if (isValid()) {
            onContinue({
                accountName: state.accountName,
                password: state.generatedPassword
            });
        }
    };

    const onConfirmation = (e: any) => {
        const value = e.currentTarget.value;
        mergeState({
            confirmPassword: value,
            passwordConfirmed: value === state.generatedPassword
        });
    };

    const renderAccountCreateForm = () => {
        const {registrarAccount} = state;

        const myAccounts = (AccountStore as any).getMyAccounts();
        const firstAccount = myAccounts.length === 0;
        const valid = isValid();
        let isLTM = false;
        const registrar = registrarAccount
            ? (ChainStore as any).getAccount(registrarAccount)
            : null;
        if (registrar) {
            if (registrar.get("lifetime_referrer") === registrar.get("id")) {
                isLTM = true;
            }
        }

        const getConfirmationPasswordHelp = () => {
            return state.confirmPassword && !state.passwordConfirmed
                ? counterpart.translate("wallet.confirm_error")
                : "";
        };

        const getConfirmationPasswordValidateStatus = (): any => {
            return state.confirmPassword && !state.passwordConfirmed
                ? "error"
                : "";
        };

        return (
            <div>
                <Form onSubmit={onSubmit} layout={"vertical"}>
                    <AccountNameInput
                        cheapNameOnly={firstAccount}
                        onChange={onAccountNameChange}
                        accountShouldNotExist
                        placeholder={counterpart.translate("account.name")}
                        label={
                            <span>
                                <span className="vertical-middle">
                                    {counterpart.translate("account.name")}
                                </span>
                                &nbsp;
                                <Tooltip
                                    title={counterpart.translate(
                                        "tooltip.registration.accountName"
                                    )}
                                >
                                    <span>
                                        <Icon
                                            name="question-in-circle"
                                            className="icon-14px question-icon vertical-middle"
                                        />
                                    </span>
                                </Tooltip>
                            </span>
                        }
                        noLabel
                    />
                    <Form.Item
                        label={counterpart.translate("wallet.generated")}
                    >
                        <Input.TextArea
                            disabled={true}
                            style={{paddingRight: "50px"}}
                            rows={2}
                            id="password"
                            value={state.generatedPassword}
                        />
                        <CopyButton
                            text={state.generatedPassword}
                            tip="tooltip.copy_password"
                            dataPlace="top"
                            className="button registration-layout--copy-password-btn"
                        />
                    </Form.Item>
                    <Form.Item
                        label={counterpart.translate("wallet.confirm_password")}
                        help={getConfirmationPasswordHelp()}
                        validateStatus={getConfirmationPasswordValidateStatus()}
                    >
                        <Input
                            placeholder={counterpart.translate(
                                "wallet.confirm_password"
                            )}
                            type="password"
                            name="password"
                            id="confirmPassword"
                            value={state.confirmPassword}
                            onChange={onConfirmation}
                        />
                    </Form.Item>

                    {firstAccount ? null : (
                        <div className="full-width-content form-group no-overflow">
                            <label htmlFor="account">
                                <Translate content="account.pay_from" />
                            </label>
                            <AccountSelect
                                id="account"
                                account_names={myAccounts}
                                onChange={onRegistrarAccountChange}
                            />
                            {registrarAccount && !isLTM ? (
                                <div
                                    style={{textAlign: "left"}}
                                    className="facolor-error"
                                >
                                    <Translate content="wallet.must_be_ltm" />
                                </div>
                            ) : null}
                        </div>
                    )}
                    {state.loading ? (
                        <LoadingIndicator type="three-bounce" />
                    ) : (
                        <Button
                            htmlType="submit"
                            type="primary"
                            disabled={
                                !valid ||
                                !state.passwordConfirmed ||
                                (registrarAccount && !isLTM)
                            }
                        >
                            <Translate content="registration.continue" />
                        </Button>
                    )}
                </Form>
            </div>
        );
    };

    const renderAccountCreateText = () => {
        const myAccounts = (AccountStore as any).getMyAccounts();
        const firstAccount = myAccounts.length === 0;

        return (
            <div>
                <Translate
                    component="p"
                    className="model-description"
                    content="registration.accountDescription"
                />

                {firstAccount ? null : (
                    <Translate
                        component="p"
                        content="wallet.not_first_account"
                    />
                )}
            </div>
        );
    };

    return (
        <div>
            {renderAccountCreateText()}
            {renderAccountCreateForm()}
        </div>
    );
}

export default AccountRegistrationForm;
