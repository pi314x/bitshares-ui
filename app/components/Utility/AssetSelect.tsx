// TypeScript/functional-component port of the legacy AssetSelect.jsx
// (default-exports `BindToChainState(AssetSelectView)`) (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Preserved verbatim (not "fixed"): the original assigned
// `AssetSelectView.defaultPropTypes = {...}` - not the correctly-spelled
// `defaultProps` - so React never actually applied any of those "default"
// values (`assets: []`, `style: ""`, etc.); the whole block was already
// dead/inert at runtime, a pre-existing typo. Adding real defaults here
// would silently change behavior (e.g. `<AssetSelect>` with no `assets`
// prop passed would currently crash on `assets.filter(...)`, not fall
// back to an empty array), so none are added.
//
// Structural change (not a behavior change): the original's
// `BindToChainState(AssetSelectView)` HOC resolved the `assets` prop via
// its `chain_assets_list` category (`ChainTypes.ChainAssetsList`, matched
// by `isAssetsListType`) - replaced by a Container component replicating
// that exact resolution loop (including its sparse-array quirk: the loop
// increments its index *before* assigning, so the resolved array's real
// items start at index 1, with a hole at index 0 - harmless here since
// `AssetSelectView` only ever calls `.filter(...)` on the result, which
// skips array holes, but preserved verbatim rather than "fixed" since
// other, not-yet-audited consumers of the same resolution category
// elsewhere in the app could rely on the exact shape).
import * as React from "react";
import Translate from "react-translate-component";
import {Form, Select} from "bitshares-ui-style-guide";
import utils from "common/utils";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {Map} from "immutable";
import AssetName from "../Utility/AssetName";
import LoadingIndicator from "../LoadingIndicator";

interface AssetSelectViewProps {
    label?: string;
    assets: any;
    selectStyle?: any;
    formItemStyle?: any;
    style?: any;
    placeholder?: string;
    value?: any;
    onDropdownVisibleChange?: any;
    [key: string]: any;
}

const AssetSelectView = ({
    label,
    assets,
    selectStyle,
    formItemStyle,
    style,
    placeholder,
    value,
    onDropdownVisibleChange,
    ...props
}: AssetSelectViewProps) => {
    const disableSelect =
        assets.filter(Map.isMap).length <= 1 && !onDropdownVisibleChange;
    // if onDropdownVisibleChange given we assume that lazy loading takes place
    const select = (
        <Select
            showSearch
            onDropdownVisibleChange={onDropdownVisibleChange}
            showArrow={disableSelect ? false : undefined}
            style={selectStyle}
            placeholder={
                <Translate
                    content={placeholder || "utility.asset_select_placeholder"}
                />
            }
            value={value}
            {...props}
            optionFilterProp="children"
            filterOption={(input: string, option: any) =>
                option.key.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
            disabled={disableSelect}
            notFoundContent={counterpart.translate("global.not_found")}
        >
            {assets.filter(Map.isMap).map((asset: any) => {
                const {name: replacedName, prefix} = utils.replaceName(asset);

                return (
                    <Select.Option
                        key={`${prefix || ""}${replacedName}`}
                        value={asset.get("id")}
                    >
                        <AssetName noTip name={asset.get("symbol")} />
                    </Select.Option>
                );
            })}
            {props.loading && (
                <Select.Option key="loading" value="loading" disabled={true}>
                    <LoadingIndicator type="three-bounce" />
                </Select.Option>
            )}
        </Select>
    );
    return (
        <div className={"asset-select"} style={style}>
            {label ? (
                <Form.Item
                    colon={false}
                    label={<Translate content={label} />}
                    style={formItemStyle}
                >
                    {select}
                </Form.Item>
            ) : (
                select
            )}
        </div>
    );
};

function resolveAssetsList(prop: any): any[] {
    const result: any[] = [];
    if (!prop) return result;
    let index = 0;
    prop.forEach((obj_id: any) => {
        ++index;
        if (obj_id) {
            result[index] = (ChainStore as any).getAsset(obj_id);
        }
    });
    return result;
}

interface AssetSelectProps extends Omit<AssetSelectViewProps, "assets"> {
    assets?: any;
}

function AssetSelect({assets: assetsProp, ...rest}: AssetSelectProps) {
    useChainStoreTick();
    const assets = resolveAssetsList(assetsProp);

    return <AssetSelectView {...(rest as any)} assets={assets} />;
}

export default AssetSelect;
