// TypeScript/functional-component port of the legacy
// CreateAccountPassword.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes. Structurally a near-twin of
// `CreateAccount.tsx` (same batch) - see that file's header for the
// rationale shared by both (dropping `withRouter`/`connect` for
// `useAltStore`, the nested-ref/`useRef()` translation, the inert
// commented-out `RefcodeInput` block, dropping `shouldComponentUpdate`
// and `state.show_identicon`).
//
// Security-sensitive per AGENTS.md: the auto-generated password
// (`"P" + key.get_random_key().toWif()`, from `bitsharesjs`'s `key`
// module) is computed exactly once, via `useState`'s lazy initializer
// (called only on the very first render, matching the original
// constructor running exactly once per instance) - never logged or
// persisted anywhere beyond component state, same as the original.
// `createAccount` (`AccountActions.createAccountWithPassword`),
// `_unlockAccount` (`WalletDb.validatePassword` +
// `WalletUnlockActions.checkLock.defer()`) are transcribed verbatim.
//
// `AccountNameInput` here resolves from `Forms/AccountNameInput.jsx`
// (not `AccountNameInputStyleGuide.jsx`, as in `CreateAccount.tsx`) -
// still a class component with the same nested `ref="nameInput"`
// pattern, so the same `useRef()` translation applies.
//
// Dropped as confirmed dead (found while porting): `_renderAccountCreateText`
// is fully defined but never called anywhere in the original - unlike
// its identically-named twin in `CreateAccount.tsx`, which *is* called
// from `render()`, this component's own `render()` never renders a
// second text column at all (`step === 1` only ever renders
// `_renderAccountCreateForm()`, no side text).
import * as React from "react";
import classNames from "classnames";
import AccountActions from "actions/AccountActions";
import AccountStore from "stores/AccountStore";
import AccountNameInput from "./../Forms/AccountNameInput";
import WalletDb from "stores/WalletDb";
import {Link} from "react-router-dom";
import AccountSelect from "../Forms/AccountSelect";
import TransactionConfirmStore from "stores/TransactionConfirmStore";
import LoadingIndicator from "../LoadingIndicator";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import {ChainStore, FetchChain, key} from "bitsharesjs";
import ReactTooltip from "react-tooltip";
import SettingsActions from "actions/SettingsActions";
import WalletUnlockActions from "actions/WalletUnlockActions";
import Icon from "../Icon/Icon";
import CopyButton from "../Utility/CopyButton";
import {scroller} from "react-scroll";
import {Notification, Tooltip} from "bitshares-ui-style-guide";
import {useAltStore} from "../../next/hooks/useAltStore";

const LinkComponent = Link as React.ComponentType<any>;

interface CreateAccountPasswordState {
    validAccountName: boolean;
    accountName: string;
    validPassword: boolean;
    registrar_account: any;
    loading: boolean;
    hide_refcode: boolean;
    step: number;
    showPass: boolean;
    generatedPassword: string;
    confirm_password: string;
    understand_1: boolean;
    understand_2: boolean;
    understand_3: boolean;
}

interface CreateAccountPasswordCoreProps {
    history: any;
}

function CreateAccountPassword({history}: CreateAccountPasswordCoreProps) {
    const [state, setState] = React.useState<CreateAccountPasswordState>(
        () => ({
            validAccountName: false,
            accountName: "",
            validPassword: false,
            registrar_account: null,
            loading: false,
            hide_refcode: true,
            step: 1,
            showPass: false,
            generatedPassword: (
                "P" + (key as any).get_random_key().toWif()
            ).substr(0, 45),
            confirm_password: "",
            understand_1: false,
            understand_2: false,
            understand_3: false
        })
    );

    const mergeState = (partial: Partial<CreateAccountPasswordState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const stateRef = React.useRef(state);
    stateRef.current = state;

    const accountNameInputRef = React.useRef<any>(null);
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
            if (!(WalletDb as any).getWallet()) {
                (SettingsActions as any).changeSetting({
                    setting: "passwordLogin",
                    value: true
                });
            }
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
        return valid && state.understand_1 && state.understand_2;
    };

    const onAccountNameChange = (e: any) => {
        const partial: Partial<CreateAccountPasswordState> = {};
        if (e.valid !== undefined) partial.validAccountName = e.valid;
        if (e.value !== undefined) partial.accountName = e.value;
        mergeState(partial);
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
                history.push("/wallet/backup/create?newAccount=true");
            });
        }
    };

    const unlockAccount = (name: string, password: string) => {
        (SettingsActions as any).changeSetting({
            setting: "passwordLogin",
            value: true
        });

        (WalletDb as any).validatePassword(password, true, name);
        (WalletUnlockActions as any).checkLock.defer();
    };

    const createAccount = (name: string, password: string) => {
        const refcode = refcodeRef.current ? refcodeRef.current.value() : null;
        const referralAccount = (AccountStore as any).getState().referralAccount;
        mergeState({loading: true});

        (AccountActions as any)
            .createAccountWithPassword(
                name,
                password,
                stateRef.current.registrar_account,
                referralAccount || stateRef.current.registrar_account,
                0,
                refcode
            )
            .then(() => {
                (AccountActions as any).setPasswordAccount(name);
                // User registering his own account
                if (stateRef.current.registrar_account) {
                    FetchChain("getAccount", name, undefined, {
                        [name]: true
                    }).then(() => {
                        mergeState({
                            step: 2,
                            loading: false
                        });
                        unlockAccount(name, password);
                    });
                    (TransactionConfirmStore as any).listen(onFinishConfirm);
                } else {
                    // Account registered by the faucet
                    FetchChain("getAccount", name, undefined, {
                        [name]: true
                    }).then(() => {
                        mergeState({
                            step: 2
                        });
                        unlockAccount(name, password);
                    });
                }
            })
            .catch((error: any) => {
                console.log("ERROR AccountActions.createAccount", error);
                let error_msg =
                    error.base && error.base.length && error.base.length > 0
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
    };

    const onSubmit = (e: any) => {
        e.preventDefault();
        if (!isValid()) return;
        const account_name = accountNameInputRef.current.getValue();
        // if (WalletDb.getWallet()) {
        //     this.createAccount(account_name);
        // } else {
        const password = state.generatedPassword;
        createAccount(account_name, password);
    };

    const onRegistrarAccountChange = (registrar_account: any) => {
        mergeState({registrar_account});
    };

    // showRefcodeInput(e) {
    //     e.preventDefault();
    //     this.setState({hide_refcode: false});
    // }

    const onInput = (value: string, e: any) => {
        mergeState({
            [value]:
                value === "confirm_password"
                    ? e.target.value
                    : !(state as any)[value],
            validPassword:
                value === "confirm_password"
                    ? e.target.value === state.generatedPassword
                    : state.validPassword
        } as any);
    };

    const renderAccountCreateForm = () => {
        const {registrar_account} = state;

        const my_accounts = (AccountStore as any).getMyAccounts();
        const firstAccount = my_accounts.length === 0;
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
            <div style={{textAlign: "left"}}>
                <form
                    style={{maxWidth: "60rem"}}
                    onSubmit={onSubmit}
                    noValidate
                >
                    <AccountNameInput
                        ref={(ref: any) => {
                            if (ref) {
                                accountNameInputRef.current = ref.refs.nameInput;
                            }
                        }}
                        cheapNameOnly={!!firstAccount}
                        onChange={onAccountNameChange}
                        accountShouldNotExist={true}
                        placeholder={counterpart.translate(
                            "wallet.account_public"
                        )}
                        noLabel
                    />

                    <section className="form-group">
                        <label className="left-label">
                            <Translate content="wallet.generated" />
                            &nbsp;&nbsp;
                            <Tooltip
                                title={
                                    <div
                                        dangerouslySetInnerHTML={{
                                            __html: counterpart.translate(
                                                "tooltip.generate"
                                            )
                                        }}
                                    />
                                }
                            >
                                <span className="tooltip">
                                    <Icon
                                        name="question-circle"
                                        title="icons.question_circle"
                                    />
                                </span>
                            </Tooltip>
                        </label>
                        <div style={{paddingBottom: "0.5rem"}}>
                            <span className="inline-label">
                                <textarea
                                    style={{
                                        padding: "0px",
                                        marginBottom: "0px"
                                    }}
                                    rows={3}
                                    readOnly
                                    disabled
                                    value={state.generatedPassword}
                                />

                                <CopyButton
                                    text={state.generatedPassword}
                                    tip="tooltip.copy_password"
                                    dataPlace="top"
                                />
                            </span>
                        </div>
                    </section>

                    <section>
                        <label className="left-label">
                            <Translate content="wallet.confirm_password" />
                        </label>
                        <input
                            type="password"
                            name="password"
                            id="password"
                            value={state.confirm_password}
                            onChange={(e: any) =>
                                onInput("confirm_password", e)
                            }
                        />
                        {state.confirm_password &&
                        state.confirm_password !== state.generatedPassword ? (
                            <div className="has-error">
                                <Translate content="wallet.confirm_error" />
                            </div>
                        ) : null}
                    </section>

                    <br />

                    <div
                        className="confirm-checks"
                        onClick={(e: any) => onInput("understand_3", e)}
                    >
                        <label
                            htmlFor="checkbox-1"
                            style={{position: "relative"}}
                        >
                            <input
                                type="checkbox"
                                id="checkbox-1"
                                onChange={() => {}}
                                checked={state.understand_3}
                                style={{
                                    position: "absolute",
                                    top: "-5px",
                                    left: "0"
                                }}
                            />
                            <div style={{paddingLeft: "30px"}}>
                                <Translate content="wallet.understand_3" />
                            </div>
                        </label>
                    </div>
                    <br />
                    <div
                        className="confirm-checks"
                        onClick={(e: any) => onInput("understand_1", e)}
                    >
                        <label
                            htmlFor="checkbox-2"
                            style={{position: "relative"}}
                        >
                            <input
                                type="checkbox"
                                id="checkbox-2"
                                onChange={() => {}}
                                checked={state.understand_1}
                                style={{
                                    position: "absolute",
                                    top: "-5px",
                                    left: "0"
                                }}
                            />
                            <div style={{paddingLeft: "30px"}}>
                                <Translate content="wallet.understand_1" />
                            </div>
                        </label>
                    </div>
                    <br />

                    <div
                        className="confirm-checks"
                        style={{paddingBottom: "1.5rem"}}
                        onClick={(e: any) => onInput("understand_2", e)}
                    >
                        <label
                            htmlFor="checkbox-3"
                            style={{position: "relative"}}
                        >
                            <input
                                type="checkbox"
                                id="checkbox-3"
                                onChange={() => {}}
                                checked={state.understand_2}
                                style={{
                                    position: "absolute",
                                    top: "-5px",
                                    left: "0"
                                }}
                            />
                            <div style={{paddingLeft: "30px"}}>
                                <Translate content="wallet.understand_2" />
                            </div>
                        </label>
                    </div>
                    {/* If this is not the first account, show dropdown for fee payment account */}
                    {firstAccount ? null : (
                        <div
                            className="full-width-content form-group no-overflow"
                            style={{paddingTop: 30}}
                        >
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

                    {/* Submit button */}
                    {state.loading ? (
                        <LoadingIndicator type="three-bounce" />
                    ) : (
                        <button style={{width: "100%"}} className={buttonClass}>
                            <Translate content="account.create_account" />
                        </button>
                    )}

                    {/* Backup restore option */}
                    {/* <div style={{paddingTop: 40}}>
                    <label>
                        <Link to="/existing-account">
                            <Translate content="wallet.restore" />
                        </Link>
                    </label>

                    <label>
                        <Link to="/create-wallet-brainkey">
                            <Translate content="settings.backup_brainkey" />
                        </Link>
                    </label>
                </div> */}

                    {/* Skip to step 3 */}
                    {/* {(!hasWallet || firstAccount ) ? null :<div style={{paddingTop: 20}}>
                    <label>
                        <a onClick={() => {this.setState({step: 3});}}><Translate content="wallet.go_get_started" /></a>
                    </label>
                </div>} */}
                </form>
                {/* <br />
                <p>
                    <Translate content="wallet.bts_rules" unsafe />
                </p> */}
            </div>
        );
    };

    const renderBackup = () => {
        return (
            <div className="backup-submit">
                <p>
                    <Translate unsafe content="wallet.password_crucial" />
                </p>

                <div>
                    {!state.showPass ? (
                        <div
                            onClick={() => {
                                mergeState({showPass: true});
                            }}
                            className="button"
                        >
                            <Translate content="wallet.password_show" />
                        </div>
                    ) : (
                        <div>
                            <h5>
                                <Translate content="settings.password" />:
                            </h5>
                            <p
                                style={{
                                    fontWeight: "normal",
                                    fontFamily:
                                        "Roboto-Medium, arial, sans-serif",
                                    fontStyle: "normal",
                                    textAlign: "center"
                                }}
                            >
                                {state.generatedPassword}
                            </p>
                        </div>
                    )}
                </div>
                <div className="divider" />
                <p className="txtlabel warning">
                    <Translate unsafe content="wallet.password_lose_warning" />
                </p>

                <div
                    style={{width: "100%"}}
                    onClick={() => {
                        history.push("/");
                    }}
                    className="button"
                >
                    <Translate content="wallet.ok_done" />
                </div>
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
                    <Translate content="wallet.tips_explore_pass" />
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
    // let my_accounts = AccountStore.getMyAccounts();
    // let firstAccount = my_accounts.length === 0;
    return (
        <div
            className="sub-content"
            id="scrollToInput"
            {...({name: "scrollToInput"} as any)}
        >
            <div>
                {step === 2 ? (
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

                {step === 3 ? renderGetStartedText() : null}

                {step === 1 ? (
                    <div>{renderAccountCreateForm()}</div>
                ) : step === 2 ? (
                    renderBackup()
                ) : (
                    renderGetStarted()
                )}
            </div>
        </div>
    );
}

interface CreateAccountPasswordContainerProps {
    history: any;
    [key: string]: any;
}

function CreateAccountPasswordContainer({
    history
}: CreateAccountPasswordContainerProps) {
    useAltStore(AccountStore);
    return <CreateAccountPassword history={history} />;
}

export default CreateAccountPasswordContainer;
