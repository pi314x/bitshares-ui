// TypeScript/functional-component port of the legacy ExchangeInput.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - a numeric-only text input used
// across the Exchange order forms and a few other modals (`WithdrawModalNew.jsx`,
// `AddOpinionModal.jsx`), reused unchanged there.
//
// The legacy class extended `DecimalChecker` (`../Utility/DecimalChecker`),
// a shared base class still extended by four other, not-yet-ported
// components (`AmountSelector.jsx`, `AmountSelectorStyleGuide.jsx`,
// `DepositModal.jsx`, `SimpleDepositWithdraw.jsx`) - so `DecimalChecker`
// itself is left untouched, and this port instead inlines the two
// methods it actually used (`onPaste`/`onKeyPress`), reading
// `allowNaN`/the caller's own `onKeyPress` from props directly, exactly
// as `this.props` resolved them through the extends chain. `getNumericEventValue`,
// `DecimalChecker`'s third method, was never called by `ExchangeInput`
// and isn't ported here either.
//
// `UNSAFE_componentWillReceiveProps` (clearing the underlying input's DOM
// value when `value` transitions from truthy to falsy) becomes a
// mount-guarded, no-dependency-array `useEffect` comparing against the
// previous render's `value` - the same substitution used elsewhere in
// this migration for WRC-style "did this one prop change" checks.
import * as React from "react";
import {Input} from "bitshares-ui-style-guide";

interface ExchangeInputProps {
    allowNaN?: boolean;
    value?: any;
    onPaste?: (e: any) => void;
    onKeyPress?: (e: any) => void;
    [key: string]: any;
}

export default function ExchangeInput({
    allowNaN = false,
    ...other
}: ExchangeInputProps) {
    const inputRef = React.useRef<any>(null);
    const prevValueRef = React.useRef(other.value);
    const isFirstRender = React.useRef(true);

    React.useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            prevValueRef.current = other.value;
            return;
        }
        if (prevValueRef.current && !other.value) {
            if (inputRef.current) {
                inputRef.current.value = "";
            }
        }
        prevValueRef.current = other.value;
        // eslint-disable-next-line
    });

    function onPaste(e: any) {
        const pasteValue = e.clipboardData.getData("text");
        const decimal = pasteValue.match(/\./g);
        const decimalCount = decimal ? decimal.length : 0;

        if (decimalCount > 1) e.preventDefault();
        if (!allowNaN && parseFloat(pasteValue) != pasteValue)
            e.preventDefault();
    }

    function onKeyPress(e: any) {
        if (!e.nativeEvent.ctrlKey) {
            // allow copy-paste

            if (e.key === "." && e.target.value === "") e.target.value = "0";
            const nextValue = e.target.value + e.key;
            const decimal = nextValue.match(/\./g);
            const decimalCount = decimal ? decimal.length : 0;
            if (e.key === "." && decimalCount > 1) e.preventDefault();
            if (parseFloat(nextValue) != nextValue) e.preventDefault();

            if (other.onKeyPress) other.onKeyPress(e);
        }
    }

    return (
        <Input
            ref={inputRef}
            type="text"
            {...other}
            onPaste={other.onPaste || onPaste}
            onKeyPress={onKeyPress}
        />
    );
}
