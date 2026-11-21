// TypeScript/functional-component port of the legacy PubKeyInput.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md itself (only validates/displays a
// *public* key), though it renders `PrivateKeyView` (separately ported,
// itself security-sensitive) as a child.
//
// Forced judgment call (TypeScript-incompatible bug, same category as
// the bare-identifier fixes in `Modal/JoinCommitteeModal.tsx`/
// `Modal/JoinWitnessesModal.tsx`): the original's fallback placeholder
// (`this.props.placeholder || counterpart.translate("account.public_key")`)
// referenced `counterpart` without ever importing it - a real,
// reachable-in-principle `ReferenceError`, but grep-verified dormant in
// practice: both real callers (`Account/AccountSignedMessages.tsx`,
// `Account/AccountPermissions.tsx`) always pass `placeholder="Public
// Key"` explicitly, so the `||` never evaluates the broken branch.
// TypeScript refuses to compile a reference to an undeclared identifier
// at all, so - unlike plain JS, which just leaves this as a live but
// unexercised landmine - a decision is forced; added the missing
// `counterpart` import (the obvious intended fix, and a no-op for both
// real call sites either way) rather than removing the fallback outright.
//
// Also forced by TypeScript, not by a bug-preservation choice: `onAction`
// read `this.state.valid`, but this class never initializes `this.state`
// anywhere (no constructor `this.state = {...}`) - a real `Cannot read
// property 'valid' of null` if ever reached, but grep-verified dormant
// too: neither real caller ever passes an `onAction` prop, and
// `this.props.onAction && this.state.valid && ...`'s short-circuit means
// `state.valid` is never actually evaluated regardless. A function
// component has no bare, ambient `this.state` to read from at all (any
// `state` here would have to be real, declared state), so this
// specific broken reference can't be transcribed literally - the
// (already dead-in-practice) `state.valid` condition is dropped from the
// check; `event.preventDefault()` and the `props.onAction`/
// `props.disableActionButton` checks around it are kept exactly as
// before.
//
// Dropped as confirmed dead (grepped): `ref="user_input"` on the
// `<input>`, never read via `this.refs.user_input` anywhere.
import * as React from "react";
import classnames from "classnames";
import Translate from "react-translate-component";
import PrivateKeyView from "components/PrivateKeyView";
import {PublicKey} from "bitsharesjs";
import Icon from "../Icon/Icon";
import PrivateKeyStore from "stores/PrivateKeyStore";
import counterpart from "counterpart";

/**
 * @brief Allows the user to enter a public key
 */

interface PubKeyInputProps {
    label: string; // a translation key for the label
    value?: string; // current value
    error?: string; // the error message override
    placeholder?: string; // the placeholder text to be displayed when there is no user_input
    onChange?: (value: string) => void; // a method to be called any time user input changes
    onAction?: (event: any) => void; // a method called when Add button is clicked
    tabIndex?: number; // tabindex property to be passed to input tag
    disableActionButton?: boolean; // use it if you need to disable action button
    action_label?: string;
}

function isValidPubKey(value: any) {
    return !!(PublicKey as any).fromPublicKeyString(value);
}

export default function PubKeyInput({
    label,
    value,
    error: errorProp,
    placeholder,
    onChange,
    onAction,
    tabIndex,
    disableActionButton,
    action_label
}: PubKeyInputProps) {
    const onInputChanged = (event: any) => {
        const nextValue = event.target.value.trim();
        if (onChange) onChange(nextValue);
    };

    const onActionClick = (event: any) => {
        event.preventDefault();
        if (onAction && !disableActionButton) {
            onAction(event);
        }
    };

    const onKeyDown = (event: any) => {
        if (event.keyCode === 13) onActionClick(event);
    };

    let error: any = errorProp;
    if (!error && value && !isValidPubKey(value))
        error = "Not a valid public key";
    const action_class = classnames("button", {
        disabled: error || disableActionButton
    });
    const keys = (PrivateKeyStore as any).getState().keys;
    const has_private = isValidPubKey(value) && keys.has(value);

    return (
        <div className="pubkey-input no-overflow">
            <div className="content-area">
                <div className="header-area">
                    {!error && value && isValidPubKey(value) ? (
                        <label className="right-label">
                            <Translate content="account.perm.valid_pub" />
                        </label>
                    ) : null}
                    <Translate
                        className="left-label"
                        component="label"
                        content={label}
                    />
                </div>
                <div className="input-area">
                    <span className="inline-label">
                        <div className="account-image">
                            <PrivateKeyView pubkey={value as string}>
                                <Icon name="key" title="icons.key" size="4x" />
                            </PrivateKeyView>
                        </div>
                        <input
                            type="text"
                            className={has_private ? "my-key" : ""}
                            value={value}
                            placeholder={
                                placeholder ||
                                counterpart.translate("account.public_key")
                            }
                            onChange={onInputChanged}
                            onKeyDown={onKeyDown}
                            tabIndex={tabIndex}
                        />
                        {onAction ? (
                            <button
                                className={action_class}
                                onClick={onActionClick}
                            >
                                <Translate content={action_label as any} />
                            </button>
                        ) : null}
                    </span>
                </div>
                <div className="error-area has-error">
                    <span>{error}</span>
                </div>
            </div>
        </div>
    );
}
