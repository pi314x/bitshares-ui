// TypeScript/functional-component port of the legacy PasswordConfirm.jsx
// (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
// Security-sensitive per AGENTS.md: the typed password lives only in
// this component's own local state, forwarded to the caller via
// `onValid` exactly as before - never logged.
//
// `formChange`'s `this.setState(state, this.validate)` used a setState
// callback specifically so `validate` would read the just-committed,
// fresh state rather than a stale value - replicated with a
// `[password, confirm]`-keyed effect (mount-skipped, since the original
// never calls `validate()` on mount either - only `componentDidMount`'s
// unrelated input auto-focus runs then).
import * as React from "react";
import Immutable from "immutable";
import cname from "classnames";
import counterpart from "counterpart";
import {Form} from "bitshares-ui-style-guide";

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

    const firstPasswordRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (firstPasswordRef.current) {
            firstPasswordRef.current.focus();
        }
    }, []);

    const formChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
                    <input
                        type="password"
                        id="current-password"
                        autoComplete="current-password"
                        ref={firstPasswordRef}
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
                <section>
                    <input
                        type="password"
                        id="new-password"
                        autoComplete="new-password"
                        onChange={formChange}
                        value={confirm}
                        tabIndex={tabIndex++}
                    />
                </section>
            </FormItem>

            <div style={{paddingBottom: 10}}>
                {(errors as any).get("password_match") ||
                    (errors as any).get("password_length")}
            </div>

            {children}
            <br />
        </div>
    );
}
