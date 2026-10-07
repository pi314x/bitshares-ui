// TypeScript/functional-component port of the legacy CustomTable.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural change (not a behavior change): the original's `connect
// (CustomTable, {listenTo, getProps})` alt-react HOC is replaced by
// `useAltStore(SettingsStore)`. `getProps(nextProps)` only injected the
// store's `viewSettings` when the caller hadn't already passed one -
// replicated with `props.viewSettings || settingsState.viewSettings`.
import * as React from "react";
import counterpart from "counterpart";
import {Checkbox} from "../../design-system/Checkbox";
import {Icon} from "../../design-system/Icon";
import {Select} from "../../design-system/Select";
import SettingsActions from "actions/SettingsActions";
import PaginatedList from "./PaginatedList";
import "./paginated-list.scss";
import SettingsStore from "../../stores/SettingsStore";
import {useAltStore} from "../../next/hooks/useAltStore";

const {Option} = Select;

interface CustomTableCoreProps {
    viewSettingsKey?: string | null;
    viewSettings?: any;
    allowCustomization?: boolean;
    header?: any[];
    children?: React.ReactNode;
    [key: string]: any;
}

function CustomTable({
    viewSettingsKey = null,
    viewSettings,
    allowCustomization = false,
    header: headerProp,
    children,
    ...other
}: CustomTableCoreProps) {
    const [columnSelector, setColumnSelector] = React.useState("default");
    const [isDropDownOpen, setIsDropDownOpen] = React.useState(false);

    const getViewSettingsKey = () => {
        // add a prefix for all column customizations
        return "columns_" + viewSettingsKey;
    };

    const getEnabledColumns = () => {
        const settings = viewSettings.get(getViewSettingsKey());
        return settings || {};
    };

    const isColumnCustomizable = (column: any) => {
        // filter out empty columns
        if (!column.dataIndex) {
            return {
                customizable: false,
                default: false
            };
        }

        const customizable =
            column.customizable == undefined ? true : column.customizable;

        // customizable can be bool or object
        const defaultVisibility =
            column.customizable == undefined ||
            typeof column.customizable == "boolean"
                ? true
                : column.customizable.default;

        return {
            customizable: customizable,
            default: defaultVisibility
        };
    };

    const isColumnChecked = (columnArg: any) => {
        const column =
            typeof columnArg == "string"
                ? {dataIndex: columnArg, customizable: true}
                : columnArg;
        return getEnabledColumns()[column.dataIndex] == undefined
            ? isColumnCustomizable(column).default
            : getEnabledColumns()[column.dataIndex];
    };

    const getCustomizableColumns = (header: any[]) => {
        return header.filter(item => {
            // default is that customization is allowed
            return isColumnCustomizable(item).customizable;
        });
    };

    const modHeader = (header: any[]) => {
        if (!allowCustomization) {
            return header;
        }
        return header.filter(item => {
            // per default show all, only hide if specifically set to false
            return !isColumnCustomizable(item) || isColumnChecked(item);
        });
    };

    const columnCheckboxChange = (item: any) => {
        // copy and modify for state
        const enabledColumns = getEnabledColumns();
        enabledColumns[item] = !isColumnChecked(item);

        // reflect change in Store
        SettingsActions.changeViewSetting({
            [getViewSettingsKey()]: enabledColumns
        });
    };

    const columnSelectorChange = () => {
        // Never let an option, other than default be selected
        setColumnSelector("default");
    };

    const renderEnabledColumnsSelector = () => {
        return (
            <div className="customizable-column--selector">
                <Select
                    defaultValue={columnSelector}
                    value={columnSelector}
                    onChange={columnSelectorChange}
                    dropdownClassName="customizable-column--selector--dropdown"
                    onDropdownVisibleChange={(open: boolean) => {
                        setIsDropDownOpen(open);
                    }}
                >
                    <Option
                        className="customizable-column--selector--option"
                        value="default"
                    >
                        {!isDropDownOpen && <Icon type="setting" />}
                        {isDropDownOpen &&
                            counterpart.translate(
                                "customizable_table.customize_the_columns"
                            )}
                    </Option>
                    {getCustomizableColumns(headerProp || []).map((item, key) => {
                        return (
                            <Option
                                key={key}
                                className="customizable-column--selector--option"
                                value={item.dataIndex}
                                disabled
                            >
                                <Checkbox
                                    checked={isColumnChecked(item)}
                                    onChange={columnCheckboxChange.bind(
                                        null,
                                        item.dataIndex
                                    )}
                                >
                                    {item.title}
                                </Checkbox>
                            </Option>
                        );
                    })}
                </Select>
            </div>
        );
    };

    // modify the header according to which columns the user would like to see
    const header = modHeader(headerProp || []);

    return (
        <div>
            {allowCustomization && (
                <div style={{position: "relative"}}>
                    {renderEnabledColumnsSelector()}
                </div>
            )}
            <PaginatedList {...other} header={header} />
            {children}
        </div>
    );
}

function CustomTableContainer(props: CustomTableCoreProps) {
    const settingsState = useAltStore<any>(SettingsStore);
    const viewSettings = props.viewSettings || settingsState.viewSettings;
    return <CustomTable {...props} viewSettings={viewSettings} />;
}

export default CustomTableContainer;
