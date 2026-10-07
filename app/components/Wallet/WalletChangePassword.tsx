// TypeScript/functional-component port of the legacy
// WalletChangePassword.jsx (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical,
// no logic changes. Security-sensitive per AGENTS.md: calls the real
// `WalletDb.changePassword`/`WalletDb.validatePassword` exactly as before;
// passwords live only in local component state, never logged.
//
// `WalletPassword`'s legacy string ref (`ref="pwd"` + `this.refs.pwd
// .cancel()`) becomes `React.forwardRef` + `useImperativeHandle` exposing
// the same `cancel()` method.
//
// Dropped as confirmed dead, not ported: the unexported `class Reset`
// (defined in the original file but never rendered there, and never
// imported by any other file - grepped for both) and the `onSubmit` prop
// `WalletChangePassword` passed down to `PasswordConfirm` (that component
// never reads an `onSubmit` prop - grepped its original source - so it was
// already a no-op in the original).
import * as React from "react";
import {Link, LinkProps} from "react-router-dom";
import Translate from "react-translate-component";
import WalletDb from "stores/WalletDb";
import PasswordConfirm from "./PasswordConfirm";
import counterpart from "counterpart";
import {Button, Form, Input, Notification} from "bitshares-ui-style-guide";

const FormItem = Form.Item;

// See Explorer/Blocks.tsx's comment on `TypedLink` for why this cast is
// needed - `Link`'s inferred return type isn't a valid JSX element type
// under this project's React/TS version combination.
const TypedLink = Link as React.ComponentType<LinkProps>;

interface WalletPasswordHandle {
    cancel: () => void;
}

const WalletPassword = React.forwardRef<
    WalletPasswordHandle,
    {onValid: (password: string) => void; children?: any}
>(({onValid, children}, ref) => {
    const [password, setPassword] = React.useState("");
    const [verified, setVerified] = React.useState(false);

    React.useImperativeHandle(ref, () => ({
        cancel: () => {
            setVerified(false);
            setPassword("");
        }
    }));

    const onPassword = (e: any) => {
        e.preventDefault();
        const {success} = (WalletDb as any).validatePassword(password, true);
        if (success) {
            setVerified(true);
            onValid(password);
        } else {
            Notification.error({
                message: counterpart.translate("notifications.invalid_password")
            });
        }
    };

    const formChange = (event: any) => {
        setPassword(event.target.value);
    };

    if (verified) {
        return <div className="grid-content">{children}</div>;
    }
    return (
        <Form onSubmit={onPassword}>
            <FormItem label={counterpart.translate("wallet.existing_password")}>
                <section>
                    <Input
                        placeholder={counterpart.translate(
                            "wallet.current_pass"
                        )}
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        onChange={formChange}
                        value={password}
                    />
                </section>
                <Button
                    type="primary"
                    onClick={onPassword}
                    style={{marginTop: 10}}
                >
                    <Translate content="wallet.submit" />
                </Button>
            </FormItem>
        </Form>
    );
});
WalletPassword.displayName = "WalletPassword";

export default function WalletChangePassword() {
    const [oldPassword, setOldPassword] = React.useState<string | null>(null);
    const [newPassword, setNewPassword] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState(false);

    const pwdRef = React.useRef<WalletPasswordHandle>(null);

    const onAccept = (e: any) => {
        e.preventDefault();
        (WalletDb as any)
            .changePassword(oldPassword, newPassword, true /*unlock*/)
            .then(() => {
                Notification.success({
                    message: counterpart.translate(
                        "notifications.password_change_success"
                    )
                });
                setSuccess(true);
                // window.history.back();
            })
            .catch((error: any) => {
                // Programmer or database error ( validation missed something? )
                // .. translation may be unnecessary
                console.error(error);
                Notification.error({
                    message: counterpart.translate(
                        "notifications.password_change_failure",
                        {
                            error_msg: error
                        }
                    )
                });
            });
    };

    const onOldPassword = (old_password: string) => {
        setOldPassword(old_password);
    };
    const onNewPassword = (new_password: string | null) => {
        setNewPassword(new_password);
    };

    const _onCancel = () => {
        setOldPassword("");
        if (pwdRef.current) pwdRef.current.cancel();
    };

    const ready = !!newPassword;

    if (success) {
        return (
            <div>
                <Translate component="p" content="wallet.change_success" />
                <Translate component="p" content="wallet.change_backup" />
                <TypedLink to="/wallet/backup/create">
                    <Button>
                        <Translate content="wallet.create_backup" />
                    </Button>
                </TypedLink>
            </div>
        );
    }

    return (
        <span>
            <WalletPassword ref={pwdRef} onValid={onOldPassword}>
                <PasswordConfirm newPassword={true} onValid={onNewPassword}>
                    <Button
                        type="primary"
                        disabled={!ready}
                        htmlType="submit"
                        style={{marginRight: "16px"}}
                        onClick={onAccept}
                    >
                        <Translate content="wallet.accept" />
                    </Button>
                    <Button onClick={_onCancel}>
                        <Translate content="wallet.cancel" />
                    </Button>
                </PasswordConfirm>
            </WalletPassword>
        </span>
    );
}
