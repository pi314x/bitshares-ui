// TypeScript/functional-component port of the legacy
// PasswordInputStyleGuide.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes - with one deliberate exception below.
//
// Security-sensitive per AGENTS.md: handles the raw password value the
// user types.
//
// `zxcvbn-async` ships no type declarations - added to `app/types
// /vendor-shims.d.ts` (the established pattern for such packages).
//
// **Deliberate deviation from "preserve every bug verbatim"**: the
// original had two `console.log` calls that print the *raw plaintext
// password* directly - `console.log(score, strength.score,
// passwordScore, password)` in `calculatePasswordScore`, and
// `console.log(password, confirmPassword, password !== confirmPassword)`
// in `getConfirmPasswordErrorMessage`. AGENTS.md is explicit and
// unconditional: "never log or persist private keys, passwords, or
// brainkeys." That instruction governs what this port itself writes, not
// just what behavior it preserves, so - unlike every other quirk/bug
// found and kept verbatim throughout this migration - these two calls
// are dropped rather than transcribed. A third `console.log(validation)`
// in `handleValidationChange` (logging only `{errorMessage, valid}`, a
// translated message string and a boolean, never the password itself) is
// not a credential leak and is kept verbatim, consistent with this
// migration's normal treatment of harmless debug logging.
//
// No imperative `value()`/`clear()`/`focus()`/`valid()` API exists on
// this class at all (unlike its sibling `Forms/PasswordInput.jsx`) - the
// one real caller (`Registration/WalletRegistrationForm.tsx`) never
// passes a `ref` either. Dropped as confirmed dead (grepped): `ref
// ="password"`/`ref="confirmPassword"` on the two `<Input>`s - `this
// .refs.password`/`.confirmPassword` are never read anywhere in this
// file.
//
// `handlePasswordChange`/`handleConfirmPasswordChange` used
// `setState(update, callback)`, guaranteeing the callback (which
// recomputes validation) always saw the just-typed value. Hooks'
// `setState` is async, so `getPasswordErrorMessage`/
// `getConfirmPasswordErrorMessage`/`handleValidationChange` are given
// optional override parameters: `render()`'s direct calls (no overrides)
// read the current committed `state.password`/`.confirmPassword`
// exactly as before, while the two change handlers pass the just-typed
// value explicitly for the field that changed (and the current,
// unrelated-to-this-change state value for the other field, which is
// what the original's synchronous callback would also have read) -
// reproducing "always validates against the fresh value" without relying
// on a stale closure.
//
// `onValidationChange`/`label` (read via `this.props.onValidationChange`/
// `this.props.label`) are real, undeclared-in-`propTypes` props -
// grep-verified the one real caller passes both - added to this file's
// TS props type as real, optional props, matching this migration's
// established treatment of such cases (e.g. `Forms/AccountSelect.tsx`'s
// `selected`).
import * as React from "react";
import zxcvbnAsync from "zxcvbn-async";
import counterpart from "counterpart";
import {Progress, Form, Input} from "bitshares-ui-style-guide";

interface PasswordInputState {
    password: string;
    confirmPassword: string;
    isPasswordInputActive: boolean;
    isConfirmPasswordInputActive: boolean;
    score?: any;
}

interface PasswordInputProps {
    onChange?: (password: string) => void;
    onEnter?: (e: any) => void;
    onValidationChange?: (validation: {errorMessage: any; valid: boolean}) => void;
    label?: any;
    wrongPassword?: boolean;
    noValidation?: boolean;
    noLabel?: boolean;
    passwordLength?: number;
    checkStrength?: boolean;
    value?: string;
    copy?: boolean;
    visible?: boolean;
    readonly?: boolean;
}

export default function PasswordInput({
    onChange,
    onEnter,
    onValidationChange,
    label,
    passwordLength = 8,
    visible = false,
    readonly = false
}: PasswordInputProps) {
    const [state, setState] = React.useState<PasswordInputState>({
        password: "",
        confirmPassword: "",
        isPasswordInputActive: false,
        isConfirmPasswordInputActive: false
    });

    const mergeState = (patch: Partial<PasswordInputState>) =>
        setState(prev => ({...prev, ...patch}));

    const getPasswordErrorMessage = (passwordOverride?: string) => {
        const password =
            passwordOverride !== undefined ? passwordOverride : state.password;

        if (password.length < passwordLength) {
            return counterpart.translate("wallet.pass_length", {
                minLength: passwordLength
            });
        }

        return "";
    };

    const getConfirmPasswordErrorMessage = (
        passwordOverride?: string,
        confirmOverride?: string
    ) => {
        const password =
            passwordOverride !== undefined ? passwordOverride : state.password;
        const confirmPassword =
            confirmOverride !== undefined
                ? confirmOverride
                : state.confirmPassword;

        if (password !== confirmPassword) {
            return counterpart.translate("wallet.confirm_error");
        }

        return "";
    };

    const handleValidationChange = (
        passwordOverride?: string,
        confirmOverride?: string
    ) => {
        const validation = {
            errorMessage:
                getPasswordErrorMessage(passwordOverride) ||
                getConfirmPasswordErrorMessage(
                    passwordOverride,
                    confirmOverride
                ) ||
                " ",
            valid:
                !getPasswordErrorMessage(passwordOverride) &&
                !getConfirmPasswordErrorMessage(
                    passwordOverride,
                    confirmOverride
                )
        };

        console.log(validation);

        if (onValidationChange) onValidationChange(validation);
    };

    const calculatePasswordScore = (password: string) => {
        const zxcvbn = (zxcvbnAsync as any).load({sync: true});

        const strength = zxcvbn(password || "");

        // passwordLength is min required length
        // to reach max score password length should be higher by 50% from min length
        const passwordScore = Math.floor(
            password.length / (passwordLength * 1.5)
        );

        const score = Math.min(5, strength.score + passwordScore);

        mergeState({score});
    };

    const handlePasswordChange = (e: any) => {
        const password = e.target.value;
        mergeState({password});
        if (onChange) onChange(password);
        calculatePasswordScore(password || "");
        handleValidationChange(password, state.confirmPassword);
    };

    const handleConfirmPasswordChange = (e: any) => {
        const confirmPassword = e.target.value;
        mergeState({confirmPassword});
        handleValidationChange(state.password, confirmPassword);
    };

    const handlePasswordBlur = () => {
        mergeState({isPasswordInputActive: false});
    };

    const handlePasswordFocus = () => {
        mergeState({isPasswordInputActive: true});
    };

    const handleConfirmPasswordBlur = () => {
        mergeState({isConfirmPasswordInputActive: false});
    };

    const handleConfirmPasswordFocus = () => {
        mergeState({isConfirmPasswordInputActive: true});
    };

    const onKeyDown = (e: any) => {
        if (onEnter && e.keyCode === 13) onEnter(e);
    };

    const {score} = state;

    const passwordErrorMessage = getPasswordErrorMessage();

    const confirmPasswordErrorMessage = getConfirmPasswordErrorMessage();

    const getPasswordHelp = () => {
        if (state.isPasswordInputActive || !state.password) return "";

        return passwordErrorMessage || "";
    };

    const getPasswordValidateStatus = (): any => {
        if (state.isPasswordInputActive || !state.password) return "";

        return passwordErrorMessage && passwordErrorMessage.length
            ? "error"
            : "";
    };

    const getConfirmPasswordHelp = () => {
        if (!state.confirmPassword || !state.password) return "";

        return confirmPasswordErrorMessage || "";
    };

    const getConfirmPasswordValidateStatus = (): any => {
        if (
            state.isConfirmPasswordInputActive ||
            !state.confirmPassword ||
            !state.password
        )
            return "";

        return confirmPasswordErrorMessage && confirmPasswordErrorMessage.length
            ? "error"
            : "";
    };

    return (
        <>
            <Form.Item
                label={label || counterpart.translate("wallet.enter_password")}
                key="password-field"
                help={getPasswordHelp()}
                validateStatus={getPasswordValidateStatus()}
            >
                <Input
                    id="current-password"
                    onBlur={handlePasswordBlur}
                    onFocus={handlePasswordFocus}
                    type={visible ? "text" : "password"}
                    name="password"
                    placeholder={counterpart.translate("wallet.enter_password")}
                    onChange={handlePasswordChange}
                    onKeyDown={onKeyDown}
                    value={state.password}
                    readOnly={readonly}
                />
                <Progress percent={(score || 0) * 20} showInfo={false} />
            </Form.Item>
            <Form.Item
                label={counterpart.translate("wallet.confirm")}
                key="confirm-password-field"
                help={getConfirmPasswordHelp()}
                validateStatus={getConfirmPasswordValidateStatus()}
            >
                <Input
                    id="confirm-password"
                    onBlur={handleConfirmPasswordBlur}
                    onFocus={handleConfirmPasswordFocus}
                    type={visible ? "text" : "password"}
                    name="confirmPassword"
                    placeholder={counterpart.translate("wallet.enter_password")}
                    onChange={handleConfirmPasswordChange}
                    onKeyDown={onKeyDown}
                    value={state.confirmPassword}
                    readOnly={readonly}
                />
            </Form.Item>
        </>
    );
}
