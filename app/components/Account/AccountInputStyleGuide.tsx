// TypeScript/functional-component port of the legacy
// AccountInputStyleGuide.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// The legacy string ref (`ref="input"`, `this.refs.input`) is replaced by
// `useRef`. `componentDidUpdate` (calls `.focus()` unconditionally on
// every update when `focus` is true - never on mount) is replicated with
// a dependency-free `useEffect`, skipped on its first (mount) run via a
// ref guard.
//
// Preserved verbatim (a real, significant pre-existing bug, not
// "fixed"): `simpleComponent()` calls `input()` but never `return`s it,
// so when no `label` prop is given, `render()`'s `{label ?
// labelComponent() : simpleComponent()}` renders *nothing* - the actual
// `<Input>` is never mounted in that code path, leaving this component's
// unlabeled variant permanently blank. As a direct consequence, the
// input ref is never actually attached in that case either, so
// `componentDidUpdate`'s (here, the effect's) unconditional
// `.focus()` call would throw if `focus` is ever `true` with no `label`
// given - replicated by calling `.focus()` without a null-check, exactly
// like the original's unguarded `this.refs.input.focus()`.
import * as React from "react";
import {Input, Form} from "bitshares-ui-style-guide";
import counterpart from "counterpart";
import ChainStore from "bitsharesjs/es/chain/src/ChainStore";
import accountUtils from "../../lib/common/account_utils";

interface AccountInputStyleGuideProps {
    focus?: boolean;
    value?: string;
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
}

function AccountInputStyleGuide({
    focus,
    value,
    onChange,
    label,
    placeholder
}: AccountInputStyleGuideProps) {
    const [isInputActive, setIsInputActive] = React.useState(false);
    const inputRef = React.useRef<any>(null);

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            return;
        }
        if (focus) {
            (inputRef.current as any).focus();
        }
    });

    const handleBlur = () => {
        setIsInputActive(false);
    };

    const handleFocus = () => {
        setIsInputActive(true);
    };

    const handleInputChange = (e: any) => {
        onChange(e.target.value);
    };

    const isAccountScammer = () => {
        const account = (ChainStore as any).getAccount(value);

        if (account && account.get) {
            return accountUtils.isKnownScammer(account.get("name"));
        }

        return false;
    };

    const getAccountStatus = () => {
        const account = (ChainStore as any).getAccount(value);

        if (account && account.get) {
            // is scammer
            const isKnownScammer = isAccountScammer();

            if (isKnownScammer) {
                return counterpart.translate("account.member.suspected_scammer");
            }

            // get status (basic or lifetime member)
            const accountStatus = (ChainStore as any).getAccountMemberStatus(
                account
            );

            return (
                counterpart.translate("account.member." + accountStatus) +
                " #" +
                account.get("id").substring(4)
            );
        }

        return null;
    };

    const isAccountFound = () => {
        const account = (ChainStore as any).getAccount(value);

        return !!account;
    };

    const getValidateStatus = () => {
        if (isInputActive || !value) return "";

        if (isAccountFound()) return "success";

        return "error";
    };

    const getHelp = () => {
        if (isInputActive || !value) return "";

        if (!isAccountFound()) return counterpart.translate("account.errors.unknown");

        return "";
    };

    const getPlaceholder = () => {
        if (placeholder) return counterpart.translate(placeholder);

        return "";
    };

    const input = () => {
        return (
            <Input
                ref={inputRef}
                placeholder={getPlaceholder()}
                value={value}
                onChange={handleInputChange}
                onBlur={handleBlur}
                onFocus={handleFocus}
            />
        );
    };

    const labelComponent = () => {
        const accountStatus = getAccountStatus();

        const getStatus = () => {
            if (isAccountScammer())
                return "account-input-style-guide--account-status--scammer";
        };

        const getLabel = () => {
            return (
                <span className="account-input-style-guide--label">
                    {counterpart.translate(label)}
                    <span
                        className={`account-input-style-guide--account-status ${getStatus()}`}
                    >
                        {accountStatus}
                    </span>
                </span>
            );
        };

        return (
            <Form.Item
                style={{textAlign: "left"}}
                label={getLabel()}
                help={getHelp()}
                validateStatus={getValidateStatus() as any}
            >
                {input()}
            </Form.Item>
        );
    };

    const simpleComponent = () => {
        input();
    };

    return (
        <div className="account-input-style-guide">
            {label ? labelComponent() : simpleComponent()}
        </div>
    );
}

export default AccountInputStyleGuide;
