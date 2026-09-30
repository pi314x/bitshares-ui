// TypeScript/functional-component port of the legacy
// AccountNameInputStyleGuide.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// A near-twin of the sibling `Forms/AccountNameInput.tsx` (same batch) -
// see that file's header for the shared rationale (the `AltContainer`->
// `useAltStore` Container split, the `forwardRef`+`useImperativeHandle`
// `getValue`-only imperative API replacing the two-hop `this.refs
// .nameInput` reach-through, the `stateRef` direct-mutation replication
// of `validateAccountName`'s stale-`value`/fresh-`error` quirk, the
// `useEffect`-dependency-array replication of `shouldComponentUpdate`
// gating `componentDidUpdate`, the dropped `state.existing_account`, and
// the preserved-verbatim bare-global-`event` bug in `onKeyDown`). This
// file's real ref-based caller is `Account/CreateAccount.tsx` (also
// updated in this same commit, the same way as `CreateAccountPassword
// .tsx` was for the sibling file).
//
// Not security-sensitive per AGENTS.md.
//
// Two differences from the sibling file:
// - `componentDidUpdate` here also calls `ReactTooltip.rebuild()` before
//   the `onChange({valid: ...})` call - kept, in the same gated
//   `useEffect`.
// - `render()` had **two** `return` statements - the second (a plain
//   `<div>`/`<input>` layout, structurally identical to the sibling
//   file's actual render) is unreachable dead code: JS returns from the
//   first `return` unconditionally, so nothing after it in the function
//   body ever executes. Dropped entirely (not merely commented out,
//   since it was never reachable to begin with) - only the first
//   `return`'s `Form.Item`/`Input` (from `bitshares-ui-style-guide`) is
//   ported.
import * as React from "react";
import AccountActions from "actions/AccountActions";
import AccountStore from "stores/AccountStore";
import {ChainValidation} from "bitsharesjs";
import counterpart from "counterpart";
import ReactTooltip from "react-tooltip";
import {Form, Input} from "bitshares-ui-style-guide";
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
    label?: any;
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
        label,
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
        (ReactTooltip as any).rebuild();
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
    const warning = state.warning;

    const getHelp = () => {
        return error ? error : warning ? warning : "";
    };

    const getValidateStatus = (): any => {
        return error ? "error" : warning ? "warning" : "";
    };

    return (
        <Form.Item
            label={label}
            help={getHelp()}
            validateStatus={getValidateStatus()}
        >
            <Input
                name="username"
                id="username"
                type="text"
                autoComplete="username"
                placeholder={placeholder}
                onChange={handleChange}
                onKeyDown={onKeyDown}
                value={state.account_name || initial_value}
            />
        </Form.Item>
    );
});

interface AccountNameInputProps {
    id?: string;
    label?: any;
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
