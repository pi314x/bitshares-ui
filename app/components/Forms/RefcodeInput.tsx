// TypeScript/functional-component port of the legacy RefcodeInput.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: only handles a referral code,
// not wallet/key material. The `console.log` calls print the refcode
// value and a faucet URL, not any credential - kept verbatim.
//
// This file is orphaned: grepped every `.jsx`/`.tsx` file in the app -
// `RefcodeInput` is referenced only inside comments (a disabled
// `<RefcodeInput>` block in `Account/CreateAccount.tsx`, itself already
// commented out) and never actually imported or rendered anywhere.
// Ported faithfully regardless, matching this migration's established
// treatment of orphaned components (e.g. `Modal/ReportModal.tsx`) -
// removing genuinely orphaned files is a Phase 9 concern, not this
// mechanical Phase 8 port.
//
// Notable pre-existing bug this port's normal PropTypes->TS conversion
// happens to dissolve rather than needing a forced workaround for: the
// original's `static propTypes = {...}` referenced `PropTypes` without
// ever importing the `prop-types` package - a module-load-time
// `ReferenceError` had this file ever actually been imported anywhere
// (it never was, per the orphan note above). Since this migration always
// replaces `propTypes` with a TypeScript interface rather than keeping
// literal runtime `PropTypes` objects (every other ported file gets the
// same treatment), the bug simply has no equivalent to preserve or fix.
//
// Dropped as confirmed dead (grepped within this file - nothing else in
// the app calls them either, being orphaned): the imperative `value()`/
// `clear()` instance methods and the legacy string ref
// `ref="refcode_input"`; the `placeholder` prop (declared in the
// original's `propTypes`, never actually read anywhere in `render()`).
//
// Preserved verbatim, not "fixed": `isValidRefcode()` always returns
// `true` (takes no real logic), so the `error = "Not a valid referral
// code"` branch in `render()` can never actually trigger - the original
// called `this.isValidRefcode(this.props.value)`, passing an argument
// the method's own signature never declared and that isn't even a real
// prop this component's `propTypes` ever listed (always `undefined`
// regardless) - TypeScript won't compile a call site passing more
// arguments than a typed function declares, so the discarded argument is
// dropped at the call site (same category of mechanical, non-behavior-
// changing trim as the discarded bind-args already dropped elsewhere in
// this migration, e.g. `Modal/IssueModal.tsx`).
import * as React from "react";
import classnames from "classnames";
import Translate from "react-translate-component";
import cookies from "cookies-js";
import SettingsStore from "stores/SettingsStore";

/**
 * @brief Allows the user to enter a referral code
 */

interface RefcodeInputProps {
    label: string; // a translation key for the label
    action_label?: string; // the placeholder text to be displayed when there is no user_input
    tabIndex?: number; // tabindex property to be passed to input tag
    allow_claim_to_account?: string; // show claim button and allow to claim to specified account
}

function getInitialValue() {
    const refcode_match = window.location.hash.match(/refcode\=([\w\d]+)/);
    return refcode_match ? refcode_match[1] : (cookies as any).get("_refcode_");
}

function isValidRefcode() {
    return true;
}

export default function RefcodeInput({
    label,
    action_label,
    tabIndex,
    allow_claim_to_account
}: RefcodeInputProps) {
    const [value, setValue] = React.useState<any>(getInitialValue);
    const [error, setError] = React.useState<any>(null);

    const clear = () => {
        setValue("");
    };

    const onInputChanged = (event: any) => {
        const nextValue = event.target.value.trim();
        setValue(nextValue);
        setError(null);
    };

    const onClaim = (event: any) => {
        event.preventDefault();
        const faucet_address = (SettingsStore as any).getSetting(
            "faucet_address"
        );
        console.log("-- RefcodeInput.onClaim -->", value, faucet_address);
        const claim_url = `${(SettingsStore as any).getSetting(
            "faucet_address"
        )}/api/v1/referral_codes/${value}/claim?account=${allow_claim_to_account}`;
        fetch(claim_url, {
            method: "get",
            mode: "cors",
            headers: {
                Accept: "application/json",
                "Content-type": "application/json"
            }
        })
            .then(r => r.json())
            .then(res => {
                if (res.error) {
                    setError(res.error);
                } else {
                    console.log("-- RefcodeInput claimed -->", res);
                    clear();
                    // TODO: show success notification
                }
                (cookies as any).set("_refcode_", null);
            })
            .catch(err => {
                console.error("-- RefcodeInput.onClaim fetch error -->", err);
                setError("Unknown error");
            });
    };

    const onKeyDown = (event: any) => {
        if (event.keyCode === 13) onClaim(event);
    };

    let displayError = error;
    if (!displayError && !isValidRefcode())
        displayError = "Not a valid referral code";
    const action_class = classnames("button", {disabled: !!displayError});

    return (
        <div className="refcode-input">
            <label>
                <Translate component="label" content={label} />
            </label>
            <span className="inline-label">
                <input
                    type="text"
                    value={value}
                    onChange={onInputChanged}
                    onKeyDown={onKeyDown}
                    tabIndex={tabIndex}
                    autoComplete="off"
                />
                {allow_claim_to_account ? (
                    <button className={action_class} onClick={onClaim}>
                        <Translate content={action_label as any} />
                    </button>
                ) : null}
            </span>
            <div className="has-error" style={{padding: "0.6rem 0 0 0"}}>
                <span>{displayError}</span>
            </div>
        </div>
    );
}
