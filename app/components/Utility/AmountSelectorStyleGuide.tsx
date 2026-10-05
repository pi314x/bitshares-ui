// TypeScript/functional-component port of the legacy
// AmountSelectorStyleGuide.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes. A near-twin of the just-ported
// `AmountSelector.tsx` (same `extends DecimalChecker` shape), rendering
// the newer bitshares-ui-style-guide `Form`/`Input`/`AssetSelect`
// widgets instead of the legacy markup.
//
// Not security-sensitive per AGENTS.md: grepped for `WalletDb`,
// `WalletApi`, `.add_type_operation`, `process_transaction` - none
// appear. Same reasoning as `AmountSelector.tsx`'s header comment: a
// plain amount/asset input control, not itself a transaction builder.
//
// `class AmountSelector extends DecimalChecker` is a LIVE inheritance
// use, same as its twin: `getNumericEventValue`/`onPaste`/`onKeyPress`
// are all genuinely called (`_onChange`; the `<Input>`'s
// `onPaste={this.props.onPaste || this.onPaste.bind(this)}` and
// `onKeyPress={this.onKeyPress.bind(this)}`). Inlined as plain local
// functions reading `allowNaN` from this file's own props, same pattern
// as `AmountSelector.tsx`/`Exchange/ExchangeInput.tsx`.
//
// `componentDidMount() { this.onAssetChange(this.props.asset); }` becomes
// a mount-only `useEffect(() => {...}, [])`.
//
// Preserved verbatim, not "fixed": `formatAmount`'s slightly different
// (from its twin) guard order - `if (!v && typeof v !== "number") v =
// "";` then unconditional `.toString()` - a real behavioral difference
// from `AmountSelector.tsx`'s `formatAmount` that predates this
// migration (this file accepts `0` as a valid amount and stringifies it,
// where the twin's looser `if (!v) v = "";` would have treated `0` the
// same as empty - not unified here, both transcribed exactly as their
// own originals had them).
import * as React from "react";
import Immutable from "immutable";
import counterpart from "counterpart";
import AssetWrapper from "./AssetWrapper";
import {Form, Input, Icon} from "bitshares-ui-style-guide";
import AssetSelect from "./AssetSelect";

interface AmountSelectorProps {
    label?: string; // a translation key for the label
    assets?: any[];
    amount?: any;
    placeholder?: string;
    onChange?: (value: any) => void;
    tabIndex?: number;
    error?: string;
    selectDisabled?: boolean;
    disabled?: boolean;
    style?: any;
    display_balance?: any;
    lockStatus?: boolean;
    onLockChange?: (value: boolean) => void;
    isPrice?: boolean;
    base?: any;
    asset: any;
    validateStatus?: any;
    help?: any;
    onSearch?: (value: any) => void;
    allowNaN?: boolean;
    onPaste?: (e: any) => void;
}

function AmountSelector({
    label,
    assets,
    amount,
    placeholder,
    onChange,
    tabIndex = 0,
    error,
    selectDisabled = false,
    disabled = false,
    style,
    display_balance,
    lockStatus,
    onLockChange,
    isPrice,
    base,
    asset,
    validateStatus,
    help,
    onSearch,
    allowNaN,
    onPaste
}: AmountSelectorProps) {
    const onAssetChange = (selected_asset: any) => {
        if (onChange) onChange({amount, asset: selected_asset});
    };

    React.useEffect(() => {
        onAssetChange(asset);
        // eslint-disable-next-line
    }, []);

    const formatAmount = (v: any): string => {
        // TODO: use asset's precision to format the number
        if (!v && typeof v !== "number") v = "";
        const value = v
            .toString()
            .trim()
            .replace(/,/g, "");

        return value;
    };

    const getNumericEventValue = (e: any) => {
        let input = null;
        if (e.target.value == "" || e.target.value == null) {
            return "";
        } else if (parseFloat(e.target.value) == e.target.value) {
            input = e.target.value.trim();
        } else {
            input =
                parseFloat(e.target.value.trim().replace(/[^\d.-]/g, "")) || 0;
        }
        return input;
    };

    const _onChange = (e: any) => {
        if (onChange) onChange({amount: getNumericEventValue(e), asset});
    };

    const _onLockChange = (value: boolean) => {
        if (onLockChange) onLockChange(value);
    };

    const defaultOnPaste = (e: any) => {
        const pasteValue = e.clipboardData.getData("text");
        const decimal = pasteValue.match(/\./g);
        const decimalCount = decimal ? decimal.length : 0;

        if (decimalCount > 1) e.preventDefault();
        if (!allowNaN && parseFloat(pasteValue) != pasteValue)
            e.preventDefault();
    };

    const onKeyPress = (e: any) => {
        if (!e.nativeEvent.ctrlKey) {
            if (e.key === "." && e.target.value === "") e.target.value = "0";
            const nextValue = e.target.value + e.key;
            const decimal = nextValue.match(/\./g);
            const decimalCount = decimal ? decimal.length : 0;
            if (e.key === "." && decimalCount > 1) e.preventDefault();
            if (parseFloat(nextValue) != nextValue) e.preventDefault();
        }
    };

    const value = error ? counterpart.translate(error) : formatAmount(amount);

    const label_el = label ? (
        <div className="amount-selector-field--label">
            {counterpart.translate(label)}
            {display_balance && (
                <div className="amount-selector-field--balance">
                    {display_balance}
                </div>
            )}
        </div>
    ) : null;

    const addonBefore =
        typeof lockStatus == "boolean" ? (
            <Icon
                className={!lockStatus ? "grey" : "green"}
                type={!lockStatus ? "unlock" : "lock"}
                onClick={() => _onLockChange(!lockStatus ? true : false)}
                style={{fontSize: "20px"}}
            />
        ) : null;

    const addonAfter = isPrice ? (
        <div>
            {asset.get("symbol")}/{base}
        </div>
    ) : (
        <AssetSelect
            style={{width: "130px"}}
            selectStyle={{width: "100%"}}
            value={asset.get("symbol")}
            assets={Immutable.List(assets)}
            onChange={onAssetChange}
            disabled={selectDisabled ? true : undefined}
            tabIndex={tabIndex + 1}
            onSearch={onSearch}
        />
    );

    return (
        <Form.Item
            label={label_el}
            style={style}
            className="amount-selector-field"
            validateStatus={validateStatus}
            help={help}
        >
            <Input.Group compact>
                <Input
                    type="number"
                    disabled={disabled}
                    value={value || ""}
                    style={{
                        width: "calc(100% - 130px)"
                    }}
                    placeholder={placeholder}
                    onChange={_onChange}
                    tabIndex={tabIndex}
                    onPaste={onPaste || defaultOnPaste}
                    onKeyPress={onKeyPress}
                    addonBefore={addonBefore}
                    className="input-group-unbordered-before"
                />
                {addonAfter}
            </Input.Group>
        </Form.Item>
    );
}

export default AssetWrapper(AmountSelector as any);
