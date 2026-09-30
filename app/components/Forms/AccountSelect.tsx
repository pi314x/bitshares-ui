// TypeScript/functional-component port of the legacy AccountSelect.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: a plain `<select>` of account
// names.
//
// `shouldComponentUpdate` (a pure props-comparison guard) dropped - no
// hooks equivalent, never changes final rendered output.
// `componentDidMount`'s body is entirely commented out in the original -
// kept as an inert comment, matching this migration's established
// treatment of such blocks (e.g. `Account/CreateAccount.tsx`'s
// `RefcodeInput` block).
//
// `selected` is read (`this.props.selected`, both in `render()` and the
// dropped `shouldComponentUpdate`) but was never declared in the
// original's `propTypes` - grep-verified at least one real caller
// (`Modal/ProposalModal.tsx`) does pass it, so it's added to this file's
// props type as a real, optional prop rather than dropped.
//
// Dropped as confirmed dead (grepped across every file that imports this
// component, not just this file): the imperative `value()`/`reset()`
// instance methods and the legacy string ref `ref="account-selector"` -
// no caller anywhere in the app passes a `ref` to `<AccountSelect>` or
// otherwise reaches these methods, so no `forwardRef`+
// `useImperativeHandle` is needed here (unlike `Modal/DepositModal.tsx`/
// `Modal/SendModal.tsx`, which do have real ref-based callers).
// `state.selected` (only ever read by the now-dropped `value()`, updated
// by `_selectAccount`) goes with them - `render()` itself only ever read
// `this.props.selected`, never `this.state.selected`, so nothing
// observable in the rendered output depended on that local state.
import * as React from "react";
import counterpart from "counterpart";

interface AccountSelectProps {
    account_names: any[];
    list_size?: number;
    onChange?: (value: any) => void;
    placeholder?: string;
    center?: boolean;
    tabIndex?: number;
    className?: string;
    selected?: any;
    // Accepted but unused, matching the original: at least one real
    // caller (`Registration/AccountRegistrationForm.tsx`) passes an
    // `id` prop this component has never read.
    id?: string;
}

export default function AccountSelect({
    account_names,
    list_size,
    onChange,
    placeholder: placeholderProp,
    center,
    tabIndex,
    className,
    selected: selected_account
}: AccountSelectProps) {
    const default_placeholder = counterpart.translate(
        "account.select_placeholder"
    );

    // componentDidMount: entirely commented out in the original -
    // setTimeout(() => {
    //     var account_names = this.props.account_names;
    //     if (account_names.length === 1 && !!account_names[0] && account_names[0] !== "" && account_names[0] !== this.state.selected) {
    //         this._selectAccount(account_names[0]);
    //     }
    // }, 100);

    const selectAccount = (value: any) => {
        const currentPlaceholder = placeholderProp || default_placeholder;
        if (value === currentPlaceholder) {
            value = null;
        }
        if (onChange) {
            onChange(value);
        }
    };

    const onAccountChange = (e: any) => {
        e.preventDefault();
        const value = e.target.value;
        selectAccount(value);
    };

    let placeholder: any = placeholderProp || default_placeholder;
    if (list_size && list_size > 1) {
        placeholder = (
            <option value="" disabled>
                {placeholder}
            </option>
        );
    } else {
        //When disabled and list_size was 1, chrome was skipping the
        //placeholder and selecting the 1st item automatically (not shown)
        placeholder = <option value="">{placeholder}</option>;
    }
    let key = 0;
    return (
        <select
            key={selected_account}
            defaultValue={selected_account}
            className={"form-control account-select bts-select " + (className || "")}
            onChange={onAccountChange}
            style={center ? {margin: "0 auto"} : undefined}
            tabIndex={tabIndex}
        >
            {placeholder}
            {account_names.sort().map(account_name => {
                if (!account_name || account_name === "") {
                    return null;
                }
                return (
                    <option key={key++} value={account_name}>
                        {account_name}
                    </option>
                );
            })}
        </select>
    );
}
