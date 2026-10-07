// TypeScript/functional-component port of the legacy PasswordInput.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: handles the raw password value the
// user types. Never logged (grepped, no `console.*` calls anywhere in
// this file) or persisted beyond component state/the DOM input itself -
// transcribed verbatim.
//
// `zxcvbn-async` ships no type declarations - added to `app/types
// /vendor-shims.d.ts` (the established pattern for such packages).
// The strength `<progress>` element's `min="0"` isn't a real HTML
// `<progress>` attribute at all (only `value`/`max` are), so TypeScript's
// DOM typings reject it outright - cast past with `as any` rather than
// dropping it, preserving the original's (already inert on real
// browsers) markup exactly. `max="5"` (a string) is written as `max={5}`
// (a number) instead, which is what TypeScript's typing requires and
// produces an identical DOM attribute either way.
//
// The imperative `value()`/`clear()`/`focus()`/`valid()` API is real:
// `value()` is called externally via a ref from `Account/CreateAccount
// .tsx` (`passwordRef.current.value()`, a plain, non-nested ref, so no
// caller-side change is needed once this file exposes it via
// `forwardRef`+`useImperativeHandle` instead of a class instance).
// `clear()`/`focus()`/`valid()` are dropped as confirmed dead: grepped
// both real callers of this component (`Account/CreateAccount.tsx`,
// `Account/AccountPermissionsMigrate.tsx`, the latter passing no ref at
// all) and this file itself - none of the three is ever called anywhere.
//
// `value()`/`clear()` read/write `this.refs.password`/`.confirm_password`
// *directly* (the live DOM node's `.value`), bypassing the React-managed
// `state.value` the `<input value={...}>` is actually bound to -
// preserved verbatim via `useRef<HTMLInputElement>()`s read/written the
// same way, rather than "fixing" this to read from state instead
// (`clear()`'s direct DOM mutation of a controlled input's value is
// itself a real pre-existing quirk: since nothing else forces a
// re-render immediately afterward, the DOM briefly shows the cleared
// value until React's next render reasserts `state.value` - not
// "fixed" here).
//
// `handleChange` computes password-strength `score` from `this.state
// .value` (the *stale*, pre-this-keystroke value, since state hasn't
// committed yet within this synchronous handler) rather than the freshly
// read `password` DOM value - a genuine one-keystroke-behind strength
// display, preserved verbatim by using the closure-captured `state
// .value` for that calculation, exactly as the original's `this.state
// .value` read did.
//
// `labelClass` (read via `this.props.labelClass`) is a real, undeclared-
// in-`propTypes` prop, added to this file's TS props type as a real,
// optional prop, matching this migration's established treatment of
// such cases (e.g. `Forms/AccountSelect.tsx`'s `selected`). The
// commented-out `{noLabel ? null : <Translate .../>}` blocks (and their
// accompanying `// let {noLabel} = this.props;`) are kept as inert
// comments, matching this migration's established treatment of such
// blocks - `noLabel` itself is accepted as a prop but has zero effect on
// anything actually rendered.
import * as React from "react";
import Translate from "react-translate-component";
import zxcvbnAsync from "zxcvbn-async";
import CopyButton from "../Utility/CopyButton";
import cname from "classnames";

interface PasswordInputState {
    value: string;
    error: any;
    wrong: boolean;
    doesnt_match: boolean;
    score?: any;
}

interface PasswordInputHandle {
    value: () => string;
}

interface PasswordInputProps {
    onChange?: (state: any) => void;
    onEnter?: (e: any) => void;
    confirmation?: boolean;
    wrongPassword?: boolean;
    noValidation?: boolean;
    noLabel?: boolean;
    passwordLength?: number;
    checkStrength?: boolean;
    value?: string;
    copy?: boolean;
    visible?: boolean;
    readonly?: boolean;
    labelClass?: string;
}

const PasswordInput = React.forwardRef<PasswordInputHandle, PasswordInputProps>(
    function PasswordInput(
        {
            onChange,
            onEnter,
            confirmation = false,
            wrongPassword = false,
            noValidation = false,
            passwordLength = 8,
            checkStrength = false,
            value: initialValue = "",
            copy = false,
            visible = false,
            readonly = false,
            labelClass
        },
        ref
    ) {
        const [state, setState] = React.useState<PasswordInputState>({
            value: initialValue || "",
            error: null,
            wrong: false,
            doesnt_match: false
        });

        const passwordInputRef = React.useRef<HTMLInputElement | null>(null);
        const confirmPasswordInputRef = React.useRef<HTMLInputElement | null>(
            null
        );

        React.useImperativeHandle(ref, () => ({
            value: () => {
                const node = passwordInputRef.current;
                return node ? node.value : "";
            }
        }));

        const handleChange = (e: any) => {
            e.preventDefault();
            e.stopPropagation();
            const confirmationValue = confirmation
                ? (confirmPasswordInputRef.current as any).value
                : true;
            const password = (passwordInputRef.current as any).value;
            const doesnt_match = confirmation
                ? confirmationValue && password !== confirmationValue
                : false;

            let strength: any = 0,
                score;
            if (checkStrength) {
                if (state.value.length > 100) {
                    strength = {score: 4};
                } else {
                    const zxcvbn = (zxcvbnAsync as any).load({sync: true});
                    strength = zxcvbn(state.value || "");
                }
                /* Require a length of passwordLength + 50% for the max score */
                score = Math.min(
                    5,
                    strength.score +
                        Math.floor(state.value.length / (passwordLength * 1.5))
                );
            }

            const newState = {
                valid:
                    !state.error &&
                    !state.wrong &&
                    !(confirmation && doesnt_match) &&
                    confirmationValue &&
                    password.length >= passwordLength,
                value: password,
                score,
                doesnt_match
            };
            if (onChange) onChange(newState);
            setState(prev => ({...prev, ...newState}));
        };

        const onKeyDown = (e: any) => {
            if (onEnter && e.keyCode === 13) onEnter(e);
        };

        const {score, value} = state;
        let password_error = null,
            confirmation_error = null;
        if (state.wrong || wrongPassword)
            password_error = (
                <div>
                    <Translate content="wallet.pass_incorrect" />
                </div>
            );
        else if (state.error) password_error = <div>{state.error}</div>;
        if (
            !noValidation &&
            !password_error &&
            state.value.length > 0 &&
            state.value.length < passwordLength
        )
            password_error = (
                <div>
                    <Translate
                        content="wallet.pass_length"
                        minLength={passwordLength}
                    />
                </div>
            );
        if (state.doesnt_match)
            confirmation_error = (
                <div>
                    <Translate content="wallet.confirm_error" />
                </div>
            );
        const password_class_name = cname("form-group", {
            "has-error": password_error
        });
        const password_confirmation_class_name = cname("form-group", {
            "has-error": state.doesnt_match
        });
        // let {noLabel} = this.props;

        let confirmMatch = false;
        if (
            confirmPasswordInputRef.current &&
            confirmPasswordInputRef.current.value &&
            !state.doesnt_match
        ) {
            confirmMatch = true;
        }

        return (
            <div className="account-selector">
                <div className={password_class_name}>
                    {/* {noLabel ? null : <Translate component="label" content="wallet.password" />} */}
                    <section>
                        <label className={"left-label " + (labelClass || "")}>
                            <Translate content="wallet.enter_password" />
                        </label>
                        <div className="generated-password-section">
                            <input
                                style={{
                                    marginBottom: checkStrength
                                        ? 0
                                        : undefined,
                                    display: copy ? "inline" : "block"
                                }}
                                id="current-password"
                                name="password"
                                type={visible ? "text" : "password"}
                                ref={passwordInputRef}
                                autoComplete="current-password"
                                onChange={handleChange}
                                onKeyDown={onKeyDown}
                                value={value}
                                readOnly={readonly}
                            />
                            {copy && (
                                <CopyButton
                                    text={value}
                                    tip="tooltip.copy_password"
                                    dataPlace="top"
                                    className="button password-copy-button"
                                />
                            )}
                        </div>
                        {checkStrength ? (
                            <progress
                                style={{height: 10}}
                                className={
                                    score === 5
                                        ? "high"
                                        : score === 4
                                            ? "medium"
                                            : "low"
                                }
                                value={score}
                                max={5}
                                {...({min: "0"} as any)}
                            />
                        ) : null}
                    </section>

                    {password_error}
                </div>
                {confirmation ? (
                    <div className={password_confirmation_class_name}>
                        {/* {noLabel ? null : <Translate component="label" content="wallet.confirm" />} */}
                        <label className="left-label">
                            <Translate content="wallet.confirm_password" />
                        </label>
                        <section
                            style={{position: "relative", maxWidth: "30rem"}}
                        >
                            <input
                                id="confirm_password"
                                name="confirm_password"
                                type="password"
                                ref={confirmPasswordInputRef}
                                autoComplete="confirm-password"
                                onChange={handleChange}
                            />
                            {confirmMatch ? (
                                <div className={"ok-indicator success"}>OK</div>
                            ) : null}
                        </section>
                        {confirmation_error}
                    </div>
                ) : null}
            </div>
        );
    }
);

export default PasswordInput;
