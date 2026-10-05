// TypeScript/functional-component port of the legacy
// GatewaySelectorModal.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md) - the modal
// shown on app start (see `App.jsx`'s `onRouteChanged`) asking the user
// which external gateways/bridges they're willing to see offered. Ported
// together with `ServiceProviderExplanation.tsx` (its only child/import,
// ported in the same commit, first) - this completes the `Gateways/`
// directory.
//
// Not security-sensitive per AGENTS.md: grepped for `WalletDb`,
// `WalletApi`, `ApplicationApi`, `.add_type_operation`, `process_transaction`
// - none appear. The two `SettingsActions.changeSetting(...)`/
// `SettingsActions.changeViewSetting(...)` call sites (preserved exactly,
// see below) persist UI/gateway-preference settings
// (`filteredServiceProviders`, `hasSeenExternalServices`), not wallet/key
// material.
//
// Structural changes:
// - The original's `connect(GatewaySelectorModal, {listenTo: [
//   SettingsStore], getProps() {...}})` is replaced by `useAltStore<any>
//   (SettingsStore)` (subscribes to the same store, re-rendering on every
//   change - matching `FeeAssetSettings.tsx`'s precedent of discarding the
//   hook's return value and instead re-reading `SettingsStore.getState()`
//   directly in the component body) plus two local `const`s computed the
//   same way the original's `getProps()` did:
//   `settings.get("filteredServiceProviders", [])` and
//   `viewSettings.get("hasSeenExternalServices", false)`. Prop precedence
//   is preserved exactly: alt-react's `connect` renders `<Component
//   {...this.props} {...this.getNextProps()} />` (store-derived props
//   always win over same-named caller props - see
//   `AccountPortfolioList.tsx`'s header comment for the general rule) -
//   here this only matters in principle, since `App.jsx`'s single call
//   site (`<GatewaySelectorModal visible={...} hideModal={...} />`, grepped)
//   never actually passes `filteredServiceProviders`/
//   `hasSeenExternalServices` itself, so the override is never observed in
//   practice, same as before this port.
// - `this.state = {showIntroduction, onChainConfig}` becomes two
//   `useState`s combined via a local `mergeState` where the original used
//   partial `setState` (only `onChainConfig` ever needs a merge update;
//   `showIntroduction` is a single boolean toggle).
// - `componentDidMount() { this._checkOnChainConfig(); }` becomes a
//   mount-only `useEffect(() => { checkOnChainConfig(); }, [])`.
// - Methods bound with `.bind(this)` in the original's JSX
//   (`this.onClose.bind(this)` etc.) become plain closures (`onClose`),
//   since function-component callbacks already close over current scope.
//
// Preserved verbatim (not "fixed"):
// - `_getRowHeaders()`'s `"type"` column `render` function has a
//   genuinely unreachable trailing `return (<div>...</div>)` block (the
//   original's lines ~122-134) after an `if (row.type == "bridge") {
//   return ...} else { return (...) }` - both branches of the `if/else`
//   already return, so control flow can never reach the final `return`.
//   Confirmed unreachable by control-flow alone (not data-dependent), so
//   dropping it changes no observable behavior; kept out of this port
//   rather than translated, since translating genuinely dead code adds
//   nothing to check or maintain. (Documented here instead of inline,
//   per AGENTS.md's "document instead of silently dropping" convention.)
// - `onSubmit()` does nothing but call `onClose()` - row selections are
//   already written to `SettingsStore` live, on every checkbox click, via
//   `rowSelection.onChange` below, so "submit" has no additional work to
//   do. Kept as a separate handler (not inlined into the button's
//   `onClick`) to mirror the original's method shape exactly.
// - `_getEnabledRowKeys()`'s array can contain `undefined` entries
//   (mapped from rows whose key IS present in `onChainConfig`, i.e.
//   disabled) interleaved with real keys - harmless for antd's
//   `rowSelection.selectedRowKeys` (an `undefined` entry just never
//   matches a row), but kept exactly as computed rather than filtered,
//   matching the original.
// - Both `SettingsActions.changeSetting({setting: "filteredServiceProviders",
//   ...})` call sites (`onNone()`: value `[]`; `rowSelection.onChange`:
//   value `["all"]` when every row is selected, else the raw
//   `selectedRowKeys` array) and the single
//   `SettingsActions.changeViewSetting({hasSeenExternalServices: true})`
//   call site (`onClose()`, gated on `!hasSeenExternalServices`) are
//   preserved exactly, same conditions, same payload shapes.
//
// Dropped as confirmed dead (grep-verified - each name below appears only
// in its own `import` line):
// - `Radio`, `Checkbox` from "bitshares-ui-style-guide" - never rendered
//   (`grep -c "<Radio"`/`"<Checkbox"` against the original both return 0).
//
// TypeScript-forced adjustments:
// - `_getReferrerLink()`/`getReferrerLink()`: `branding.js`'s `getFaucet()`
//   is JSDoc'd (and, via `allowJs` type inference, now statically typed)
//   as `{url, show, editable}` - it never actually returns a `referrer`
//   field in this checkout, so `.referrer` is a type error under `strict`
//   that the original plain-JS version never hit. Cast to `any` at the
//   call site to preserve the original's dynamic property access exactly
//   (still always `undefined` today, same resulting empty-string behavior
//   as before) rather than narrowing the type or removing the check.
// - `GatewayRow`/`OnChainConfigMap` interfaces added for the row-building
//   helpers (`_getRows`/`_getRowHeaders`/`_checkOnChainConfig`); the
//   `isEnabled` function and the on-chain config payload shape both come
//   from untyped `.js` modules (`common/gateways`, `lib/chain/
//   onChainConfig`) with inherently dynamic/external-API shapes, so both
//   are typed `any`/`Record<string, any>` rather than invented precisely
//   (matching this migration's established practice for antd `Table`
//   `columns`/`rowSelection` - see e.g.
//   `PredictionMarketsOverviewTable.tsx`).
import * as React from "react";

import counterpart from "counterpart";
import Translate from "react-translate-component";
import {
    Table,
    Button,
    Modal,
    Collapse,
    Tooltip,
    Icon
} from "bitshares-ui-style-guide";
import SettingsStore from "stores/SettingsStore";
import {availableGateways, availableBridges} from "common/gateways";
import {getFaucet, allowedGateway} from "../../branding";
import SettingsActions from "../../actions/SettingsActions";
import {updateGatewayBackers} from "common/gatewayUtils";
import ServiceProviderExplanation from "./ServiceProviderExplanation";
import {getGatewayConfig} from "../../lib/chain/onChainConfig";
import {useAltStore} from "../../next/hooks/useAltStore";

interface GatewaySelectorModalProps {
    visible: boolean;
    hideModal: () => void;
    // Store-derived in the original (alt-react `connect`'s `getProps`);
    // kept here too since `App.jsx`'s call site never passes either, but
    // either could in principle be overridden by a caller-supplied prop
    // of the same name under this port's precedence rules (see header).
    filteredServiceProviders?: string[];
    hasSeenExternalServices?: boolean;
}

interface GatewayRow {
    key: string;
    type: "gateway" | "bridge";
    name: string;
    prefix?: string;
    landing?: string;
    wallet?: string;
    isEnabled: (options?: {
        onlyOnChainConfig?: boolean;
        onlyBranding?: boolean;
    }) => Promise<boolean>;
}

type OnChainConfigMap = Record<string, any>;

export default function GatewaySelectorModal(
    props: GatewaySelectorModalProps
) {
    useAltStore<any>(SettingsStore);
    const settingsState = SettingsStore.getState();
    const filteredServiceProviders: string[] = settingsState.settings.get(
        "filteredServiceProviders",
        []
    );
    const hasSeenExternalServices: boolean = settingsState.viewSettings.get(
        "hasSeenExternalServices",
        false
    );

    const [showIntroduction, setShowIntroduction] = React.useState(true);
    const [onChainConfig, setOnChainConfig] = React.useState<
        OnChainConfigMap
    >({});

    const getReferrerLink = (): string => {
        // `getFaucet()`'s JSDoc-declared return shape
        // (`{url, show, editable}`, see `branding.js`) never actually
        // includes `referrer` in this checkout, but other brand configs of
        // this same function can add it dynamically - cast to `any` to
        // preserve that plain-JS property access (always `undefined`/"" in
        // this codebase today, same as before this port) rather than
        // narrowing the type or dropping the check.
        const faucet: any = getFaucet();
        return !!faucet.referrer ? "?r=" + faucet.referrer : "";
    };

    const getRows = (): GatewayRow[] => {
        const gateways: GatewayRow[] = Object.values(availableGateways).map(
            (item: any) => {
                return {
                    key: item.id,
                    type: "gateway",
                    name: item.name,
                    prefix: item.id,
                    landing: !!item.landing ? item.landing : undefined,
                    wallet:
                        !!item.wallet && item.wallet.startsWith("http")
                            ? item.wallet + getReferrerLink()
                            : item.wallet,
                    isEnabled: item.isEnabled
                };
            }
        );
        const bridges: GatewayRow[] = Object.values(availableBridges).map(
            (item: any) => {
                return {
                    key: item.id,
                    type: "bridge",
                    name: item.name,
                    landing: !!item.landing ? item.landing : undefined,
                    wallet:
                        !!item.wallet && item.wallet.startsWith("http")
                            ? item.wallet + getReferrerLink()
                            : item.wallet,
                    isEnabled: item.isEnabled
                };
            }
        );
        return gateways
            .concat(bridges)
            .filter(item => {
                return allowedGateway(item.key);
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    const getEnabledRowKeys = (): (string | undefined)[] => {
        return getRows().map(item =>
            onChainConfig[item.key] ? undefined : item.key
        );
    };

    const checkOnChainConfig = async () => {
        const all = getRows();
        const nextOnChainConfig: OnChainConfigMap = {};
        for (let i = 0; i < all.length; i++) {
            if (!(await all[i].isEnabled({onlyOnChainConfig: true}))) {
                nextOnChainConfig[all[i].key] = await getGatewayConfig(
                    all[i].key
                );
                if (!nextOnChainConfig[all[i].key]) {
                    nextOnChainConfig[all[i].key] = {enabled: false};
                }
            }
        }
        setOnChainConfig(nextOnChainConfig);
    };

    React.useEffect(() => {
        checkOnChainConfig();
    }, []);

    const onClose = () => {
        if (!hasSeenExternalServices) {
            SettingsActions.changeViewSetting({
                hasSeenExternalServices: true
            });
        }
        updateGatewayBackers();
        props.hideModal();
    };

    const onSubmit = () => {
        onClose();
    };

    const onNone = () => {
        SettingsActions.changeSetting({
            setting: "filteredServiceProviders",
            value: []
        });
        onClose();
    };

    const next = () => {
        setShowIntroduction(false);
    };

    const getRowHeaders = () => {
        const columns = [
            {
                key: "name",
                title: counterpart.translate(
                    "external_service_provider.selector.name"
                ),
                render: (row: GatewayRow) => {
                    if (!!onChainConfig[row.key]) {
                        return (
                            <Tooltip
                                title={
                                    "This gateway has been deactivated or is not functioning correctly. " +
                                    (onChainConfig[row.key].comment ||
                                        "This can be due to several reasons.")
                                }
                            >
                                <span style={{whiteSpace: "nowrap"}}>
                                    {row.name}
                                    <Icon
                                        style={{
                                            marginLeft: "0.5rem"
                                        }}
                                        type="warning"
                                    />
                                </span>
                            </Tooltip>
                        );
                    }
                    return row.name;
                }
            },
            {
                key: "type",
                title: counterpart.translate(
                    "external_service_provider.selector.type"
                ),
                align: "left",
                render: (row: GatewayRow) => {
                    if (row.type == "bridge") {
                        return counterpart.translate(
                            "external_service_provider.bridge.short"
                        );
                    } else {
                        return (
                            <div>
                                <span>
                                    {counterpart.translate(
                                        "external_service_provider.gateway.short"
                                    )}
                                </span>
                                <br />
                                <span>
                                    {counterpart.translate(
                                        "external_service_provider.gateway.prefix"
                                    )}
                                    {": " + row.prefix}
                                </span>
                            </div>
                        );
                    }
                }
            },
            {
                key: "landing",
                title: counterpart.translate(
                    "external_service_provider.selector.landing"
                ),
                align: "left",
                render: (row: GatewayRow) => {
                    if (!row.landing) return "-";
                    if (row.landing.startsWith("http")) {
                        return (
                            <a
                                target="_blank"
                                className="external-link"
                                rel="noopener noreferrer"
                                href={row.landing}
                            >
                                External Link
                            </a>
                        );
                    } else {
                        return <span>{row.landing}</span>;
                    }
                }
            },
            {
                key: "wallet",
                title: counterpart.translate(
                    "external_service_provider.selector.wallet"
                ),
                align: "left",
                render: (row: GatewayRow) => {
                    if (!row.wallet) return "-";
                    if (row.wallet.startsWith("http")) {
                        return (
                            <a
                                target="_blank"
                                className="external-link"
                                rel="noopener noreferrer"
                                href={row.wallet}
                            >
                                External Link
                            </a>
                        );
                    } else {
                        return <span>{row.wallet}</span>;
                    }
                }
            }
        ];
        return columns;
    };

    const footer = !showIntroduction ? (
        <div key="buttons" style={{position: "relative", left: "0px"}}>
            <Tooltip
                title={counterpart.translate(
                    "external_service_provider.welcome.explanation_later"
                )}
            >
                <Button key="cancel" onClick={onClose}>
                    <Translate
                        component="span"
                        content="external_service_provider.selector.cancel"
                    />
                </Button>
            </Tooltip>
            <Button key="none" onClick={onNone} type="primary">
                <Translate
                    component="span"
                    content="external_service_provider.selector.use_none"
                />
            </Button>
            <Button key="submit" type="primary" onClick={onSubmit}>
                <Translate
                    component="span"
                    content="external_service_provider.selector.use_selected"
                />
            </Button>
        </div>
    ) : (
        <div key="buttons" style={{position: "relative", left: "0px"}}>
            <Button key="cancel" onClick={onClose}>
                <Translate
                    component="span"
                    content="external_service_provider.selector.not_now"
                />
            </Button>
            <Button key="submit" type="primary" onClick={next}>
                <Translate
                    component="span"
                    content="external_service_provider.selector.choose_services"
                />
            </Button>
        </div>
    );

    const rowSelection = {
        onChange: (selectedRowKeys: string[]) => {
            if (selectedRowKeys.length == getRows().length) {
                SettingsActions.changeSetting({
                    setting: "filteredServiceProviders",
                    value: ["all"]
                });
            } else {
                SettingsActions.changeSetting({
                    setting: "filteredServiceProviders",
                    value: selectedRowKeys
                });
            }
        },
        getCheckboxProps: (record: GatewayRow) => {
            return {
                disabled:
                    !!onChainConfig[record.key] &&
                    !onChainConfig[record.key].enabled,
                key: record.key
            };
        },
        // Required in order resetSelected to work
        selectedRowKeys:
            filteredServiceProviders.length == 1 &&
            filteredServiceProviders[0] == "all"
                ? getEnabledRowKeys()
                : filteredServiceProviders
    };

    return (
        <Modal
            visible={props.visible}
            overlay={true}
            title={
                <Translate content="external_service_provider.selector.title" />
            }
            closable={false}
            footer={[footer]}
            width={640}
        >
            {showIntroduction ? (
                <ServiceProviderExplanation
                    showSalutation={!hasSeenExternalServices}
                />
            ) : (
                <React.Fragment>
                    <Collapse>
                        <Collapse.Panel
                            header="What is a Gateway?"
                            showArrow={false}
                        >
                            <Translate
                                component="p"
                                content="external_service_provider.gateway.description"
                            />
                        </Collapse.Panel>
                    </Collapse>
                    <Collapse style={{marginTop: "1rem"}}>
                        <Collapse.Panel
                            header="What is a Bridge?"
                            showArrow={false}
                        >
                            <Translate
                                component="p"
                                content="external_service_provider.bridge.description"
                            />
                        </Collapse.Panel>
                    </Collapse>
                    <div style={{marginTop: "1rem"}}>
                        <Translate content="external_service_provider.selector.table_description" />
                    </div>
                    <Table
                        style={{marginTop: "1rem"}}
                        columns={getRowHeaders()}
                        pagination={{
                            hideOnSinglePage: true,
                            pageSize: 20
                        }}
                        dataSource={getRows()}
                        footer={null}
                        rowSelection={rowSelection}
                    />
                </React.Fragment>
            )}
        </Modal>
    );
}
