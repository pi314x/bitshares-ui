// TypeScript/functional-component port of the legacy AssetWhitelist.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's `connect
// (AssetWhitelist, {listenTo, getProps})` alt-react HOC is replaced by
// `useAltStore(SettingsStore)`.
import * as React from "react";
import LinkToAccountById from "../Utility/LinkToAccountById";
import LinkToAssetById from "../Utility/LinkToAssetById";
import Icon from "../Icon/Icon";
import AccountSelector from "../Account/AccountSelector";
import AssetSelector from "../Utility/AssetSelector";
import cnames from "classnames";
import Translate from "react-translate-component";
import SettingsStore from "stores/SettingsStore";
import SettingsActions from "actions/SettingsActions";
import {useAltStore} from "../../next/hooks/useAltStore";

const LIST_TYPES = [
    "whitelist_authorities",
    "blacklist_authorities",
    "whitelist_markets",
    "blacklist_markets",
    "whitelist_market_fee_sharing"
];

interface AssetWhitelistProps {
    assetWhiteListType: string;
    marketFeeEnabled?: boolean;
    whiteListEnabled?: boolean;
    authority_name?: string;
    new_authority_id?: any;
    onChangeList: (listType: string, action: string, value: any) => void;
    onAccountNameChanged: (key: string, name: string) => void;
    onAccountChanged: (key: string, account: any) => void;
    children?: React.ReactNode;
    [key: string]: any;
}

function AssetWhitelist({
    assetWhiteListType,
    marketFeeEnabled,
    whiteListEnabled,
    authority_name,
    new_authority_id,
    onChangeList,
    onAccountNameChanged,
    onAccountChanged,
    children,
    ...rest
}: AssetWhitelistProps) {
    const [listType, setListType] = React.useState(assetWhiteListType);
    const [accountTable, setAccountTable] = React.useState(
        assetWhiteListType.indexOf("markets") === -1
    );
    const [assetInput, setAssetInput] = React.useState<any>(null);
    const [asset_id, setAssetId] = React.useState<any>(null);

    const renderAccountTables = () => {
        let showFlagEnableError = false;
        let errorLabel = "explorer.asset.whitelist.enable_flag";

        if (listType === "whitelist_market_fee_sharing") {
            // market fee sharing whitelist
            if (!marketFeeEnabled) {
                showFlagEnableError = true;
                errorLabel = "explorer.asset.whitelist.market_fee_enable_flag";
            }
        } else {
            showFlagEnableError = !whiteListEnabled;
        }

        if (showFlagEnableError)
            return (
                <div>
                    <Translate
                        className="txtlabel cancel"
                        component="p"
                        content={errorLabel}
                    />
                </div>
            );

        return (
            <div>
                <table className="table dashboard-table table-hover">
                    <thead>
                        <tr>
                            <th>
                                <Translate content="explorer.account.title" />
                            </th>
                            <th>
                                <Translate content="account.perm.remove_text" />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rest[listType].map((a: any) => {
                            return (
                                <tr key={a}>
                                    <td>
                                        <LinkToAccountById account={a} />
                                    </td>
                                    <td
                                        className="clickable"
                                        onClick={onChangeList.bind(
                                            null,
                                            listType,
                                            "remove",
                                            a
                                        )}
                                    >
                                        <Icon
                                            name="cross-circle"
                                            title="icons.cross_circle.remove"
                                            className="icon-14px"
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div style={{paddingTop: "2rem"}}>
                    <AccountSelector
                        label={`account.whitelist.${listType}`}
                        accountName={authority_name}
                        account={authority_name}
                        onChange={onAccountNameChanged.bind(null, "authority_name")}
                        onAccountChanged={onAccountChanged.bind(
                            null,
                            "new_authority_id"
                        )}
                        error={null}
                        tabIndex={1}
                        action_label="account.perm.confirm_add"
                        onAction={onChangeList.bind(
                            null,
                            listType,
                            "add",
                            new_authority_id
                        )}
                    />
                </div>
            </div>
        );
    };

    const onAssetChange = (asset: any) => {
        setAssetInput(asset);
    };

    const onAssetFound = (asset: any) => {
        setAssetId(asset ? asset.get("id") : null);
    };

    const renderMarketTable = () => {
        return (
            <div>
                <table className="table dashboard-table table-hover">
                    <thead>
                        <tr>
                            <th>
                                <Translate content="explorer.asset.title" />
                            </th>
                            <th>
                                <Translate content="account.perm.remove_text" />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rest[listType].map((a: any) => {
                            return (
                                <tr key={a}>
                                    <td>
                                        <LinkToAssetById asset={a} />
                                    </td>
                                    <td
                                        className="clickable"
                                        onClick={onChangeList.bind(
                                            null,
                                            listType,
                                            "remove",
                                            a
                                        )}
                                    >
                                        <Icon
                                            name="cross-circle"
                                            title="icons.cross_circle.remove"
                                            className="icon-14px"
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div style={{paddingTop: "2rem"}}>
                    <AssetSelector
                        label={`explorer.asset.whitelist.${listType}`}
                        onChange={onAssetChange}
                        asset={assetInput}
                        assetInput={assetInput}
                        tabIndex={1}
                        style={{width: "100%"}}
                        onFound={onAssetFound}
                        action_label="account.perm.confirm_add"
                        onAction={onChangeList.bind(null, listType, "add", asset_id)}
                    />
                </div>
            </div>
        );
    };

    const onSwitchType = (type: string) => {
        setListType(type);
        setAccountTable(type.indexOf("markets") === -1);
        SettingsActions.changeViewSetting({
            assetWhiteListType: type
        });
    };

    const activeIndex = LIST_TYPES.indexOf(listType);

    return (
        <div className="small-12 large-8 large-offset-2 grid-content">
            <div>
                <div className="header-selector" style={{paddingBottom: "2rem"}}>
                    <div className="selector">
                        {LIST_TYPES.map((type, index) => {
                            return (
                                <div
                                    key={type}
                                    className={cnames("inline-block", {
                                        inactive: activeIndex !== index
                                    })}
                                    onClick={onSwitchType.bind(null, type)}
                                >
                                    <Translate
                                        content={`explorer.asset.whitelist.${type}`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
                {accountTable ? renderAccountTables() : renderMarketTable()}
                {children}
            </div>
        </div>
    );
}

function AssetWhitelistContainer(
    props: Omit<AssetWhitelistProps, "assetWhiteListType">
) {
    const settingsState = useAltStore<any>(SettingsStore);
    const assetWhiteListType = settingsState.viewSettings.get(
        "assetWhiteListType",
        "whitelist_authorities"
    );

    return <AssetWhitelist {...(props as any)} assetWhiteListType={assetWhiteListType} />;
}

export default AssetWhitelistContainer;
