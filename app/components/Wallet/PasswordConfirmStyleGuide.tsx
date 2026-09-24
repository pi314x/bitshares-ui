// TypeScript/functional-component port of the legacy
// PasswordConfirmStyleGuide.jsx (Phase 5, docs/UI_MIGRATION_PLAN.md) - the
// antd-styled variant of `PasswordConfirm.tsx`. Mechanical, no logic
// changes. Security-sensitive per AGENTS.md: the typed password lives
// only in this component's own local state, forwarded to the caller via
// `onValid` exactly as before - never logged.
//
// Preserved verbatim (not "fixed"): the original's
// `ref={this.getInputNode()}` *calls* the ref-callback immediately (with
// no argument) instead of passing the function reference, so the JSX
// actually receives `ref={undefined}` - `firstPassword` is never bound to
// the real DOM node, and `componentDidMount`'s auto-focus silently never
// fires. Replicated here by calling `getInputNode()` (with no argument)
// directly in the JSX `ref` prop, so the effect below's `.focus()` call
// is always a no-op, exactly as in the original.
import * as React from "react";
import Immutable from "immutable";
import cname from "classnames";
import counterpart from "counterpart";
import {Form, Input} from "bitshares-ui-style-guide";

const FormItem = Form.Item;

interface PasswordConfirmProps {
    onValid: (password: string | null) => void;
    newPassword?: boolean;
    children?: any;
}

export default function PasswordConfirm({
    onValid,
    newPassword,
    children
}: PasswordConfirmProps) {
    const [password, setPassword] = React.useState("");
    const [confirm, setConfirm] = React.useState("");
    const [errors, setErrors] = React.useState<any>(Immutable.Map());

    const firstPasswordRef = React.useRef<any>(null);

    const getInputNode = (node?: any) => {
        firstPasswordRef.current = node;
    };

    React.useEffect(() => {
        if (firstPasswordRef.current) {
            firstPasswordRef.current.focus();
        }
    }, []);

    const formChange = (event: any) => {
        const key =
            event.target.id === "current-password" ? "password" : "confirm";
        if (key === "password") setPassword(event.target.value);
        else setConfirm(event.target.value);
    };

    const isFirstValidateRender = React.useRef(true);
    React.useEffect(() => {
        if (isFirstValidateRender.current) {
            isFirstValidateRender.current = false;
            return;
        }

        const trimmedConfirm = confirm.trim();
        const trimmedPassword = password.trim();

        let newErrors = Immutable.Map();
        // Don't report until typing begins
        if (trimmedPassword.length !== 0 && trimmedPassword.length < 8)
            newErrors = newErrors.set(
                "password_length",
                "Password must be 8 characters or more"
            );

        // Don't report it until the confirm is populated
        if (
            trimmedPassword !== "" &&
            trimmedConfirm !== "" &&
            trimmedPassword !== trimmedConfirm
        )
            newErrors = newErrors.set(
                "password_match",
                "Passwords do not match"
            );

        const valid =
            trimmedPassword.length >= 8 && trimmedPassword === trimmedConfirm;
        setErrors(newErrors);
        onValid(valid ? trimmedPassword : null);
        // eslint-disable-next-line
    }, [password, confirm]);

    let tabIndex = 1;

    return (
        <div className={cname({"has-error": (errors as any).size})}>
            <FormItem
                label={counterpart.translate(
                    newPassword ? "wallet.new_password" : "wallet.password"
                )}
            >
                <section>
                    <Input
                        type="password"
                        id="current-password"
                        autoComplete="current-password"
                        ref={getInputNode()}
                        onChange={formChange}
                        value={password}
                        tabIndex={tabIndex++}
                    />
                </section>
            </FormItem>

            <FormItem
                label={counterpart.translate(
                    newPassword ? "wallet.new_confirm" : "wallet.confirm"
                )}
            >
                <section className={cname({"has-error": (errors as any).size})}>
                    <Input
                        type="password"
                        id="new-password"
                        autoComplete="new-password"
                        onChange={formChange}
                        value={confirm}
                        tabIndex={tabIndex++}
                    />

                    <div>
                        {(errors as any).get("password_match") ||
                            (errors as any).get("password_length")}
                    </div>
                </section>
            </FormItem>

            {children}
            <br />
        </div>
    );
}
