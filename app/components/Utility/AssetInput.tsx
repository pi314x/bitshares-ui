// TypeScript/functional-component port of the legacy AssetInput.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(ControlledAssetInput)` HOC (resolving the optional
// `asset` prop via `ChainStore.getAsset`, not gated behind a loading
// fallback since it isn't `.isRequired`) is replaced by a small Container
// doing the same resolution directly under `useChainStoreTick()`, per
// this migration's established `BindToChainState` replacement pattern.
//
// `componentDidMount` (`checkFound()`, no argument) + `componentDidUpdate`
// (`checkFound(prevProps.asset)`, run on *every* update unconditionally)
// are replicated by a single dependency-free `useEffect` (runs after
// every render) with a mount-only ref flag distinguishing the first call
// (`checkFound(undefined)`, matching the mount call's implicit `undefined`
// argument) from later ones (`checkFound(prevAssetRef.current)`), and a
// ref tracking the previous resolved `asset` value across renders.
//
// `getDerivedStateFromProps` on the outer `AssetInput` wrapper always
// derives `defaultValue` only while `state.value` is still `undefined`
// (i.e. before the user has typed anything) and passes it through
// unchanged afterward - functionally a one-time initializer, replicated
// with a `useState` lazy initializer.
//
// Dropped at this call site (design-system `Form.Item`'s own header
// comment already documents this as a deliberate scope boundary):
// antd's `hasFeedback`, which shows a small check/cross/spinner icon
// next to the input derived from `validateStatus` - the design-system
// `Form.Item` only colors its own help text, not arbitrary children, so
// there's no icon slot to wire this into. Purely cosmetic (the
// validateStatus-driven help text coloring itself is unaffected); real
// at only one other call site in the whole app (`AccountSelectorAnt
// .tsx`, not yet migrated).
import * as React from "react";
import counterpart from "counterpart";
import {Form} from "../../design-system/Form";
import {Input} from "../../design-system/Input";
import {Button} from "../../design-system/Button";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import Translate from "react-translate-component";
import {Map} from "immutable";

interface AssetInputViewProps {
    label?: string;
    hasAction?: boolean;
    onChange: (event: any) => void;
    placeholder?: string;
    style?: any;
    inputStyle?: any;
    value?: string;
    validateStatus?: string;
    onAction?: (event: any) => void;
    actionLabel?: string;
    disableActionButton?: boolean;
    help?: React.ReactNode;
}

const AssetInputView = ({
    label,
    hasAction,
    onChange,
    placeholder,
    style,
    inputStyle,
    value,
    validateStatus,
    onAction,
    actionLabel,
    disableActionButton,
    help
}: AssetInputViewProps) => (
    <React.Fragment>
        <Form.Item
            colon={false}
            label={<Translate content={label} />}
            style={style}
            className={"asset-input" + (hasAction ? " with-action" : "")}
            validateStatus={validateStatus as any}
            help={help}
        >
            <Input
                value={value}
                onChange={onChange}
                style={inputStyle}
                placeholder={placeholder}
            />
        </Form.Item>
        {hasAction && (
            <Form.Item>
                <Button variant="accent" disabled={disableActionButton} onClick={onAction}>
                    <Translate content={actionLabel} />
                </Button>
            </Form.Item>
        )}
    </React.Fragment>
);

interface ControlledAssetInputProps {
    asset?: any; // the selected asset
    onFound?: (asset: any) => void;
    resolved?: boolean;
    onChange?: (value: string) => void;
    value?: string;
    label?: string;
    placeholder?: string;
    inputStyle?: any;
    style?: any;
    actionLabel?: string;
    help?: string;
    onAction?: (asset: any) => void;
    validateStatus?: string;
}

function ControlledAssetInput({
    asset,
    onFound,
    resolved,
    onChange,
    value,
    label,
    placeholder,
    inputStyle,
    style,
    actionLabel,
    help,
    onAction,
    validateStatus: validateStatusProp
}: ControlledAssetInputProps) {
    const checkFound = (prevAsset: any) => {
        if (
            resolved &&
            asset !== undefined &&
            typeof onFound === "function" &&
            (Map.isMap(prevAsset) && Map.isMap(asset)
                ? prevAsset.get("id") !== asset.get("id")
                : prevAsset != asset)
        ) {
            onFound(Map.isMap(asset) ? asset : null);
        }
    };

    const prevAssetRef = React.useRef<any>(undefined);
    const isMountRef = React.useRef(true);

    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            checkFound(undefined);
        } else {
            checkFound(prevAssetRef.current);
        }
        prevAssetRef.current = asset;
    });

    const handleChange = (event: any) => {
        if (typeof onChange === "function")
            onChange(event.target.value.toUpperCase());
    };

    const getValidateStatus = () => {
        return typeof validateStatusProp === "string"
            ? validateStatusProp
            : resolved
            ? Map.isMap(asset)
                ? "success"
                : value
                ? "error"
                : undefined
            : "validating";
    };

    const handleAction = () => {
        if (onAction) onAction(asset);
    };

    const validateStatus = getValidateStatus();
    const hasAction = typeof onAction === "function";
    return (
        <AssetInputView
            label={label}
            onChange={handleChange}
            hasAction={hasAction}
            onAction={handleAction}
            actionLabel={actionLabel}
            placeholder={counterpart.translate(
                placeholder || "utility.asset_input_placeholder"
            )}
            disableActionButton={validateStatus !== "success"}
            inputStyle={inputStyle}
            style={style}
            value={value}
            validateStatus={validateStatus}
            help={help ? <Translate content={help} /> : ""}
        />
    );
}

function BoundAssetInput(props: ControlledAssetInputProps) {
    useChainStoreTick();
    const asset = props.asset
        ? (ChainStore as any).getAsset(props.asset)
        : props.asset;

    return <ControlledAssetInput {...props} asset={asset} />;
}

// wrapper so you only need to hook onFound and provide a defaultValue
interface AssetInputProps {
    // common
    label?: string; // a translation key for the label
    placeholder?: string; // the placeholder text to be displayed when there is no input
    // default to "utility.asset_input_placeholder"
    onFound?: (asset: any) => void; // a method to be called when a valid asset is found, the asset object is passed as argument.
    // is called with null when the input is changed from a valid to an invalid asset name
    style?: any; // style to pass to the containing component (Form.Item)
    inputStyle?: any; // Input component style
    onAction?: (asset: any) => void; // if provided, an action button will be displayed and this method will be called when the button is clicked
    actionLabel?: string; // translation key for the action button
    validateStatus?: string; // "succes", "error" or "validating" the action button will be disabled if set to "error"
    // if not provided, it is derived from the validity of the current value
    help?: string; // a translation key for the help

    // automatic mode (no onChange callback provided)
    defaultValue?: string; // pre-entered value

    // controlled mode
    onChange?: (value: string) => void; // a method to be called when the input changes, the input is passed as argument
    value?: string; // the current value of the asset selector, the string the user enters (only used if an onChange callback is provided)
    [key: string]: any;
}

function AssetInput(props: AssetInputProps) {
    const [value, setValue] = React.useState(() => props.defaultValue || "");

    const handleChange = (newValue: string) => {
        setValue(newValue);
    };

    const {onChange} = props;
    const childProps =
        typeof onChange === "function"
            ? props
            : {
                  ...props,
                  value,
                  onChange: handleChange
              };
    return <BoundAssetInput asset={childProps.value} {...(childProps as any)} />;
}

export default AssetInput;
