// TypeScript/functional-component port of the legacy AmountSelector.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
// The first of the final 4 `Utility/` files - ported directly by the
// orchestrating session (not delegated), since it depends on
// `AssetWrapper.tsx` (an earlier batch) and was explicitly held back
// from that batch's own scope pending this follow-up.
//
// Not security-sensitive per AGENTS.md: grepped for `WalletDb`,
// `WalletApi`, `.add_type_operation`, `process_transaction` - none
// appear. This is a plain amount/asset input control; the many screens
// that use it to build transaction amounts (Barter, HtlcModal,
// SendModal, CreditOffer/*, etc.) own the actual transaction-building
// logic themselves.
//
// `class AmountSelector extends DecimalChecker` (`./DecimalChecker`) is a
// LIVE inheritance use - unlike most `extends X` patterns found earlier
// in this migration. Grepped every method DecimalChecker provides
// (`getNumericEventValue`/`onPaste`/`onKeyPress`): all three are
// genuinely called here (`_onChange` via `getNumericEventValue`; the
// `<input>`'s `onPaste={this.props.onPaste || this.onPaste.bind(this)}`
// and `onKeyPress={this.onKeyPress.bind(this)}`) - the first file in this
// migration where all three DecimalChecker methods are live at once.
// Inlined as plain local functions, reading `allowNaN` from this file's
// own props (grep-confirmed genuinely passed by many real callers -
// `Showcases/Barter.tsx`, `Modal/SendModal.tsx`, `Modal/HtlcModal.tsx`,
// `Modal/DirectDebitModal.tsx`/`DirectDebitClaimModal.tsx`,
// `Modal/WithdrawModalNew.tsx`, `Account/CreditOffer/*.tsx` all pass
// `allowNaN={true}`) - same inlining pattern already established by
// `Exchange/ExchangeInput.tsx` for the identical base class.
//
// The inner `class AssetSelector extends React.Component` (wrapped with
// `AssetWrapper(AssetSelector, {asList: true})`) becomes a separate
// function component, `AssetSelectorCore`, wrapped the same way.
// `shouldComponentUpdate` here is a pure re-render guard (no
// `componentDidUpdate` in this class to gate) - dropped per this
// migration's general rule.
//
// `componentDidMount() { this.onAssetChange(this.props.asset); }` becomes
// a mount-only `useEffect(() => {...}, [])`.
//
// Preserved verbatim, not "fixed": the commented-out `// TODO: use
// asset's precision to format the number` note in `formatAmount`;
// `formatAmount`'s loose `typeof v === "number"` coercion before
// `.trim()` (would throw if ever passed something that is neither a
// string nor a number nor falsy - never observed in practice, since
// `amount` is always a string/number/undefined from every real caller).
//
// TS-forced adjustment: `AssetSelector`'s `values` reduce built an object
// keyed by asset symbol (`{[symbol]: assetImmutableMap}`) - typed `any`
// since `FloatingDropdown.tsx`'s own `values` prop is already `any`.
import * as React from "react";
import Translate from "react-translate-component";
import FormattedAsset from "./FormattedAsset";
import FloatingDropdown from "./FloatingDropdown";
import Immutable from "immutable";
import counterpart from "counterpart";
import AssetWrapper from "./AssetWrapper";

interface AssetSelectorCoreProps {
    value?: string;
    onChange: (value: any) => void;
    scroll_length?: number;
    assets: any[];
}

function AssetSelectorCore({
    value,
    onChange,
    scroll_length,
    assets
}: AssetSelectorCoreProps) {
    if (!assets.length) return null;

    return (
        <FloatingDropdown
            entries={assets.map((a: any) => a && a.get("symbol")).filter((a: any) => !!a)}
            values={assets.reduce((map: any, a: any) => {
                if (a && a.get("symbol")) map[a.get("symbol")] = a;
                return map;
            }, {})}
            singleEntry={
                assets[0] ? (
                    <FormattedAsset
                        asset={assets[0].get("id")}
                        amount={0}
                        hide_amount={true}
                    />
                ) : null
            }
            value={value}
            onChange={onChange}
            scroll_length={scroll_length}
        />
    );
}

const AssetSelector = AssetWrapper(AssetSelectorCore, {asList: true});

interface AmountSelectorProps {
    label?: string; // a translation key for the label
    assets?: any[];
    amount?: any;
    placeholder?: string;
    onChange?: (value: any) => void;
    tabIndex?: number;
    error?: string;
    scroll_length?: number;
    disabled?: boolean;
    style?: any;
    display_balance?: any;
    isPrice?: boolean;
    base?: any;
    asset: any;
    allowNaN?: boolean;
    onPaste?: (e: any) => void;
    refCallback?: (ref: any) => void;
}

function AmountSelector({
    label,
    assets,
    amount,
    placeholder,
    onChange,
    tabIndex = 0,
    error,
    scroll_length,
    disabled = false,
    style,
    display_balance,
    isPrice,
    base,
    asset,
    allowNaN,
    onPaste,
    refCallback
}: AmountSelectorProps) {
    const onAssetChange = (selected_asset: any) => {
        if (onChange) onChange({amount, asset: selected_asset});
    };

    React.useEffect(() => {
        onAssetChange(asset);
        // eslint-disable-next-line
    }, []);

    const formatAmount = (v: any): string => {
        /*// TODO: use asset's precision to format the number*/
        if (!v) v = "";
        if (typeof v === "number") v = v.toString();
        const value = v.trim().replace(/,/g, "");

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

    //console.log("Calling AmountSelector: " + label + asset + assets + amount + placeholder + error);
    const value = error ? counterpart.translate(error) : formatAmount(amount);

    return (
        <div className="amount-selector" style={style}>
            <label className="right-label">{display_balance}</label>
            <Translate className="left-label" component="label" content={label} />
            <div className="inline-label input-wrapper">
                <input
                    disabled={disabled}
                    type="text"
                    value={value || ""}
                    placeholder={placeholder}
                    onChange={_onChange}
                    tabIndex={tabIndex}
                    onPaste={onPaste || defaultOnPaste}
                    onKeyPress={onKeyPress}
                />

                <div className="form-label select floating-dropdown">
                    {isPrice ? (
                        <div className="dropdown-wrapper inactive">
                            <div>
                                {asset.get("symbol")}/{base}
                            </div>
                        </div>
                    ) : (
                        <AssetSelector
                            ref={refCallback}
                            value={asset.get("symbol")}
                            assets={Immutable.List(assets)}
                            onChange={onAssetChange}
                            scroll_length={scroll_length}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default AssetWrapper(AmountSelector as any);
