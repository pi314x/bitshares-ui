// TypeScript/functional-component port of the legacy AssetSelector.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `AssetDropdown`'s `AssetWrapper(Component, {asList: true})` HOC usage
// is kept as-is (shared HOC, out of scope).
//
// Dropped as confirmed dead: the `getAsset()` method and its "can be
// used in parent component: this.refs.asset_selector.getAsset()" comment
// - grepped for `.getAsset()` across the whole app and found zero
// callers using it via a ref anywhere; the only match was the comment
// itself. The `ref={this.props.refCallback}` passed through to the
// inner `AssetDropdown` is left as-is despite this (harmless whether
// read or not, and this migration has already found - in
// `XbtsxWithdrawModal.tsx`'s port - that this whole `refCallback` chain
// through the `AmountSelector`/`AssetSelector` family is unread
// elsewhere too).
//
// Structural change (not a behavior change): the original's
// `BindToChainState(AssetSelector)` HOC (resolving the optional `asset`
// prop via `ChainStore.getAsset`) is replaced by a Container under
// `useChainStoreTick()`, per this migration's established pattern.
// `componentDidMount` (calls `onFound` if already truthy) +
// `UNSAFE_componentWillReceiveProps` (calls `onFound` whenever the
// resolved `asset` reference changes) are unified into one `useEffect`
// keyed on `asset`, with a mount-only ref distinguishing the two
// original call sites' slightly different conditions (mount requires
// `asset` truthy; update only requires the reference to have changed).
import * as React from "react";
import Translate from "react-translate-component";
import {ChainValidation, ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import counterpart from "counterpart";
import FloatingDropdown from "./FloatingDropdown";
import FormattedAsset from "./FormattedAsset";
import Immutable from "immutable";
import classnames from "classnames";
import AssetWrapper from "./AssetWrapper";

interface AssetDropdownProps {
    value?: string; // asset id
    onChange?: (value: any) => void;
    assets?: any;
    refCallback?: any;
}

function AssetDropdown({assets, value, onChange}: AssetDropdownProps) {
    if (!assets || assets.length === 0 || !value) return null;
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
            value={""}
            onChange={onChange as any}
        />
    );
}

const WrappedAssetDropdown = AssetWrapper(AssetDropdown, {asList: true});

/**
 * @brief Allows the user to enter an account by name or #ID
 *
 * This component is designed to be stateless as possible.  It's primary responsbility is to
 * manage the layout of data and to filter the user input.
 *
 */

interface AssetSelectorCoreProps {
    label?: string; // a translation key for the label
    error?: string; // the error message override
    placeholder?: string; // the placeholder text to be displayed when there is no user_input
    onChange?: (value: any) => void; // a method to be called any time user input changes
    onFound?: (asset: any) => void; // a method to be called when existing account is selected
    onAction?: (asset: any) => void;
    assetInput?: string; // the current value of the account selector, the string the user enters
    asset?: any; // account object retrieved via BindToChainState decorator (not input)
    assets?: any[];
    tabIndex?: number; // tabindex property to be passed to input tag
    disableActionButton?: boolean; // use it if you need to disable action button
    disabled?: boolean;
    noLabel?: boolean;
    style?: any;
    inputClass?: string;
    inputStyle?: any;
    action_label?: string;
    refCallback?: any;
    children?: React.ReactNode;
}

function AssetSelectorCore({
    label,
    error: errorProp,
    placeholder,
    onChange,
    onFound,
    onAction,
    assetInput,
    asset,
    assets,
    tabIndex,
    disableActionButton,
    disabled = false,
    noLabel,
    style,
    inputClass,
    inputStyle,
    action_label,
    refCallback,
    children
}: AssetSelectorCoreProps) {
    const getNameType = (value?: string) => {
        if (!value) return null;
        // if(value[0] === "#" && utils.is_object_id("1.2." + value.substring(1))) return "id";
        if (!ChainValidation.is_valid_symbol_error(value, true)) return "symbol";
        return null;
    };

    const getError = (input: string | undefined = assetInput) => {
        let error = errorProp;
        if (!error && input && !getNameType(input))
            error = counterpart.translate("explorer.asset.invalid", {
                name: input
            });
        return error;
    };

    const isMountRef = React.useRef(true);
    const prevAssetRef = React.useRef<any>(undefined);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            if (onFound && asset) onFound(asset);
        } else if (onFound && asset !== prevAssetRef.current) {
            onFound(asset);
        }
        prevAssetRef.current = asset;
    }, [asset]);

    const onInputChanged = (event: any) => {
        const value = event.target.value
            .trim()
            .substr(0, 16)
            .toUpperCase(); //.toLowerCase();
        if (onChange && value !== assetInput) onChange(value);
    };

    const onFoundClick = (e: any) => {
        e.preventDefault();
        if (onFound && !getError() && !disableActionButton) {
            if (asset) onFound(asset);
        }
    };

    const onActionClick = (e: any) => {
        e.preventDefault();
        if (onAction && !getError() && !disableActionButton) {
            if (asset) onAction(asset);
        }
    };

    const onKeyDown = (event: any) => {
        if (event.keyCode === 13) {
            onFoundClick(event);
            onActionClick(event);
        }
    };

    const onAssetSelect = (selected_asset: any) => {
        if (selected_asset) {
            if (onFound) onFound(selected_asset);
            if (onChange) onChange(selected_asset.get("symbol"));
        }
    };

    let error = getError();
    let lookup_display;
    if (!disabled) {
        if (asset) {
            lookup_display = asset.get("symbol");
        } else if (!error && assetInput) {
            error = counterpart.translate("explorer.asset.not_found", {
                name: assetInput
            });
        }
    }

    const action_class = classnames("button", {
        disabled: !asset || !!error || !!disableActionButton
    });

    return (
        <div className="asset-selector" style={style}>
            <div>
                <div className="header-area">
                    {error || noLabel ? null : (
                        <label className="right-label">
                            &nbsp; <span>{lookup_display}</span>
                        </label>
                    )}
                    <Translate component="label" content={label} />
                </div>
                <div className="input-area">
                    <div className="inline-label input-wrapper">
                        <input
                            className={inputClass}
                            style={inputStyle}
                            disabled={disabled}
                            type="text"
                            value={assetInput || ""}
                            placeholder={
                                placeholder ||
                                counterpart.translate("explorer.assets.symbol")
                            }
                            onChange={onInputChanged}
                            onKeyDown={onKeyDown}
                            tabIndex={tabIndex}
                        />
                        <div className="form-label select floating-dropdown">
                            {asset ? (
                                <WrappedAssetDropdown
                                    ref={refCallback}
                                    value={asset.get("symbol")}
                                    assets={Immutable.List(assets)}
                                    onChange={onAssetSelect}
                                />
                            ) : null}
                        </div>
                        {children}
                        {onAction ? (
                            <button className={action_class} onClick={onActionClick}>
                                <Translate content={action_label} />
                            </button>
                        ) : null}
                    </div>
                </div>
                <div className="error-area" style={{paddingBottom: "10px"}}>
                    <span style={{wordBreak: "break-all"}}>{error}</span>
                </div>
            </div>
        </div>
    );
}

interface AssetSelectorProps extends Omit<AssetSelectorCoreProps, "asset"> {
    asset?: string;
    [key: string]: any;
}

function AssetSelector({asset: assetProp, ...rest}: AssetSelectorProps) {
    useChainStoreTick();
    const asset = assetProp ? (ChainStore as any).getAsset(assetProp) : assetProp;

    return <AssetSelectorCore {...(rest as any)} asset={asset} />;
}

export default AssetSelector;
