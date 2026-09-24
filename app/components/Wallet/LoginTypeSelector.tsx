// TypeScript/functional-component port of the legacy
// LoginTypeSelector.jsx (Phase 5, docs/UI_MIGRATION_PLAN.md). Mechanical,
// no logic changes.
//
// Preserved verbatim (not "fixed"): `onChange`'s validity check reads
// `if (!newType in validValues)` - an operator-precedence bug (`!` binds
// tighter than `in`), so this actually evaluates
// `(!newType) in validValues`, checking whether the *string* `"false"`
// or `"true"` is a property key of the `["cloud", "local"]` array -
// always `false`, so the `throw new Error(...)` guard never fires
// regardless of `newType`'s real value. Not corrected to the presumably-
// intended `!validValues.includes(newType)`. The `as any` cast on
// `!newType` is only there so `tsc` accepts the `in` operator's left
// operand (a real TS error the original untyped `.js` never had to
// satisfy) - it doesn't change the (already-inert) runtime behavior.
import * as React from "react";
import counterpart from "counterpart";
import {Form, Select} from "bitshares-ui-style-guide";
import WalletUnlockStore from "stores/WalletUnlockStore";
import SettingsActions from "actions/SettingsActions";
import {getAllowedLogins} from "../../branding";
import {useAltStore} from "../../next/hooks/useAltStore";

function LoginTypeSelectorView({
    value,
    onChange
}: {
    value: string;
    onChange: (value: any) => void;
}) {
    return (
        <Form.Item label={counterpart.translate("account.login_with")}>
            <Select onChange={onChange} value={value}>
                {getAllowedLogins().includes("password") && (
                    <Select.Option value="cloud">
                        {counterpart.translate("account.name")} (
                        {counterpart
                            .translate("wallet.password_model")
                            .toLowerCase()}
                        )
                    </Select.Option>
                )}
                {getAllowedLogins().includes("wallet") && (
                    <Select.Option value="local">
                        {counterpart.translate("wallet.key_file")} (
                        {counterpart
                            .translate("wallet.wallet_model")
                            .toLowerCase()}
                        )
                    </Select.Option>
                )}
            </Select>
        </Form.Item>
    );
}

export default function LoginTypeSelector(props: any) {
    const walletUnlockState = useAltStore<any>(WalletUnlockStore as any);

    if (getAllowedLogins().length == 1) return null;

    const value = walletUnlockState.passwordLogin ? "cloud" : "local";
    const onChange = (value: any) => {
        const newType = value;
        const validValues = ["cloud", "local"];
        if ((!newType as any) in (validValues as any))
            throw new Error("Invalid login type value");
        return SettingsActions.changeSetting({
            setting: "passwordLogin",
            value: newType === "cloud"
        } as any);
    };

    return (
        <LoginTypeSelectorView {...props} value={value} onChange={onChange} />
    );
}
