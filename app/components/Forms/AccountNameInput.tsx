// TypeScript/functional-component port of the legacy AccountNameInput.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: only validates an account name
// string, no key/password material.
//
// The outer `StoreWrapper` (`AltContainer` injecting `searchAccounts`
// from `AccountStore`) becomes a Container calling `useAltStore
// (AccountStore)` and reading `.searchAccounts` off its state directly -
// the standard `connect`/`AltContainer` -> `useAltStore` translation used
// throughout this migration.
//
// Real, external ref-based caller: `Account/CreateAccountPassword.tsx`
// (already ported) does `ref.refs.nameInput` to reach `.getValue()` on
// the inner class instance - the one exception in this component to
// this migration's usual "grep confirms the imperative API is dead"
// finding. This file's default export is now `forwardRef`+
// `useImperativeHandle`, exposing `getValue` directly (collapsing the
// original's two-hop `StoreWrapper` -> `this.refs.nameInput` indirection
// into one hop, since a function component has no `this.refs` at all) -
// `CreateAccountPassword.tsx` is updated in this same commit to pass the
// ref straight through (`ref={accountNameInputRef}`) instead of reaching
// into `.refs.nameInput`. `setValue`/`clear`/`focus`/`valid` are dropped
// as confirmed dead: grepped every file in the app for a ref on this
// component - only `CreateAccountPassword.tsx` holds one, and it only
// ever calls `.getValue()`.
//
// `shouldComponentUpdate` here isn't a pure performance guard: because
// React skips `componentDidUpdate` whenever `shouldComponentUpdate`
// returns `false`, its exact field list (`value`/`error`/`account_name`/
// `existing_account` state, `searchAccounts` prop) also gates whether
// `componentDidUpdate`'s `onChange({valid: !getError()})` side effect
// ever fires. Replicated precisely, without needing to reimplement the
// boolean comparison at all: a `useEffect` naturally only re-fires when
// its dependency array's values change, so keying it on that exact same
// field list reproduces the gating for free (dropping `existing_account`
// from the array changes nothing, since that field is confirmed dead -
// see below - and a value that never changes can never affect when a
// dependency array differs).
//
// `validateAccountName`'s `this.state.error = ...`/`this.state.warning =
// ...` direct-mutation-before-setState pattern (a real anti-pattern, but
// deliberate here: it's followed immediately by `this.getError()`, which
// reads `this.state.value` - genuinely stale, since `value` itself was
// never directly mutated, only passed to `setState` - alongside the
// freshly-mutated `this.state.error`) produces a real, subtle quirk: on
// the very first call (`state.value` still `null` from initial state),
// `getError()`'s `if (this.state.value === null) return null;` always
// short-circuits, so the first `onChange({valid: ...})` always reports
// `valid: true` regardless of the just-computed error; only from the
// second call onward does `getError()` actually see the fresh error.
// Replicated by giving this file's own `stateRef` mirror (used
// throughout this migration to let closures read state synchronously)
// the *same* direct-mutation treatment for exactly this one function -
// `stateRef.current.error`/`.warning` are mutated in place before
// `mergeState`/`getError()` run, while `stateRef.current.value` is only
// ever refreshed by the normal end-of-render sync, faithfully
// reproducing "value is stale, error/warning are fresh" for this one
// synchronous call.
//
// Dropped as confirmed dead (grepped): `state.existing_account` (never
// set anywhere after its `false` initial value, never read in
// `render()` - its only appearance was in the now-superseded
// `shouldComponentUpdate` comparison). `focus()`'s only consumer,
// `this.refs.input`, along with the dropped method itself.
//
// Preserved verbatim, not "fixed": `onKeyDown` checks the bare global
// `event.keyCode` rather than its own `e` parameter's `keyCode` - a real
// pre-existing bug (relying on the non-standard, unreliable
// `window.event` instead of the synthetic event actually passed in).
// `class_name`'s `"has-error": false` is a hardcoded `false`, so that
// CSS class is never actually applied regardless of the real error
// state. The commented-out `{noLabel ? null : <label>...}` block (and
// its accompanying `// let {noLabel} = this.props;`) is kept as an inert
// comment, matching this migration's established treatment of such
// blocks (e.g. `Account/CreateAccount.tsx`'s `RefcodeInput` block) -
// `noLabel` itself is accepted as a prop (matching the original's
// `defaultProps`) but has zero effect on anything actually rendered.
import * as React from "react";
import classNames from "classnames";
import AccountActions from "actions/AccountActions";
import AccountStore from "stores/AccountStore";
import {ChainValidation} from "bitsharesjs";
import counterpart from "counterpart";
import {useAltStore} from "../../next/hooks/useAltStore";

interface AccountNameInputState {
    value: any;
    error: any;
    warning?: any;
    account_name?: any;
}

interface AccountNameInputHandle {
    getValue: () => any;
}

interface AccountNameInputCoreProps {
    id?: string;
    placeholder?: any;
    initial_value?: string;
    onChange?: (result: {value?: any; valid: boolean}) => void;
    onEnter?: (e: any) => void;
    accountShouldExist?: boolean;
    accountShouldNotExist?: boolean;
    cheapNameOnly?: boolean;
    noLabel?: boolean;
    searchAccounts: any;
}

const AccountNameInputCore = React.forwardRef<
    AccountNameInputHandle,
    AccountNameInputCoreProps
>(function AccountNameInputCore(
    {
        placeholder,
        initial_value,
        onChange,
        onEnter,
        accountShouldExist,
        accountShouldNotExist,
        cheapNameOnly,
        searchAccounts
    },
    ref
) {
    const [state, setState] = React.useState<AccountNameInputState>({
        value: null,
        error: null
    });
    const stateRef = React.useRef(state);
    stateRef.current = state;

    const mergeState = (patch: Partial<AccountNameInputState>) => {
        setState(prev => ({...prev, ...patch}));
    };

    const getError = () => {
        const s = stateRef.current;
        if (s.value === null) return null;
        let error = null;
        if (s.error) {
            error = s.error;
        } else if (accountShouldExist || accountShouldNotExist) {
            const account = (searchAccounts || []).find(
                (a: any) => a === s.value
            );
            if (accountShouldNotExist && account) {
                error = counterpart.translate(
                    "account.name_input.name_is_taken"
                );
            }
            if (accountShouldExist && !account) {
                error = counterpart.translate("account.name_input.not_found");
            }
        }
        return error;
    };

    React.useImperativeHandle(ref, () => ({
        getValue: () => stateRef.current.value
    }));

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            return;
        }
        if (onChange) onChange({valid: !getError()});
    }, [state.value, state.error, searchAccounts]);

    const validateAccountName = (value: any) => {
        stateRef.current.error =
            value === ""
                ? "Please enter valid account name"
                : (ChainValidation as any).is_account_name_error(value);

        stateRef.current.warning = null;
        if (cheapNameOnly) {
            if (
                !stateRef.current.error &&
                !(ChainValidation as any).is_cheap_name(value)
            )
                stateRef.current.error = counterpart.translate(
                    "account.name_input.premium_name_faucet"
                );
        } else {
            if (
                !stateRef.current.error &&
                !(ChainValidation as any).is_cheap_name(value)
            )
                stateRef.current.warning = counterpart.translate(
                    "account.name_input.premium_name_warning"
                );
        }
        mergeState({
            value: value,
            error: stateRef.current.error,
            warning: stateRef.current.warning
        });
        if (onChange) onChange({value: value, valid: !getError()});
        if (accountShouldExist || accountShouldNotExist)
            (AccountActions as any).accountSearch(value);
    };

    const handleChange = (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        // Simplify the rules (prevent typing of invalid characters)
        let account_name = e.target.value.toLowerCase();
        account_name = account_name.match(/[a-z0-9\.-]+/);
        account_name = account_name ? account_name[0] : "";
        mergeState({account_name});
        validateAccountName(account_name);
    };

    const onKeyDown = (e: any) => {
        // Preserved verbatim: reads the bare global `event`, not `e`.
        if (onEnter && (window as any).event?.keyCode === 13) onEnter(e);
    };

    const error = getError() || "";
    const class_name = classNames("form-group", "account-name", {
        "has-error": false
    });
    const warning = state.warning;
    // let {noLabel} = this.props;

    return (
        <div className={class_name}>
            {/* {noLabel ? null : <label><Translate content="account.name" /></label>} */}
            <section>
                <label className="left-label">{placeholder}</label>
                <input
                    name="username"
                    id="username"
                    type="text"
                    autoComplete="username"
                    placeholder={null as any}
                    onChange={handleChange}
                    onKeyDown={onKeyDown}
                    value={state.account_name || initial_value}
                />
            </section>
            <div style={{textAlign: "left"}} className="facolor-error">
                {error}
            </div>
            <div style={{textAlign: "left"}} className="facolor-warning">
                {error ? null : warning}
            </div>
        </div>
    );
});

interface AccountNameInputProps {
    id?: string;
    placeholder?: any;
    initial_value?: string;
    onChange?: (result: {value?: any; valid: boolean}) => void;
    onEnter?: (e: any) => void;
    accountShouldExist?: boolean;
    accountShouldNotExist?: boolean;
    cheapNameOnly?: boolean;
    noLabel?: boolean;
}

const AccountNameInput = React.forwardRef<
    AccountNameInputHandle,
    AccountNameInputProps
>(function AccountNameInput(props, ref) {
    const accountState = useAltStore<any>(AccountStore);
    const searchAccounts = accountState.searchAccounts;

    return (
        <AccountNameInputCore
            {...props}
            searchAccounts={searchAccounts}
            ref={ref}
        />
    );
});

export default AccountNameInput;
