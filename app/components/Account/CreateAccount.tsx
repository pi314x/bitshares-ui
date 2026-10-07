// TypeScript/functional-component port of the legacy CreateAccount.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md (wallet unlock and account/key
// creation): `createAccount` (`WalletUnlockActions.unlock()` +
// `AccountActions.createAccount`) and `createWallet`
// (`WalletActions.setWallet`) are transcribed verbatim, no restructuring.
//
// One TS-forced adjustment: the outer `<div>`'s non-standard `name`
// attribute (valid on a handful of HTML elements but not `div`, so
// untyped in React's own JSX typings) is spread in via `{...({name:
// "scrollToInput"} as any)}` rather than dropped, since `<div id=
// "scrollToInput" name="scrollToInput">` is exactly what the original
// rendered.
//
// Structural change (not a behavior change): `connect(withRouter(
// Component), {listenTo: [AccountStore], getProps: () => ({})})` - a
// store subscription that injects no props of its own, used purely to
// force a re-render whenever `AccountStore` changes (since
// `AccountStore.getMyAccounts()` is read directly, not from props) - is
// replaced by `useAltStore(AccountStore)` in a thin Container, called
// for its re-render-triggering side effect exactly like the original's
// empty `getProps`. `withRouter` is dropped since this component is only
// ever rendered as a route `component` (`LoginSelector.jsx`), which
// already injects `history`/`location`/`match` directly.
//
// `shouldComponentUpdate` (`!utils.are_equal_shallow(nextState, this
// .state)`) has no hooks equivalent for a component gating its own
// re-renders on its own state, and is dropped - this doesn't change any
// rendered output, only how many times identical output might be
// recomputed, since every `setState`/`mergeState` call here always
// changes at least one field.
//
// The `this.accountNameInput` (nested callback ref reading a *child*
// class component's own `this.refs.nameInput`) and `ref="password"`
// (read via `.value()` in `onSubmit`) refs are real and load-bearing -
// translated to `useRef()` object refs. `AccountNameInputStyleGuide.tsx`
// has since been ported too (a later Forms/ batch) to a `forwardRef`+
// `useImperativeHandle` function component exposing `getValue` directly -
// updated here, in that same commit, from the two-hop `ref={(ref) => {
// accountNameInputRef.current = ref.refs.nameInput;}}` to a plain
// `ref={accountNameInputRef}`, since a function component has no
// `.refs` to reach into. `PasswordInput` was already passed a plain,
// non-nested `ref={passwordRef}` here, so once it's ported the same way
// this call site needs no further change - only that file's own
// definition does. The commented-out `ref="refcode"`
// (on a `<RefcodeInput>` that is itself commented out in `render()`) is
// preserved as an inert comment, exactly as in the original - `this.refs
// .refcode` can therefore never actually be non-null, so `createAccount`'s
// `refcode` is always effectively `null`; replicated with a `useRef()`
// that is likewise declared but never attached to any live element.
//
// Dropped as confirmed dead (found while porting, not merely carried
// forward): `state.show_identicon` - set by live code in
// `onAccountNameChange`, but never read anywhere (`<AccountNameInput>`
// never receives it as a prop either). `state.hide_refcode`, by
// contrast, is *only* referenced inside the same commented-out
// `RefcodeInput` block noted above (an intentionally-disabled feature
// stub, not confirmed-dead active code), so it - and the commented-out
// `showRefcodeInput` method that would have set it - are kept as-is.
//
// `onFinishConfirm` is defined once per render and self-references its
// own closure for the matching `TransactionConfirmStore.unlisten` call
// (the same closure instance that was passed to `.listen()`), and reads
// `state.accountName` through a `stateRef` mirror (the pattern
// established in `AccountAssets.tsx`) so it always sees the latest value
// at the time the store actually fires, matching the class version's
// dynamic `this.state` reads.
import * as React from "react";
import classNames from "classnames";
import AccountActions from "actions/AccountActions";
import AccountStore from "stores/AccountStore";
import AccountNameInput from "./../Forms/AccountNameInputStyleGuide";
import PasswordInput from "./../Forms/PasswordInput";
import WalletDb from "stores/WalletDb";
import {Link, useNavigate} from "react-router-dom";
import AccountSelect from "../Forms/AccountSelect";
import WalletUnlockActions from "actions/WalletUnlockActions";
import TransactionConfirmStore from "stores/TransactionConfirmStore";
import LoadingIndicator from "../LoadingIndicator";
import WalletActions from "actions/WalletActions";
import Translate from "react-translate-component";
import {ChainStore, FetchChain} from "bitsharesjs";
import {BackupCreate} from "../Wallet/Backup";
import ReactTooltip from "react-tooltip";
import SettingsActions from "actions/SettingsActions";
import counterpart from "counterpart";
import {scroller} from "react-scroll";
import {getWalletName} from "branding";
import {Notification} from "bitshares-ui-style-guide";
import {useAltStore} from "../../next/hooks/useAltStore";

const LinkComponent = Link as React.ComponentType<any>;

interface CreateAccountState {
    validAccountName: boolean;
    accountName: string;
    validPassword: boolean;
    registrar_account: any;
    loading: boolean;
    hide_refcode: boolean;
    step: number;
}

function CreateAccount() {
    // react-router v6 no longer injects `history` as a prop (see this
    // file's header comment, written for the v5-era assumption that a
    // route `component` always gets it) - `useNavigate()` replaces it.
    const navigate = useNavigate();
    const [state, setState] = React.useState<CreateAccountState>({
        validAccountName: false,
        accountName: "",
        validPassword: false,
        registrar_account: null,
        loading: false,
        hide_refcode: true,
        step: 1
    });

    const mergeState = (partial: Partial<CreateAccountState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const stateRef = React.useRef(state);
    stateRef.current = state;

    const accountNameInputRef = React.useRef<any>(null);
    const passwordRef = React.useRef<any>(null);
    const refcodeRef = React.useRef<any>(null);

    const scrollToInput = () => {
        (scroller as any).scrollTo(`scrollToInput`, {
            duration: 1500,
            delay: 100,
            smooth: true,
            containerId: "accountForm"
        });
    };

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            (SettingsActions as any).changeSetting({
                setting: "passwordLogin",
                value: false
            });
            (ReactTooltip as any).rebuild();
            scrollToInput();
        }
    }, []);

    const isValid = () => {
        const firstAccount = (AccountStore as any).getMyAccounts().length === 0;
        let valid = state.validAccountName;
        if (!(WalletDb as any).getWallet()) {
            valid = valid && state.validPassword;
        }
        if (!firstAccount) {
            valid = valid && state.registrar_account;
        }
        return valid;
    };

    const onAccountNameChange = (e: any) => {
        const partial: Partial<CreateAccountState> = {};
        if (e.valid !== undefined) partial.validAccountName = e.valid;
        if (e.value !== undefined) partial.accountName = e.value;
        mergeState(partial);
    };

    const onPasswordChange = (e: any) => {
        mergeState({validPassword: e.valid});
    };

    const onFinishConfirm = (confirm_store_state: any) => {
        if (
            confirm_store_state.included &&
            confirm_store_state.broadcasted_transaction
        ) {
            (TransactionConfirmStore as any).unlisten(onFinishConfirm);
            (TransactionConfirmStore as any).reset();

            FetchChain("getAccount", stateRef.current.accountName, undefined, {
                [stateRef.current.accountName]: true
            }).then(() => {
                console.log("onFinishConfirm");
                navigate("/wallet/backup/create?newAccount=true");
            });
        }
    };

    const createAccount = (name: string) => {
        const refcode = refcodeRef.current ? refcodeRef.current.value() : null;
        const referralAccount = (AccountStore as any).getState().referralAccount;
        (WalletUnlockActions as any)
            .unlock()
            .then(() => {
                mergeState({loading: true});

                (AccountActions as any)
                    .createAccount(
                        name,
                        stateRef.current.registrar_account,
                        referralAccount || stateRef.current.registrar_account,
                        0,
                        refcode
                    )
                    .then(() => {
                        // User registering his own account
                        if (stateRef.current.registrar_account) {
                            FetchChain("getAccount", name, undefined, {
                                [name]: true
                            }).then(() => {
                                mergeState({
                                    step: 2,
                                    loading: false
                                });
                            });
                            (TransactionConfirmStore as any).listen(
                                onFinishConfirm
                            );
                        } else {
                            // Account registered by the faucet
                            FetchChain("getAccount", name, undefined, {
                                [name]: true
                            }).then(() => {
                                mergeState({
                                    step: 2,
                                    loading: false
                                });
                            });
                        }
                    })
                    .catch((error: any) => {
                        console.log(
                            "ERROR AccountActions.createAccount",
                            error
                        );
                        let error_msg =
                            error.base &&
                            error.base.length &&
                            error.base.length > 0
                                ? error.base[0]
                                : "unknown error";
                        if (error.remote_ip) error_msg = error.remote_ip[0];
                        (Notification as any).error({
                            message: counterpart.translate(
                                "notifications.account_create_failure",
                                {
                                    account_name: name,
                                    error_msg: error_msg
                                }
                            )
                        });
                        mergeState({loading: false});
                    });
            })
            .catch(() => {});
    };

    const createWallet = (password: string) => {
        return (WalletActions as any)
            .setWallet(
                "default", //wallet name
                password
            )
            .then(() => {
                console.log(
                    "Congratulations, your wallet was successfully created."
                );
            })
            .catch((err: any) => {
                console.log("CreateWallet failed:", err);
                (Notification as any).error({
                    message: counterpart.translate(
                        "notifications.account_wallet_create_failure",
                        {
                            error_msg: err
                        }
                    )
                });
            });
    };

    const onSubmit = (e: any) => {
        e.preventDefault();
        if (!isValid()) return;
        const account_name = accountNameInputRef.current.getValue();
        if ((WalletDb as any).getWallet()) {
            createAccount(account_name);
        } else {
            const password = passwordRef.current.value();
            createWallet(password).then(() => createAccount(account_name));
        }
    };

    const onRegistrarAccountChange = (registrar_account: any) => {
        mergeState({registrar_account});
    };

    // showRefcodeInput(e) {
    //     e.preventDefault();
    //     this.setState({hide_refcode: false});
    // }

    const onBackupDownload = () => {
        mergeState({
            step: 3
        });
    };

    const renderAccountCreateForm = () => {
        const {registrar_account} = state;

        const my_accounts = (AccountStore as any).getMyAccounts();
        const firstAccount = my_accounts.length === 0;
        const hasWallet = (WalletDb as any).getWallet();
        const valid = isValid();
        let isLTM = false;
        const registrar = registrar_account
            ? (ChainStore as any).getAccount(registrar_account)
            : null;
        if (registrar) {
            if (registrar.get("lifetime_referrer") == registrar.get("id")) {
                isLTM = true;
            }
        }

        const buttonClass = classNames("submit-button button no-margin", {
            disabled: !valid || (registrar_account && !isLTM)
        });

        return (
            <form
                style={{maxWidth: "40rem"}}
                onSubmit={onSubmit}
                noValidate
                className="create-account-wrapper"
            >
                <p
                    style={{
                        fontWeight: "normal",
                        fontFamily: "Roboto-Medium, arial, sans-serif",
                        fontStyle: "normal"
                    }}
                >
                    {firstAccount ? (
                        <Translate content="wallet.create_w_a" />
                    ) : (
                        <Translate content="wallet.create_a" />
                    )}
                </p>
                <AccountNameInput
                    ref={accountNameInputRef}
                    cheapNameOnly={!!firstAccount}
                    onChange={onAccountNameChange}
                    accountShouldNotExist={true}
                    placeholder={counterpart.translate("wallet.account_public")}
                    noLabel
                />

                {/* Only ask for password if a wallet already exists */}
                {hasWallet ? null : (
                    <PasswordInput
                        ref={passwordRef}
                        confirmation={true}
                        onChange={onPasswordChange}
                        noLabel
                        checkStrength
                    />
                )}

                {/* If this is not the first account, show dropdown for fee payment account */}
                {firstAccount ? null : (
                    <div className="full-width-content form-group no-overflow">
                        <label>
                            <Translate content="account.pay_from" />
                        </label>
                        <AccountSelect
                            account_names={my_accounts}
                            onChange={onRegistrarAccountChange}
                        />
                        {registrar_account && !isLTM ? (
                            <div
                                style={{textAlign: "left"}}
                                className="facolor-error"
                            >
                                <Translate content="wallet.must_be_ltm" />
                            </div>
                        ) : null}
                    </div>
                )}

                <div className="divider" />

                {/* Submit button */}
                {state.loading ? (
                    <LoadingIndicator type="three-bounce" />
                ) : (
                    <button style={{width: "100%"}} className={buttonClass}>
                        <Translate content="account.create_account" />
                    </button>
                )}

                {/* Backup restore option */}
                <div style={{paddingTop: 40}}>
                    <label>
                        <LinkComponent to="/existing-account">
                            <Translate content="wallet.restore" />
                        </LinkComponent>
                    </label>

                    <label>
                        <LinkComponent to="/create-wallet-brainkey">
                            <Translate content="settings.backup_brainkey" />
                        </LinkComponent>
                    </label>
                </div>

                {/* Skip to step 3 */}
                {!hasWallet || firstAccount ? null : (
                    <div style={{paddingTop: 20}}>
                        <label>
                            <a
                                onClick={() => {
                                    mergeState({step: 3});
                                }}
                            >
                                <Translate content="wallet.go_get_started" />
                            </a>
                        </label>
                    </div>
                )}
            </form>
        );
    };

    const renderAccountCreateText = () => {
        const hasWallet = (WalletDb as any).getWallet();
        const my_accounts = (AccountStore as any).getMyAccounts();
        const firstAccount = my_accounts.length === 0;

        return (
            <div className="confirm-checks">
                <h4
                    style={{
                        fontWeight: "normal",
                        fontFamily: "Roboto-Medium, arial, sans-serif",
                        fontStyle: "normal",
                        paddingBottom: 15,
                        marginTop: 0
                    }}
                >
                    <Translate content="wallet.wallet_browser" />
                </h4>

                <p>
                    {!hasWallet ? (
                        <Translate
                            content="wallet.has_wallet"
                            wallet_name={getWalletName()}
                        />
                    ) : null}
                </p>

                <Translate
                    style={{textAlign: "left"} as any}
                    component="p"
                    content="wallet.create_account_text"
                />

                {firstAccount ? (
                    <Translate
                        style={{textAlign: "left"} as any}
                        component="p"
                        content="wallet.first_account_paid"
                    />
                ) : (
                    <Translate
                        style={{textAlign: "left"} as any}
                        component="p"
                        content="wallet.not_first_account"
                    />
                )}

                {/* {this.state.hide_refcode ? null :
                    <div>
                        <RefcodeInput ref="refcode" label="refcode.refcode_optional" expandable={true}/>
                        <br/>
                    </div>
                } */}
            </div>
        );
    };

    const renderBackup = () => {
        return (
            <div className="backup-submit">
                <p>
                    <Translate unsafe content="wallet.wallet_crucial" />
                </p>
                <div className="divider" />
                <BackupCreate noText downloadCb={onBackupDownload} />
            </div>
        );
    };

    const renderBackupText = () => {
        return (
            <div>
                <p
                    style={{
                        fontWeight: "normal",
                        fontFamily: "Roboto-Medium, arial, sans-serif",
                        fontStyle: "normal"
                    }}
                >
                    <Translate content="footer.backup" />
                </p>
                <p>
                    <Translate content="wallet.wallet_move" unsafe />
                </p>
                <p className="txtlabel warning">
                    <Translate unsafe content="wallet.wallet_lose_warning" />
                </p>
            </div>
        );
    };

    const renderGetStarted = () => {
        return (
            <div>
                <table className="table">
                    <tbody>
                        <tr>
                            <td>
                                <Translate content="wallet.tips_dashboard" />:
                            </td>
                            <td>
                                <LinkComponent to="/">
                                    <Translate content="header.dashboard" />
                                </LinkComponent>
                            </td>
                        </tr>

                        <tr>
                            <td>
                                <Translate content="wallet.tips_account" />:
                            </td>
                            <td>
                                <LinkComponent
                                    to={`/account/${state.accountName}/overview`}
                                >
                                    <Translate content="wallet.link_account" />
                                </LinkComponent>
                            </td>
                        </tr>

                        <tr>
                            <td>
                                <Translate content="wallet.tips_deposit" />:
                            </td>
                            <td>
                                <LinkComponent to="/deposit-withdraw">
                                    <Translate content="wallet.link_deposit" />
                                </LinkComponent>
                            </td>
                        </tr>

                        <tr>
                            <td>
                                <Translate content="wallet.tips_transfer" />:
                            </td>
                            <td>
                                <LinkComponent to="/transfer">
                                    <Translate content="wallet.link_transfer" />
                                </LinkComponent>
                            </td>
                        </tr>

                        <tr>
                            <td>
                                <Translate content="wallet.tips_settings" />:
                            </td>
                            <td>
                                <LinkComponent to="/settings">
                                    <Translate content="header.settings" />
                                </LinkComponent>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    const renderGetStartedText = () => {
        return (
            <div>
                <p
                    style={{
                        fontWeight: "normal",
                        fontFamily: "Roboto-Medium, arial, sans-serif",
                        fontStyle: "normal"
                    }}
                >
                    <Translate content="wallet.congrat" />
                </p>

                <p>
                    <Translate content="wallet.tips_explore" />
                </p>

                <p>
                    <Translate content="wallet.tips_header" />
                </p>

                <p className="txtlabel warning">
                    <Translate content="wallet.tips_login" />
                </p>
            </div>
        );
    };

    const {step} = state;

    return (
        <div
            className="sub-content"
            id="scrollToInput"
            {...({name: "scrollToInput"} as any)}
        >
            <div style={{maxWidth: "95vw"}}>
                {step !== 1 ? (
                    <p
                        style={{
                            fontWeight: "normal",
                            fontFamily: "Roboto-Medium, arial, sans-serif",
                            fontStyle: "normal"
                        }}
                    >
                        <Translate content={"wallet.step_" + step} />
                    </p>
                ) : null}

                {step === 1
                    ? renderAccountCreateForm()
                    : step === 2
                    ? renderBackup()
                    : renderGetStarted()}
            </div>

            <div style={{maxWidth: "95vw", paddingTop: "2rem"}}>
                {step === 1
                    ? renderAccountCreateText()
                    : step === 2
                    ? renderBackupText()
                    : renderGetStartedText()}
            </div>
            <LinkComponent to="/">
                <button className="button primary hollow">
                    <Translate content="wallet.back" />
                </button>
            </LinkComponent>
        </div>
    );
}

function CreateAccountContainer() {
    useAltStore(AccountStore);
    return <CreateAccount />;
}

export default CreateAccountContainer;
