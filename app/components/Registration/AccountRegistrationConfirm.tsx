// TypeScript/functional-component port of the legacy
// AccountRegistrationConfirm.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `onCreateAccount`/`createAccount`
// submit an on-chain account-creation transaction with a raw password via
// `AccountActions.createAccountWithPassword(name, password, ...)`, and
// `unlockAccount` calls `WalletDb.validatePassword(password, true, name)`
// directly - transcribed verbatim. Grepped every `console.` call in this
// file: the one existing `console.log("ERROR AccountActions.createAccount",
// error)` only logs the error object, never the password - kept verbatim,
// no new logging added.
//
// `connect(AccountRegistrationConfirm, {listenTo: [AccountStore],
// getProps: () => ({})})` - same "re-render-only, no injected props"
// pattern as `AccountRegistrationForm.tsx` - replicated with
// `useAltStore(AccountStore)` called purely for its re-render-on-change
// side effect (`createAccount` reads `AccountStore.getState()
// .referralAccount` directly, not through props). `shouldComponentUpdate`
// (a pure `state.confirmed` comparison) dropped - no hooks equivalent,
// never changes final rendered output.
//
// Dropped as confirmed dead (grepped/traced, not assumed): `state
// .registrarAccount` is read in `createAccount`'s call to
// `AccountActions.createAccountWithPassword(...)` and in its `.then()`'s
// `if (this.state.registrarAccount)` branch, but is never initialized in
// the constructor (`this.state = {confirmed: false}`, no
// `registrarAccount` key) and never set anywhere else in the file (no
// `setState` call, and it isn't a declared prop either) - it is always
// `undefined`, which makes the entire `if (this.state.registrarAccount)`
// branch - including `onFinishConfirm` and the `TransactionConfirmStore
// .listen(this.onFinishConfirm)` call that would be the only thing to
// ever invoke it - permanently unreachable. Dropped that whole branch and
// `onFinishConfirm` itself, keeping only the (always-taken) `else`
// branch's body inline. `props.toggleConfirmed` (accepted, passed by the
// real caller `AccountRegistration.tsx`, declared in the original's
// `propTypes`) is never read anywhere in this file - the class instead
// has its own same-named `toggleConfirmed` method/handler for its own
// local `confirmed` checkbox state, which shadows the prop entirely -
// kept in the props type as accepted-but-unused, matching this
// migration's established treatment of such cases.
//
// Preserved verbatim, not "fixed": the "copy password" button
// (`CopyButton text={this.state.generatedPassword}`) reads a state field
// that was never declared or set anywhere in this component (`
// generatedPassword` is a real field on the *other*, sibling file,
// `AccountRegistrationForm.jsx`/`.tsx`, not this one) - it is always
// `undefined` here, so this button always copies nothing useful, while
// the `<Input.TextArea value={this.props.password}>` right above it
// correctly displays the real password. A real, pre-existing bug (wrong
// scope/copy-paste from the sibling file), kept exactly as broken - the
// state field is declared in the TS interface purely so this reference
// compiles, and is deliberately never populated.
import * as React from "react";
import AccountActions from "actions/AccountActions";
import AccountStore from "stores/AccountStore";
import WalletDb from "stores/WalletDb";
import counterpart from "counterpart";
import Translate from "react-translate-component";
import {FetchChain} from "bitsharesjs";
import WalletUnlockActions from "actions/WalletUnlockActions";
import {Notification} from "../../design-system/Notification";
import {Button} from "../../design-system/Button";
import {Input} from "../../design-system/Input";
import {Checkbox} from "../../design-system/Checkbox";
import {Form} from "../../design-system/Form";
import {Alert} from "../../design-system/Alert";
import CopyButton from "../Utility/CopyButton";
import {useAltStore} from "../../next/hooks/useAltStore";

interface AccountRegistrationConfirmState {
    confirmed: boolean;
    generatedPassword?: any;
}

interface AccountRegistrationConfirmProps {
    accountName: string;
    password?: string;
    toggleConfirmed?: () => void;
    history: any;
}

function AccountRegistrationConfirm({
    accountName,
    password,
    history
}: AccountRegistrationConfirmProps) {
    useAltStore<any>(AccountStore);

    const [state, setState] = React.useState<AccountRegistrationConfirmState>(
        {confirmed: false}
    );

    const unlockAccount = (name: string, pw: string) => {
        (WalletDb as any).validatePassword(pw, true, name);
        (WalletUnlockActions as any).checkLock.defer();
    };

    const createAccount = (name: string, pw: string) => {
        const {referralAccount} = (AccountStore as any).getState();

        (AccountActions as any)
            .createAccountWithPassword(
                name,
                pw,
                undefined,
                referralAccount || undefined,
                0
            )
            .then(() => {
                (AccountActions as any).setPasswordAccount(name);
                (FetchChain as any)("getAccount", name).then(() => {});
                unlockAccount(name, pw);
                history.push("/");
            })
            .catch((error: any) => {
                console.log("ERROR AccountActions.createAccount", error);
                let errorMsg =
                    error.base && error.base.length && error.base.length > 0
                        ? error.base[0]
                        : "unknown error";
                if (error.remote_ip) {
                    [errorMsg] = error.remote_ip;
                }
                (Notification as any).error({
                    message: counterpart.translate("account_create_failure", {
                        account_name: name,
                        error_msg: errorMsg
                    })
                });
            });
    };

    const onCreateAccount = (e: any) => {
        e.preventDefault();
        createAccount(accountName, password as string);
    };

    const toggleConfirmed = (e: any) => {
        setState(prev => ({...prev, confirmed: e.target.checked}));
    };

    return (
        <Form layout={"vertical"}>
            <Form.Item label={counterpart.translate("registration.copyPassword")}>
                <Input.TextArea
                    disabled={true}
                    rows={2}
                    id="password"
                    value={password}
                />
                <CopyButton
                    text={state.generatedPassword}
                    tip="tooltip.copy_password"
                    dataPlace="top"
                    className="button registration-layout--copy-password-btn"
                />
            </Form.Item>

            <Form.Item>
                <Alert
                    showIcon
                    type={"warning"}
                    message={""}
                    description={counterpart.translate(
                        "registration.accountNote"
                    )}
                />
            </Form.Item>

            <Form.Item>
                <Checkbox checked={state.confirmed} onChange={toggleConfirmed}>
                    <Translate
                        content="registration.accountConfirmation"
                        className="checkbox-text"
                    />
                </Checkbox>
            </Form.Item>

            <Form.Item>
                <Button
                    variant="accent"
                    disabled={!state.confirmed}
                    onClick={onCreateAccount}
                >
                    <Translate content="account.create_account" />
                </Button>
            </Form.Item>
        </Form>
    );
}

export default AccountRegistrationConfirm;
