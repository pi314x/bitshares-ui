// TypeScript/functional-component port of the legacy AccountLogin.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md), part of the `Login/` directory
// (4 files, directory complete). Mechanical class-to-hooks translation.
//
// SECURITY (AGENTS.md): this is the wallet-unlock-by-password-login
// flow. `onPasswordEnter()` is preserved byte-for-byte, including both
// `WalletDb.validatePassword(password, true, account)` calls (one
// immediate, one repeated inside the 550ms `setTimeout` - both kept,
// unchanged, exactly where they were, same arguments, same order; this
// is not simplified to a single call even though the repetition looks
// avoidable, per AGENTS.md's "prefer minimal diffs, never restructure
// this logic" directive), the `WalletDb.isLocked()` check gating
// `passwordError`, and `WalletUnlockActions.change()` at the end of the
// success path. Nothing new logs, persists, or caches the password; it
// still lives only in component state (`password`, now via `useState`)
// for exactly as long as the original kept it there (cleared to `""` on
// successful unlock, same as the original's `this.setState({password:
// ""})`).
//
// Grepped every `console.*` call in this file: there are none. No
// password-logging call was found or needed dropping.
//
// `AltContainer` injecting `passwordAccount` (`() => AccountStore
// .getState().passwordAccount || ""`) becomes an outer `AccountLogin`
// wrapper calling `useAltStore(AccountStore)` once and passing
// `passwordAccount` down to an `AccountLoginCore` function - this
// migration's established Container+Core split. Precedence preserved:
// `AltContainer.render()` does `React.cloneElement(children,
// this.getProps())` (`node_modules/alt-container/src/AltContainer.js`),
// and `cloneElement`'s second argument always overrides any same-named
// prop already on the element - so the injected `passwordAccount` would
// have won over a same-named prop the caller passed directly (moot in
// practice: `Login.jsx` never passes a `passwordAccount` prop itself) -
// replicated by spreading `{...props}` first, then overriding with the
// store-derived `passwordAccount` in the wrapper below, matching this
// migration's general "store wins on collision" rule (see
// `Account/AccountPortfolioList.tsx`'s header comment for the alt-react
// `connect` version of the same rule).
//
// `shouldComponentUpdate`/`componentDidUpdate`/
// `UNSAFE_componentWillReceiveProps` interaction (all three present in
// the original): `UNSAFE_componentWillReceiveProps` runs first (before
// `shouldComponentUpdate` is even consulted) and can call `setState`,
// which React folds into the same pending update. `shouldComponentUpdate
// (np, ns)` then gates whether `render()` *and* `componentDidUpdate` run
// at all for that update, by shallow-comparing every field of props and
// of state via `utils.are_equal_shallow`. Dropped entirely here, per
// this migration's firm precedent for pure re-render guards (see
// `Account/AccountPools.tsx`/`AccountOrders.tsx`/`RecentTransactions
// .tsx`/`AccountPortfolioList.tsx` header comments) - but unlike the
// sibling case where that precedent doesn't apply (`Forms/
// AccountNameInput.tsx`'s `shouldComponentUpdate`, which gates a
// `componentDidUpdate` that unconditionally notifies a *parent* via
// `onChange({valid: ...})` and was therefore replicated exactly via a
// matching `useEffect` dependency array), it does apply here: this
// `componentDidUpdate`'s two effects are internally self-guarded and
// have no parent-visible side effect. `ReactTooltip.rebuild()` is purely
// idempotent (redraws tooltip DOM bindings; harmless to call more
// often). The `.focus()` call is gated by its own condition
// (`!previousProps.active && this.props.active && this.state
// .accountName`), which can only newly become true when `active`
// actually flips - but if `active` changes at all, `utils
// .are_equal_shallow(np, this.props)` is already `false` on that very
// update (since `active` is a field of `props`), so
// `shouldComponentUpdate` can only ever return `false` in states where
// this inner condition was already false anyway. Dropping the gate
// therefore changes only how often an already-idempotent side effect
// re-runs on genuinely-unchanged input, never the final observed
// behavior. `componentDidUpdate` itself becomes a dependency-free
// `useEffect` (fires after every render except the first, exactly
// matching `componentDidUpdate`'s "never on mount, every update
// otherwise" semantics once the gate is removed), and
// `UNSAFE_componentWillReceiveProps` becomes its own separate
// mount-skipped effect keyed to the `passwordAccount` prop (the only
// field it reads), each with its own independent `isMountRef` guard
// (same per-effect-owned-ref pattern as the existing `Account/
// AccountInputStyleGuide.tsx` port).
//
// The legacy string ref (`ref={"password"}`, `this.refs.password`) is
// replaced by a plain `useRef`, called exactly as unguarded as the
// original (`this.refs.password.focus()` has no null-check, so neither
// does `passwordInputRef.current.focus()`). Grepped app-wide for
// `Login/AccountLogin` and for any external ref into this component -
// none found (the exported component was already an `AltContainer`-
// wrapping function, which never forwarded a ref to the inner class
// either) - so no `forwardRef`/`useImperativeHandle` is needed.
//
// Dropped as confirmed dead (grepped/read in full):
// - `reset()`: never called anywhere in this file, and unreachable from
//   outside it even in the original (the exported default was already a
//   wrapper function, not the class itself, so no external
//   `ref.reset()` call was ever possible).
// - `onAccountChanged(account)`: bound in the constructor but never
//   referenced anywhere in `render()` or any other method -
//   `accountChanged` (not `onAccountChanged`) is the one actually wired
//   to `AccountInputStyleGuide`'s `onChange`.
//
// Preserved verbatim (unread/dead state, not "cleaned up"): `state
// .account` (set by `accountChanged`, never read anywhere in `render()`
// or elsewhere) is kept as a real state write for byte-for-byte
// fidelity, as is the `error: null` field `accountChanged`'s "found an
// account" branch sets alongside it (never read either - there was no
// `error` field in `getInitialState()` to begin with). The "cleared"
// branch of `accountChanged` (falsy `accountName`) does *not* set
// `error` in the original either, and still doesn't here.
//
// TS-forced adjustments (the already-ported, out-of-scope `Account/
// AccountInputStyleGuide.tsx` rejects what the original passed it):
// - `renderNameInput()` passed `size={60}` and `hideImage` to
//   `AccountInputStyleGuide` in the original. `AccountInputStyleGuide
//   .tsx`'s props interface declares neither and never reads them
//   (grep-confirmed, and this was already the case before this port -
//   `AccountLogin.jsx` was the only call site anywhere in the app that
//   ever passed them) - dropped at this call site, since TypeScript's
//   structural prop checking rejects unknown props.
// - `AccountInputStyleGuide.tsx`'s `value` prop is typed `string |
//   undefined` (no `null`), but `state.accountName` can be `null` (set
//   by `accountChanged` when cleared). Passed as `accountName ||
//   undefined`, which also maps `""` to `undefined` - behaviorally inert
//   either way, since `AccountInputStyleGuide`'s own internal logic
//   (`if (isInputActive || !value) ...`) already treats `""`, `null`,
//   and `undefined` identically via truthiness.
// - `document.getElementById("password-error")` is typed
//   `HTMLElement | null` under this project's `strict: true`; the
//   original's `.classList.remove(...)` call had no null-check, so an
//   `as HTMLElement` cast is used to keep that same unguarded access
//   rather than adding a new runtime check the original never had (a
//   non-null assertion (`!`) would do the same but trips this project's
//   `@typescript-eslint/no-non-null-assertion` warning; the cast avoids
//   that without changing behavior).
import * as React from "react";
import Translate from "react-translate-component";
import ReactTooltip from "react-tooltip";
import WalletDb from "stores/WalletDb";
import AccountStore from "stores/AccountStore";
import WalletUnlockActions from "actions/WalletUnlockActions";
import AccountActions from "actions/AccountActions";
import SettingsActions from "actions/SettingsActions";
import ChainStore from "bitsharesjs/es/chain/src/ChainStore";
import AccountInputStyleGuide from "../Account/AccountInputStyleGuide";
import {Button, Input, Form} from "bitshares-ui-style-guide";
import counterpart from "counterpart";
import {useAltStore} from "../../next/hooks/useAltStore";

interface AccountLoginState {
    password: string;
    passwordError: boolean | null;
    accountName: string | null;
    account: any;
    passwordVisible: boolean;
    error?: any;
}

interface AccountLoginCoreProps {
    active: boolean;
    onChangeActive: () => void;
    goToWalletModel: () => void;
    history: any;
    passwordAccount?: string;
}

function getInitialState(passwordAccount?: string): AccountLoginState {
    return {
        password: "",
        passwordError: null,
        accountName: passwordAccount || null,
        account: null,
        passwordVisible: false
    };
}

function AccountLoginCore({
    active,
    onChangeActive,
    goToWalletModel,
    history,
    passwordAccount
}: AccountLoginCoreProps) {
    const [state, setState] = React.useState<AccountLoginState>(() =>
        getInitialState(passwordAccount)
    );
    const mergeState = (patch: Partial<AccountLoginState>) =>
        setState(prev => ({...prev, ...patch}));
    const stateRef = React.useRef(state);
    stateRef.current = state;

    const passwordInputRef = React.useRef<any>(null);

    // componentDidUpdate - see header comment for why shouldComponentUpdate's
    // gate is dropped. Runs after every render except the first.
    const isMountForUpdateRef = React.useRef(true);
    const prevActiveRef = React.useRef(active);
    React.useEffect(() => {
        if (isMountForUpdateRef.current) {
            isMountForUpdateRef.current = false;
            prevActiveRef.current = active;
            return;
        }
        ReactTooltip.rebuild();
        if (!prevActiveRef.current && active && stateRef.current.accountName) {
            passwordInputRef.current.focus();
        }
        prevActiveRef.current = active;
    });

    // UNSAFE_componentWillReceiveProps - adopts an incoming
    // passwordAccount once, when no accountName is set yet. Never fires
    // on mount.
    const isMountForReceivePropsRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountForReceivePropsRef.current) {
            isMountForReceivePropsRef.current = false;
            return;
        }
        if (passwordAccount && !stateRef.current.accountName) {
            mergeState({accountName: passwordAccount});
        }
    }, [passwordAccount]);

    const handlePasswordChange = (e: any) => {
        mergeState({password: e.target.value});
    };

    const onPasswordEnter = (e?: any) => {
        e && e.preventDefault();
        const password = stateRef.current.password;
        const account = stateRef.current.accountName;
        mergeState({passwordError: null});

        WalletDb.validatePassword(
            password,
            true, // unlock
            account
        );

        setTimeout(() => {
            WalletDb.validatePassword(
                password,
                true, // unlock
                account
            );

            if (WalletDb.isLocked()) {
                mergeState({passwordError: true});
                return false;
            }
            mergeState({
                password: ""
            });

            AccountActions.setPasswordAccount(account);
            SettingsActions.changeSetting({
                setting: "passwordLogin",
                value: true
            });
            history.push("/");
            (WalletUnlockActions as any).change();
        }, 550);

        return false;
    };

    const accountChanged = (accountName: string) => {
        if (!accountName) {
            mergeState({account: null, accountName: null});
        } else {
            const account = (ChainStore as any).getAccount(accountName);

            mergeState({
                accountName,
                error: null,
                account: account
            });
        }
    };

    const hideTooltip = () => {
        (document.getElementById(
            "password-error"
        ) as HTMLElement).classList.remove("custom-tooltip");
        ReactTooltip.hide();
    };

    const renderButtons = () => {
        return (
            <Form.Item style={{textAlign: "center"}}>
                {active ? (
                    <Button onClick={onPasswordEnter} type="primary">
                        {counterpart.translate("login.loginButton")}
                    </Button>
                ) : (
                    <Button>
                        {counterpart.translate("registration.select")}
                    </Button>
                )}
            </Form.Item>
        );
    };

    const renderTooltip = () => {
        return (
            <ReactTooltip
                id="password-error"
                className="custom-tooltip text-left"
            >
                <div className="tooltip-text">
                    <Translate content="tooltip.login-tooltip.incorrectPassword.begin" />
                    <Translate
                        onClick={goToWalletModel}
                        className="active-upload-text without-bin cursor-pointer"
                        content="tooltip.login-tooltip.incorrectPassword.model"
                    />
                    <Translate content="tooltip.login-tooltip.incorrectPassword.end" />
                    <span
                        onClick={() => hideTooltip()}
                        className="close-button"
                    >
                        ×
                    </span>
                </div>
            </ReactTooltip>
        );
    };

    const renderNameInput = () => {
        const {accountName} = state;

        return (
            <AccountInputStyleGuide
                label="account.name"
                value={accountName || undefined}
                onChange={accountChanged}
                placeholder={"account.name"}
                focus={active && !state.accountName}
            />
        );
    };

    const renderPasswordInput = () => {
        const {passwordError, passwordVisible} = state;

        const getValidateStatus = () => {
            return passwordError !== null ? "error" : "";
        };

        const getHelp = () => {
            return passwordError !== null ? (
                <Translate
                    data-for="password-error"
                    data-tip
                    data-place="bottom"
                    data-effect="solid"
                    data-delay-hide={500}
                    content="wallet.pass_incorrect"
                />
            ) : null;
        };

        return (
            <Form.Item
                label={"Password"}
                help={getHelp()}
                validateStatus={getValidateStatus()}
            >
                <Input
                    ref={passwordInputRef}
                    placeholder={counterpart.translate("wallet.enter_password")}
                    style={{width: "100%"}}
                    value={state.password}
                    onChange={handlePasswordChange}
                    type={!passwordVisible ? "password" : "text"}
                    className={`${
                        passwordError ? "input-warning" : ""
                    } input create-account-input`}
                />
            </Form.Item>
        );
    };

    return (
        <div onClick={onChangeActive} className="account-block">
            <div className="overflow-bg-block show-for-small-only">
                <span className="content" />
            </div>

            <Form
                layout="vertical"
                className={!active ? "display-none" : ""}
                style={{textAlign: "left"}}
            >
                {renderNameInput()}

                {renderPasswordInput()}

                {renderButtons()}
            </Form>
            {renderTooltip()}
        </div>
    );
}

interface AccountLoginProps {
    active: boolean;
    onChangeActive: () => void;
    goToWalletModel: () => void;
    history: any;
}

function AccountLogin(props: AccountLoginProps) {
    const accountState = useAltStore<any>(AccountStore);

    return (
        <AccountLoginCore
            {...props}
            passwordAccount={accountState.passwordAccount || ""}
        />
    );
}

export default AccountLogin;
