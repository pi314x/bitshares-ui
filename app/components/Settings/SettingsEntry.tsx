// TypeScript/functional-component port of the legacy SettingsEntry.jsx
// (renders one row of the Settings screen's generic tabs - locale, theme,
// browser notifications, fee asset, gateway filter, wallet lock timeout,
// and the generic dropdown/text-input fallback for everything else).
// Phase 2, docs/UI_MIGRATION_PLAN.md. Pure display/local-UI-state, no
// wallet or signing involvement.
//
// Confirmed dead, dropped (verified by reading this whole file plus every
// caller - only Settings.tsx renders this component):
// - `message` state, the `_setMessage(key)` method that set it, its
//   `timer`/`componentWillUnmount` cleanup, and the
//   `<div className="facolor-success">{this.state.message}</div>` that
//   displayed it. `_setMessage` was never called from anywhere in this
//   file or any caller (ResetSettings.jsx has its own, unrelated,
//   same-named method) - `message` was always `null`, so that div was
//   always empty.
// - `optional` and `confirmButton`, both declared but never assigned in
//   any switch branch, then rendered as `{optional}`/`{confirmButton}` -
//   always `undefined`, i.e. always rendered nothing.
// - `noHeader`, declared `false` and never reassigned by any switch
//   branch, so the local `EntryLayout` helper's `noHeader && children`
//   branch could never be taken - it always rendered the `FormItem`
//   wrapper. Inlined that unconditional path directly, no more `noHeader`.
//
// The legacy `shouldComponentUpdate` skipped re-rendering the
// "filteredServiceProviders" entry unless its own local modal-visibility
// state changed (a perf guard against re-rendering an expensive Select
// list on every unrelated `settings` change elsewhere on the page). Not
// replicated here, same tradeoff as the rest of this phase's ported
// components: that entry's output never actually depends on `settings` or
// `defaults` (it always renders the same button + optional modal), so the
// extra re-renders this port doesn't skip are output-invisible.
import * as React from "react";
import counterpart from "counterpart";
import Translate from "react-translate-component";
import AssetName from "../Utility/AssetName";
import Notify from "notifyjs";
import FeeAssetSettings from "./FeeAssetSettings";

import {Checkbox, Select, Input, Form, Button} from "bitshares-ui-style-guide";
import GatewaySelectorModal from "../Gateways/GatewaySelectorModal";

const FormItem = Form.Item;
const Option = Select.Option;

interface SettingsEntryProps {
    defaults: any;
    setting: string;
    settings: any;
    onChange: (setting: string, value: any) => void;
    onNotificationChange: (path: string, value: boolean) => void;
}

export default function SettingsEntry({
    defaults,
    setting,
    settings,
    onChange,
    onNotificationChange
}: SettingsEntryProps) {
    const [
        isGatewaySelectorModalVisible,
        setIsGatewaySelectorModalVisible
    ] = React.useState(false);
    const [
        isGatewaySelectorModalRendered,
        setIsGatewaySelectorModalRendered
    ] = React.useState(false);

    function hideGatewaySelectorModal() {
        setIsGatewaySelectorModalVisible(false);
    }

    function showGatewaySelectorModal() {
        setIsGatewaySelectorModalRendered(true);
        setIsGatewaySelectorModalVisible(true);
    }

    function handleNotificationChange(path: string) {
        return (evt: React.ChangeEvent<HTMLInputElement>) => {
            onNotificationChange(path, !!evt.target.checked);
        };
    }

    const selected = settings.get(setting);
    let options: any = null;
    let value: any;
    let input: any = null;
    let component: any = null;

    switch (setting) {
        case "locale":
            value = selected;
            options = defaults.map((entry: string) => {
                const translationKey = "languages." + entry;
                const optionValue = counterpart.translate(translationKey);

                return (
                    <Option key={entry} value={entry}>
                        {optionValue}
                    </Option>
                );
            });

            break;

        case "themes":
            value = selected;
            options = defaults.map((entry: string) => {
                const translationKey = "settings." + entry;
                const optionValue = counterpart.translate(translationKey);

                return (
                    <Option key={entry} value={entry}>
                        {optionValue}
                    </Option>
                );
            });

            break;

        case "browser_notifications":
            value = selected;

            component = (
                <div className="settings--notifications">
                    <div className="settings--notifications--group">
                        <div className="settings--notifications--item">
                            <Checkbox
                                id="browser_notifications.allow"
                                checked={!!value.allow}
                                onChange={handleNotificationChange("allow")}
                            >
                                {counterpart.translate(
                                    "settings.browser_notifications_allow"
                                )}
                            </Checkbox>
                        </div>
                        <div className="settings--notifications--group">
                            <div className="settings--notifications--item">
                                <Checkbox
                                    id="browser_notifications.additional.transferToMe"
                                    disabled={!value.allow}
                                    checked={
                                        !!value.additional.transferToMe
                                    }
                                    onChange={handleNotificationChange(
                                        "additional.transferToMe"
                                    )}
                                >
                                    {counterpart.translate(
                                        "settings.browser_notifications_additional_transfer_to_me"
                                    )}
                                </Checkbox>
                            </div>
                        </div>
                    </div>
                    {!!value.allow &&
                        Notify.needsPermission && (
                            <a
                                href="https://goo.gl/zZ7NHY"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="external-link"
                            >
                                <Translate
                                    component="div"
                                    className="settings--notifications--no-browser-support"
                                    content="settings.browser_notifications_disabled_by_browser_notify"
                                />
                            </a>
                        )}
                </div>
            );

            break;

        case "fee_asset":
            options = null;
            value = true;
            component = <FeeAssetSettings key="fee_asset_component" />;
            break;

        case "filteredServiceProviders":
            options = null;
            value = true;
            component = (
                <React.Fragment>
                    <Button onClick={showGatewaySelectorModal}>
                        Choose external Service Providers
                    </Button>
                    {isGatewaySelectorModalRendered && (
                        <GatewaySelectorModal
                            visible={isGatewaySelectorModalVisible}
                            hideModal={hideGatewaySelectorModal}
                        />
                    )}
                </React.Fragment>
            );
            break;

        case "defaultMarkets":
            options = null;
            value = null;
            break;

        case "walletLockTimeout":
            value = selected;
            input = (
                <Input
                    type="text"
                    className="settings--input"
                    value={selected}
                    onChange={(e: any) => onChange(setting, e)}
                />
            );
            break;

        default:
            if (typeof selected === "number") {
                value = defaults[selected];
            } else if (typeof selected === "boolean") {
                if (selected) {
                    value = defaults[0];
                } else {
                    value = defaults[1];
                }
            } else if (typeof selected === "string") {
                value = selected;
            }

            if (defaults) {
                options = defaults.map((entry: any) => {
                    let option: any = entry.translate
                        ? counterpart.translate(
                              `settings.${entry.translate}`
                          )
                        : entry;
                    if (setting === "unit" || setting === "fee_asset") {
                        option = <AssetName name={entry} />;
                    }
                    const key = entry.translate ? entry.translate : entry;
                    return (
                        <Option
                            value={
                                entry.translate ? entry.translate : entry
                            }
                            key={key}
                        >
                            {option}
                        </Option>
                    );
                });
            } else {
                input = (
                    <input
                        className="settings-input"
                        type="text"
                        defaultValue={value}
                        onBlur={(e: any) => onChange(setting, e)}
                    />
                );
            }
            break;
    }
    if (typeof value !== "number" && !value && !options) return null;

    if (value && value.translate) {
        value = value.translate;
    }

    return (
        <section className="no-border-bottom">
            <FormItem label={counterpart.translate(`settings.${setting}`)}>
                {options ? (
                    <ul className={"unstyled-list"}>
                        <li className="with-dropdown">
                            <Select
                                value={value}
                                className="settings--select"
                                onChange={(v: any) => onChange(setting, v)}
                            >
                                {options}
                            </Select>
                        </li>
                    </ul>
                ) : null}
                {input ? (
                    <ul className={"unstyled-list"}>
                        <li>{input}</li>
                    </ul>
                ) : null}

                {component ? component : null}
            </FormItem>
        </section>
    );
}
