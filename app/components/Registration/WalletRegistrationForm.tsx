// TypeScript/functional-component port of the legacy
// WalletRegistrationForm.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: this is the real wallet-creation
// flow. `onSubmit` reads the user-entered `state.password` and, when no
// wallet exists yet, calls `createWallet(password)` ->
// `WalletActions.setWallet("default", password)` before creating the
// first account via `WalletUnlockActions.unlock()` + `AccountActions
// .createAccount(...)` - all transcribed verbatim, no refactoring.
// Grepped every `console.*` call in this file: `console.log("onFinishConfirm")`,
// `console.log("Congratulations, your wallet was successfully
// created.")`, `console.log("CreateWallet failed:", err)`, and
// `console.log("ERROR AccountActions.createAccount", error)` - none of
// them ever include `state.password` or any other key/credential value,
// only static strings or the caught error object - kept verbatim, no new
// logging added, and `state.password` itself is never logged or
// persisted anywhere in this component beyond the one
// `WalletActions.setWallet` call it's supposed to reach.
//
// `shouldComponentUpdate` (a pure `are_equal_shallow` guard) dropped - no
// hooks equivalent, never changes final rendered output.
// `componentWillUnmount`'s `this.unmounted = true` (read inside
// `createAccount`'s async `.then()` to avoid a post-unmount `setState`)
// becomes a `useRef` flipped in a mount-only effect's cleanup function -
// the standard hooks idiom for this exact class pattern.
//
// Dropped as confirmed dead (grepped):
// - `ref="password"` on `PasswordInput` - `this.refs.password` is never
//   read anywhere in the file.
// - `state.showIdenticon` - toggled (`false` initially, set `true` once
//   in `onAccountNameChange`) but never read anywhere, in this file or
//   passed to a child that reads it - the same dead field, same name, as
//   the already-dropped `state.show_identicon` in the sibling
//   `Account/CreateAccount.tsx` (earlier Account/ batch).
// - `renderDropdown(myAccounts, isLTM)`'s second parameter: `isLTM` is
//   passed by the one call site but never read inside the function body
//   (only `myAccounts` and `state.registrarAccount` are) - dropped from
//   the signature and the call site alike.
// - The `Input` import from `bitshares-ui-style-guide`: never referenced
//   as `<Input>` anywhere in the original file either (a pre-existing
//   dead import, not introduced by this port).
import * as React from "react";
import Translate from "react-translate-component";
import {ChainStore, FetchChain} from "bitsharesjs";
import counterpart from "counterpart";
import AccountActions from "actions/AccountActions";
import WalletUnlockActions from "actions/WalletUnlockActions";
import WalletActions from "actions/WalletActions";
import AccountStore from "stores/AccountStore";
import WalletDb from "stores/WalletDb";
import TransactionConfirmStore from "stores/TransactionConfirmStore";
import AccountNameInput from "./../Forms/AccountNameInputStyleGuide";
import PasswordInput from "./../Forms/PasswordInputStyleGuide";
import Icon from "../Icon/Icon";
import {
    Notification,
    Form,
    Button,
    Select,
    Alert,
    Tooltip
} from "bitshares-ui-style-guide";

interface WalletRegistrationFormState {
    validAccountName: boolean;
    accountName: string;
    validPassword: boolean;
    registrarAccount: any;
    loading: boolean;
    password: string;
}

interface WalletRegistrationFormProps {
    continue: () => void;
    history: any;
}

function WalletRegistrationForm({
    continue: onContinueProp,
    history
}: WalletRegistrationFormProps) {
    const [state, setState] = React.useState<WalletRegistrationFormState>({
        validAccountName: false,
        accountName: "",
        validPassword: false,
        registrarAccount: undefined,
        loading: false,
        password: ""
    });
    const stateRef = React.useRef(state);
    stateRef.current = state;

    const mergeState = (patch: Partial<WalletRegistrationFormState>) =>
        setState(prev => ({...prev, ...patch}));

    const unmountedRef = React.useRef(false);
    React.useEffect(() => {
        return () => {
            unmountedRef.current = true;
        };
    }, []);

    const onAccountNameChange = (e: any) => {
        const patch: Partial<WalletRegistrationFormState> = {};
        if (e.valid !== undefined) {
            patch.validAccountName = e.valid;
        }
        if (e.value !== undefined) {
            patch.accountName = e.value;
        }
        mergeState(patch);
    };

    const onPasswordChange = (value: string) => {
        mergeState({password: value});
    };

    const onPasswordValidationChange = (validation: any) => {
        mergeState({validPassword: validation.valid});
    };

    const onFinishConfirm = (confirmStoreState: any) => {
        if (
            confirmStoreState.included &&
            confirmStoreState.broadcasted_transaction
        ) {
            (TransactionConfirmStore as any).unlisten(onFinishConfirm);
            (TransactionConfirmStore as any).reset();

            (FetchChain as any)(
                "getAccount",
                stateRef.current.accountName,
                undefined,
                {[stateRef.current.accountName]: true}
            ).then(() => {
                console.log("onFinishConfirm");
                history.push("/wallet/backup/create?newAccount=true");
            });
        }
    };

    const onRegistrarAccountChange = (registrarAccount: any) => {
        mergeState({registrarAccount});
    };

    const createWallet = (password: string) => {
        mergeState({loading: true});
        return (WalletActions as any)
            .setWallet("default", password)
            .then(() => {
                console.log(
                    "Congratulations, your wallet was successfully created."
                );
            })
            .catch((err: any) => {
                mergeState({loading: false});
                console.log("CreateWallet failed:", err);
                (Notification as any).error({
                    message: counterpart.translate(
                        "notifications.account_wallet_create_failure",
                        {error_msg: err}
                    )
                });
            });
    };

    const createAccount = (name: string) => {
        const {referralAccount} = (AccountStore as any).getState();
        (WalletUnlockActions as any).unlock().then(() => {
            mergeState({loading: true});

            (AccountActions as any)
                .createAccount(
                    name,
                    stateRef.current.registrarAccount,
                    referralAccount || stateRef.current.registrarAccount,
                    0
                )
                .then(() => {
                    // User registering his own account
                    (FetchChain as any)("getAccount", name, undefined, {
                        [name]: true
                    }).then(() => {
                        onContinueProp();
                        if (unmountedRef.current) {
                            return;
                        }
                        mergeState({loading: false});
                    });
                    if (stateRef.current.registrarAccount) {
                        (TransactionConfirmStore as any).listen(
                            onFinishConfirm
                        );
                    }
                })
                .catch((error: any) => {
                    mergeState({loading: false});
                    console.log("ERROR AccountActions.createAccount", error);
                    let errorMsg =
                        error.base &&
                        error.base.length &&
                        error.base.length > 0
                            ? error.base[0]
                            : "unknown error";
                    if (error.remote_ip) [errorMsg] = error.remote_ip;
                    (Notification as any).error({
                        message: counterpart.translate(
                            "notifications.account_create_failure",
                            {
                                account_name: name,
                                error_msg: errorMsg
                            }
                        )
                    });
                });
        });
    };

    const isValid = () => {
        const firstAccount = (AccountStore as any).getMyAccounts().length === 0;
        let valid: any = state.validAccountName;
        if (!(WalletDb as any).getWallet()) {
            valid = valid && state.validPassword;
        }
        if (!firstAccount) {
            valid = valid && state.registrarAccount;
        }
        return valid;
    };

    const onSubmit = (e: any) => {
        e.preventDefault();
        if (!isValid()) {
            return;
        }
        const {accountName} = state;
        if ((WalletDb as any).getWallet()) {
            createAccount(accountName);
        } else {
            const password = state.password;
            createWallet(password).then(() => createAccount(accountName));
        }
    };

    const renderDropdown = (myAccounts: any[]) => {
        const {registrarAccount} = state;

        return (
            <Form.Item label={counterpart.translate("account.pay_from")}>
                <Select
                    placeholder={counterpart.translate(
                        "account.select_placeholder"
                    )}
                    style={{width: "100%"}}
                    value={registrarAccount}
                    onChange={onRegistrarAccountChange}
                >
                    {myAccounts.map(accountName => (
                        <Select.Option key={accountName} value={accountName}>
                            {accountName}
                        </Select.Option>
                    ))}
                </Select>
            </Form.Item>
        );
    };

    const renderPasswordInput = () => (
        <PasswordInput
            onChange={onPasswordChange}
            onValidationChange={onPasswordValidationChange}
            label={
                <span>
                    <span className="vertical-middle">
                        {counterpart.translate("settings.password")}
                    </span>
                    &nbsp;
                    <Tooltip
                        title={counterpart.translate(
                            "tooltip.registration.password"
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
        />
    );

    const renderAccountCreateForm = () => {
        const {registrarAccount} = state;

        const myAccounts = (AccountStore as any).getMyAccounts();
        const firstAccount = myAccounts.length === 0;
        const hasWallet = (WalletDb as any).getWallet();
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

        const isButtonDisabled = () => {
            return !valid || (registrarAccount && !isLTM);
        };

        return (
            <Form layout={"vertical"} onSubmit={onSubmit}>
                <AccountNameInput
                    cheapNameOnly={!!firstAccount}
                    onChange={(e: any) => onAccountNameChange(e)}
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

                {hasWallet ? null : renderPasswordInput()}

                {firstAccount ? null : renderDropdown(myAccounts)}

                {registrar && !isLTM ? (
                    <Form.Item>
                        <Alert
                            type="error"
                            description={
                                <Translate content="wallet.must_be_ltm" />
                            }
                        />
                    </Form.Item>
                ) : null}

                <Form.Item>
                    <Button
                        type="primary"
                        disabled={state.loading || isButtonDisabled()}
                        htmlType="submit"
                        loading={state.loading}
                    >
                        {counterpart.translate("registration.continue")}
                    </Button>
                </Form.Item>
            </Form>
        );
    };

    const hasWallet = (WalletDb as any).getWallet();
    const firstAccount = (AccountStore as any).getMyAccounts().length === 0;

    return (
        <div>
            <div className="text-left">
                {firstAccount ? (
                    <Translate
                        component="h3"
                        content="registration.createAccountTitle"
                    />
                ) : (
                    <Translate component="h3" content="wallet.create_a" />
                )}
                {!hasWallet ? (
                    <Translate
                        component="p"
                        content="registration.walletDescription"
                        className="model-description"
                    />
                ) : null}
            </div>
            {renderAccountCreateForm()}
        </div>
    );
}

export default WalletRegistrationForm;
