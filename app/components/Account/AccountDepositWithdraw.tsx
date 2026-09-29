// TypeScript/functional-component port of the legacy
// AccountDepositWithdraw.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes. Renders several still-`.jsx` gateway
// bridge components (OpenledgerGateway, RuDexGateway, BitsparkGateway,
// PiratecashGateway, XbtsxGateway, BlockTradesBridgeDepositRequest,
// CitadelBridgeDepositRequest, GdexGateway) unchanged, as-is - those
// gateway directories are out of scope for this migration (see
// AGENTS.md), but this file itself lives under `Account/`, so it is
// in scope.
//
// Structural change (not a behavior change): the original's
// `connect(DepositStoreWrapper, {listenTo: [AccountStore, SettingsStore,
// GatewayStore], getProps})` (outer) wrapping `BindToChainState(
// AccountDepositWithdraw)` (required `account`) wrapping
// `DepositStoreWrapper`'s own `UNSAFE_componentWillMount` (calling
// `updateGatewayBackers()`) collapse into a single Container: three
// `useAltStore` calls (one per store - the established multi-store
// pattern), a mount-only `useEffect` for `updateGatewayBackers()`, and
// chain resolution of `account` (required, so gated on the default
// blank `<span />` fallback, matching `BindToChainState`'s own
// unadorned default since no `tempComponent`/`show_loader` option was
// passed).
//
// `shouldComponentUpdate` (a large multi-field shallow-equality gate
// across both props and state) has no hooks equivalent and is dropped.
// `UNSAFE_componentWillMount` (`accountUtils.getFinalFeeAsset(account,
// "transfer")`) becomes a mount-only `useEffect`.
//
// Dropped as confirmed dead (found while porting): `state.metaService`
// and `toggleMetaService` - `toggleMetaService` is never wired to any
// element anywhere in `render()`, and `metaService` itself is only ever
// read inside the now-dropped `shouldComponentUpdate`.
//
// Refs: `ref="deposit_modal"` (`this.refs.deposit_modal.show()`) is
// real and load-bearing - `DepositModal` (`Modal/DepositModal.jsx`) is
// still a class component with its own `.show()` method - translated to
// a `useRef()` object ref. `ref="withdraw_modal"`
// (`this.refs.withdraw_modal.show()`), by contrast, is **already dead
// in production** as of an earlier, unrelated port: `WithdrawModalNew
// .tsx` (already `.tsx`, verified directly) was converted to a plain
// function component with no `forwardRef`/`useImperativeHandle` and no
// `.show()` method at all - it's now controlled entirely via its
// `visible` prop instead. Passing a ref to a plain function component is
// a no-op in React (with a dev-mode console warning), so
// `this.refs.withdraw_modal` was already always falsy before this port,
// meaning the "Submit" link's `onClick` already silently did nothing.
// This port preserves that exact (pre-existing, not introduced by this
// migration) breakage rather than wiring up the "correct" `visible`-prop
// control flow as an unrelated fix.
import * as React from "react";
import accountUtils from "common/account_utils";
import {updateGatewayBackers} from "common/gatewayUtils";
import Translate from "react-translate-component";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {useAltStore} from "../../next/hooks/useAltStore";
import OpenledgerGateway from "../DepositWithdraw/OpenledgerGateway";
import OpenLedgerFiatDepositWithdrawal from "../DepositWithdraw/openledger/OpenLedgerFiatDepositWithdrawal";
import OpenLedgerFiatTransactionHistory from "../DepositWithdraw/openledger/OpenLedgerFiatTransactionHistory";
import BlockTradesBridgeDepositRequest from "../DepositWithdraw/blocktrades/BlockTradesBridgeDepositRequest";
import CitadelBridgeDepositRequest from "../DepositWithdraw/citadel/CitadelBridgeDepositRequest";
import HelpContent from "../Utility/HelpContent";
import AccountStore from "stores/AccountStore";
import SettingsStore from "stores/SettingsStore";
import SettingsActions from "actions/SettingsActions";
import {openledgerAPIs} from "api/apiConfig";
import RuDexGateway from "../DepositWithdraw/rudex/RuDexGateway";
import GatewayStore from "stores/GatewayStore";
import AccountImage from "../Account/AccountImage";
import BitsparkGateway from "../DepositWithdraw/bitspark/BitsparkGateway";
import GdexGateway from "../DepositWithdraw/gdex/GdexGateway";
import PiratecashGateway from "../DepositWithdraw/piratecash/PiratecashGateway";
import XbtsFiat from "../DepositWithdraw/XbtsFiat";
import XbtsxGateway from "../DepositWithdraw/xbtsx/XbtsxGateway";
import DepositModal from "../Modal/DepositModal";
import WithdrawModal from "../Modal/WithdrawModalNew";

// `WithdrawModal` is a plain function component (see header comment
// above) - cast to `any` so the dead `ref` prop below can still be
// passed without a TS error, preserving the exact (already broken at
// runtime) original call shape rather than dropping the ref.
const WithdrawModalAny = WithdrawModal as any;
import TranslateWithLinks from "../Utility/TranslateWithLinks";

interface AccountDepositWithdrawState {
    olService: any;
    rudexService: any;
    bitsparkService: any;
    piratecashService: any;
    xbtsxService: any;
    btService: any;
    citadelService: any;
    activeService: any;
}

interface AccountDepositWithdrawCoreProps {
    account: any;
    contained?: boolean;
    servicesDown: any;
    openLedgerBackedCoins: any;
    rudexBackedCoins: any;
    bitsparkBackedCoins: any;
    piratecashBackedCoins: any;
    xbtsxBackedCoins: any;
    blockTradesBackedCoins: any;
    citadelBackedCoins: any;
    viewSettings: any;
    currentAccount: any;
    backedCoins: any;
    location?: any;
}

function AccountDepositWithdraw({
    account,
    contained = false,
    servicesDown,
    openLedgerBackedCoins,
    rudexBackedCoins,
    bitsparkBackedCoins,
    piratecashBackedCoins,
    xbtsxBackedCoins,
    viewSettings,
    currentAccount,
    backedCoins,
    location
}: AccountDepositWithdrawCoreProps) {
    const [state, setState] = React.useState<AccountDepositWithdrawState>(
        () => ({
            olService: viewSettings.get("olService", "gateway"),
            rudexService: viewSettings.get("rudexService", "gateway"),
            bitsparkService: viewSettings.get("bitsparkService", "gateway"),
            piratecashService: viewSettings.get(
                "piratecashService",
                "gateway"
            ),
            xbtsxService: viewSettings.get("xbtsxService", "gateway"),
            btService: viewSettings.get("btService", "bridge"),
            citadelService: viewSettings.get("citadelService", "bridge"),
            activeService: viewSettings.get("activeService", 0)
        })
    );

    const mergeState = (partial: Partial<AccountDepositWithdrawState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const depositModalRef = React.useRef<any>(null);
    const withdrawModalRef = React.useRef<any>(null);

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            (accountUtils as any).getFinalFeeAsset(account, "transfer");
        }
    }, []);

    const toggleOLService = (service: any) => {
        mergeState({olService: service});
        (SettingsActions as any).changeViewSetting({olService: service});
    };

    const toggleRuDEXService = (service: any) => {
        mergeState({rudexService: service});
        (SettingsActions as any).changeViewSetting({rudexService: service});
    };

    const togglePiratecashService = (service: any) => {
        mergeState({piratecashService: service});
        (SettingsActions as any).changeViewSetting({
            piratecashService: service
        });
    };

    const toggleXbtsxService = (service: any) => {
        mergeState({xbtsxService: service});
        (SettingsActions as any).changeViewSetting({xbtsxService: service});
    };

    const toggleBitSparkService = (service: any) => {
        mergeState({bitsparkService: service});
        (SettingsActions as any).changeViewSetting({
            bitsparkService: service
        });
    };

    const toggleBTService = (service: any) => {
        mergeState({btService: service});
        (SettingsActions as any).changeViewSetting({btService: service});
    };

    const toggleCitadelService = (service: any) => {
        mergeState({citadelService: service});
        (SettingsActions as any).changeViewSetting({citadelService: service});
    };

    const onSetService = (e: any) => {
        mergeState({activeService: parseInt(e.target.value)});
        (SettingsActions as any).changeViewSetting({
            activeService: parseInt(e.target.value)
        });
    };

    const renderServices = (
        openLedgerGatewayCoins: any,
        rudexGatewayCoins: any,
        bitsparkGatewayCoins: any,
        piratecashGatewayCoins: any,
        xbtsxGatewayCoins: any
    ) => {
        const serList: any[] = [];
        const {
            olService,
            btService,
            rudexService,
            bitsparkService,
            piratecashService,
            xbtsxService,
            citadelService
        } = state;
        serList.push({
            name: "Openledger (OPEN.X)",
            identifier: "OPEN",
            template: (
                <div className="content-block">
                    <div
                        className="service-selector"
                        style={{marginBottom: "2rem"}}
                    >
                        <ul className="button-group segmented no-margin">
                            <li
                                onClick={() => toggleOLService("gateway")}
                                className={
                                    olService === "gateway" ? "is-active" : ""
                                }
                            >
                                <a>
                                    <Translate content="gateway.gateway" />
                                </a>
                            </li>
                            <li
                                onClick={() => toggleOLService("fiat")}
                                className={
                                    olService === "fiat" ? "is-active" : ""
                                }
                            >
                                <Translate
                                    component="a"
                                    content="gateway.fiat"
                                />
                            </li>
                        </ul>
                    </div>

                    {olService === "gateway" &&
                    openLedgerGatewayCoins.length ? (
                        <OpenledgerGateway
                            account={account}
                            coins={openLedgerGatewayCoins}
                            provider="openledger"
                        />
                    ) : null}

                    {olService === "fiat" ? (
                        <div>
                            <div style={{paddingBottom: 15}}>
                                <Translate
                                    component="h5"
                                    content="gateway.fiat_text"
                                    unsafe
                                />
                            </div>

                            <OpenLedgerFiatDepositWithdrawal
                                rpc_url={(openledgerAPIs as any).RPC_URL}
                                account={account}
                                issuer_account="openledger-fiat"
                            />
                            <OpenLedgerFiatTransactionHistory
                                rpc_url={(openledgerAPIs as any).RPC_URL}
                                account={account}
                            />
                        </div>
                    ) : null}
                </div>
            )
        });

        serList.push({
            name: "RuDEX (RUDEX.X)",
            identifier: "RUDEX",
            template: (
                <div className="content-block">
                    <div
                        className="service-selector"
                        style={{marginBottom: "2rem"}}
                    >
                        <ul className="button-group segmented no-margin">
                            <li
                                onClick={() => toggleRuDEXService("gateway")}
                                className={
                                    rudexService === "gateway"
                                        ? "is-active"
                                        : ""
                                }
                            >
                                <a>
                                    <Translate content="gateway.gateway" />
                                </a>
                            </li>
                            <li
                                onClick={() => toggleRuDEXService("fiat")}
                                className={
                                    rudexService === "fiat" ? "is-active" : ""
                                }
                            >
                                <a>Fiat</a>
                            </li>
                        </ul>
                    </div>

                    {rudexService === "gateway" && rudexGatewayCoins.length ? (
                        <RuDexGateway
                            account={account}
                            coins={rudexGatewayCoins}
                        />
                    ) : null}

                    {rudexService === "fiat" ? (
                        <div>
                            <Translate content="gateway.rudex.coming_soon" />
                        </div>
                    ) : null}
                </div>
            )
        });

        serList.push({
            name: "BitSpark (SPARKDEX.X)",
            identifier: "SPARKDEX",
            template: (
                <div className="content-block">
                    <div
                        className="service-selector"
                        style={{marginBottom: "2rem"}}
                    >
                        <ul className="button-group segmented no-margin">
                            <li
                                onClick={() =>
                                    toggleBitSparkService("gateway")
                                }
                                className={
                                    bitsparkService === "gateway"
                                        ? "is-active"
                                        : ""
                                }
                            >
                                <a>
                                    <Translate content="gateway.gateway" />
                                </a>
                            </li>
                        </ul>
                    </div>

                    {bitsparkService === "gateway" &&
                    bitsparkGatewayCoins.length ? (
                        <BitsparkGateway
                            account={account}
                            coins={bitsparkGatewayCoins}
                            provider="bitspark"
                        />
                    ) : null}
                </div>
            )
        });

        serList.push({
            name: "Pirate DEX",
            identifier: "PIRATE",
            template: (
                <div className="content-block">
                    <div
                        className="service-selector"
                        style={{marginBottom: "2rem"}}
                    >
                        <ul className="button-group segmented no-margin">
                            <li
                                onClick={() =>
                                    togglePiratecashService("gateway")
                                }
                                className={
                                    piratecashService === "gateway"
                                        ? "is-active"
                                        : ""
                                }
                            >
                                <a>
                                    <Translate content="gateway.gateway" />
                                </a>
                            </li>
                        </ul>
                    </div>

                    {piratecashService === "gateway" &&
                    piratecashGatewayCoins.length ? (
                        <PiratecashGateway
                            account={account}
                            coins={piratecashGatewayCoins}
                        />
                    ) : null}
                </div>
            )
        });

        serList.push({
            name: "XBTS Native Chains",
            identifier: "XBTSX",
            template: (
                <div className="content-block">
                    <div
                        className="service-selector"
                        style={{marginBottom: "2rem"}}
                    >
                        <ul className="button-group segmented no-margin">
                            <li
                                onClick={() =>
                                    toggleXbtsxService("gateway")
                                }
                                className={
                                    xbtsxService === "gateway"
                                        ? "is-active"
                                        : ""
                                }
                            >
                                <a>
                                    <Translate content="gateway.gateway" />
                                </a>
                            </li>
                            <li
                                onClick={() => toggleXbtsxService("fiat")}
                                className={
                                    xbtsxService === "fiat" ? "is-active" : ""
                                }
                            >
                                <a>Fiat</a>
                            </li>
                        </ul>
                    </div>

                    {xbtsxService === "gateway" && xbtsxGatewayCoins.length ? (
                        <XbtsxGateway
                            account={account}
                            coins={xbtsxGatewayCoins}
                        />
                    ) : null}

                    {xbtsxService === "fiat" ? (
                        <XbtsFiat
                            viewSettings={viewSettings}
                            account={account}
                        />
                    ) : null}
                </div>
            )
        });

        serList.push({
            name: "BlockTrades",
            identifier: "TRADE",
            template: (
                <div>
                    <div className="content-block">
                        <div
                            className="service-selector"
                            style={{marginBottom: "2rem"}}
                        >
                            <ul className="button-group segmented no-margin">
                                <li
                                    onClick={() =>
                                        toggleBTService("bridge")
                                    }
                                    className={
                                        btService === "bridge"
                                            ? "is-active"
                                            : ""
                                    }
                                >
                                    <a>
                                        <Translate content="gateway.bridge" />
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <BlockTradesBridgeDepositRequest
                            gateway="blocktrades"
                            issuer_account="blocktrades"
                            account={account}
                            initial_deposit_input_coin_type="btc"
                            initial_deposit_output_coin_type="bts"
                            initial_deposit_estimated_input_amount="1.0"
                            initial_withdraw_input_coin_type="bts"
                            initial_withdraw_output_coin_type="btc"
                            initial_withdraw_estimated_input_amount="100000"
                            initial_conversion_input_coin_type="bts"
                            initial_conversion_output_coin_type="bitbtc"
                            initial_conversion_estimated_input_amount="1000"
                            params={location}
                        />
                    </div>
                    <div className="content-block" />
                </div>
            )
        });

        serList.push({
            name: "Citadel",
            identifier: "CITADEL",
            template: (
                <div>
                    <div className="content-block">
                        <div
                            className="service-selector"
                            style={{marginBottom: "2rem"}}
                        >
                            <ul className="button-group segmented no-margin">
                                <li
                                    onClick={() =>
                                        toggleCitadelService("bridge")
                                    }
                                    className={
                                        citadelService === "bridge"
                                            ? "is-active"
                                            : ""
                                    }
                                >
                                    <a>
                                        <Translate content="gateway.bridge" />
                                    </a>
                                </li>
                            </ul>
                        </div>
                        <CitadelBridgeDepositRequest
                            gateway="citadel"
                            issuer_account="citadel-wallet"
                            account={account}
                            initial_deposit_input_coin_type="xmr"
                            initial_deposit_output_coin_type="citadel.monero"
                            initial_deposit_estimated_input_amount="1.0"
                            initial_withdraw_input_coin_type="citadel.monero"
                            initial_withdraw_output_coin_type="xmr"
                            initial_withdraw_estimated_input_amount="1.0"
                        />
                    </div>
                    <div className="content-block" />
                </div>
            )
        });

        serList.push({
            name: "GDEX",
            identifier: "GDEX",
            template: (
                <div>
                    <GdexGateway account={account} provider={"gdex"} />
                </div>
            )
        });

        return serList;
    };

    const {activeService} = state;

    const openLedgerGatewayCoins = openLedgerBackedCoins
        .map((coin: any) => {
            return coin;
        })
        .sort((a: any, b: any) => {
            if (a.symbol < b.symbol) return -1;
            if (a.symbol > b.symbol) return 1;
            return 0;
        });

    const rudexGatewayCoins = rudexBackedCoins
        .map((coin: any) => {
            return coin;
        })
        .sort((a: any, b: any) => {
            if (a.symbol < b.symbol) return -1;
            if (a.symbol > b.symbol) return 1;
            return 0;
        });

    const bitsparkGatewayCoins = bitsparkBackedCoins
        .map((coin: any) => {
            return coin;
        })
        .sort((a: any, b: any) => {
            if (a.symbol < b.symbol) return -1;
            if (a.symbol > b.symbol) return 1;
            return 0;
        });

    const piratecashGatewayCoins = piratecashBackedCoins
        .map((coin: any) => {
            return coin;
        })
        .sort((a: any, b: any) => {
            if (a.symbol < b.symbol) return -1;
            if (a.symbol > b.symbol) return 1;
            return 0;
        });

    const xbtsxGatewayCoins = xbtsxBackedCoins
        .map((coin: any) => {
            return coin;
        })
        .sort((a: any, b: any) => {
            if (a.symbol < b.symbol) return -1;
            if (a.symbol > b.symbol) return 1;
            return 0;
        });

    const services = renderServices(
        openLedgerGatewayCoins,
        rudexGatewayCoins,
        bitsparkGatewayCoins,
        piratecashGatewayCoins,
        xbtsxGatewayCoins
    );

    const serviceNames: any[] = [];
    const options = services.map((services_obj, index) => {
        serviceNames.push(services_obj.identifier);
        return (
            <option key={index} value={index}>
                {services_obj.name}
            </option>
        );
    });

    const currentServiceName = serviceNames[activeService];
    const currentServiceDown = servicesDown.get(currentServiceName);

    return (
        <div className={contained ? "grid-content" : "grid-container"}>
            <div
                className={contained ? "" : "grid-content"}
                style={{paddingTop: "2rem"}}
            >
                <div className="grid-block vertical medium-horizontal no-margin no-padding">
                    <div style={{paddingBottom: "1rem"}}>
                        <DepositModal
                            ref={depositModalRef}
                            modalId="deposit_modal_new"
                            account={currentAccount}
                            backedCoins={backedCoins}
                        />
                        <WithdrawModalAny
                            ref={withdrawModalRef}
                            modalId="withdraw_modal_new"
                            backedCoins={backedCoins}
                        />
                        <TranslateWithLinks
                            string="gateway.phase_out_warning"
                            keys={[
                                {
                                    arg: "deposit_modal_link",
                                    value: (
                                        <a
                                            onClick={() => {
                                                if (depositModalRef.current)
                                                    depositModalRef.current.show();
                                            }}
                                        >
                                            <Translate content="modal.deposit.submit" />
                                        </a>
                                    )
                                },
                                {
                                    arg: "withdraw_modal_link",
                                    value: (
                                        <a
                                            onClick={() => {
                                                if (withdrawModalRef.current)
                                                    withdrawModalRef.current.show();
                                            }}
                                        >
                                            <Translate content="modal.withdraw.submit" />
                                        </a>
                                    )
                                }
                            ]}
                        />
                    </div>
                </div>
                <Translate content="gateway.title" component="h2" />
                <div className="grid-block vertical medium-horizontal no-margin no-padding">
                    <div className="medium-6 show-for-medium">
                        <HelpContent
                            path="components/DepositWithdraw"
                            section="deposit-short"
                        />
                    </div>
                    <div className="medium-5 medium-offset-1">
                        <HelpContent
                            account={account.get("name")}
                            path="components/DepositWithdraw"
                            section="receive"
                        />
                    </div>
                </div>
                <div>
                    <div className="grid-block vertical medium-horizontal no-margin no-padding">
                        <div className="medium-6 small-order-2 medium-order-1">
                            <Translate
                                component="label"
                                className="left-label"
                                content="gateway.service"
                            />
                            <select
                                onChange={onSetService}
                                className="bts-select"
                                value={activeService}
                            >
                                {options}
                            </select>
                            {currentServiceDown ? (
                                <Translate
                                    style={
                                        {
                                            color: "red",
                                            marginBottom: "1em",
                                            display: "block"
                                        } as any
                                    }
                                    content={`gateway.unavailable_${currentServiceName}`}
                                />
                            ) : null}
                        </div>
                        <div
                            className="medium-5 medium-offset-1 small-order-1 medium-order-2"
                            style={{paddingBottom: 20}}
                        >
                            <Translate
                                component="label"
                                className="left-label"
                                content="gateway.your_account"
                            />
                            <div className="inline-label">
                                <AccountImage
                                    size={{height: 40, width: 40}}
                                    account={account.get("name")}
                                    custom_image={null}
                                />
                                <input
                                    type="text"
                                    value={account.get("name")}
                                    placeholder={undefined}
                                    disabled
                                    onChange={() => {}}
                                    onKeyDown={() => {}}
                                    tabIndex={1}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    className="grid-content no-padding"
                    style={{paddingTop: 15}}
                >
                    {currentServiceDown
                        ? null
                        : activeService && services[activeService]
                        ? services[activeService].template
                        : services[0].template}
                </div>
            </div>
        </div>
    );
}

interface AccountDepositWithdrawContainerProps {
    [key: string]: any;
}

function AccountDepositWithdrawContainer(
    props: AccountDepositWithdrawContainerProps
) {
    useChainStoreTick();
    const accountState = useAltStore<any>(AccountStore);
    const settingsState = useAltStore<any>(SettingsStore);
    const gatewayState = useAltStore<any>(GatewayStore);

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            (updateGatewayBackers as any)();
        }
    }, []);

    const rawAccount = accountState.currentAccount;
    const resolvedAccount = (ChainStore as any).getAccount(
        rawAccount,
        undefined
    );

    if (!resolvedAccount) {
        return <span />;
    }

    return (
        <AccountDepositWithdraw
            {...props}
            account={resolvedAccount}
            currentAccount={
                accountState.currentAccount || accountState.passwordAccount
            }
            viewSettings={settingsState.viewSettings}
            backedCoins={gatewayState.backedCoins}
            openLedgerBackedCoins={gatewayState.backedCoins.get("OPEN", [])}
            rudexBackedCoins={gatewayState.backedCoins.get("RUDEX", [])}
            bitsparkBackedCoins={gatewayState.backedCoins.get(
                "SPARKDEX",
                []
            )}
            blockTradesBackedCoins={gatewayState.backedCoins.get(
                "TRADE",
                []
            )}
            citadelBackedCoins={gatewayState.backedCoins.get("CITADEL", [])}
            piratecashBackedCoins={gatewayState.backedCoins.get(
                "PIRATE",
                []
            )}
            xbtsxBackedCoins={gatewayState.backedCoins.get("XBTSX", [])}
            servicesDown={gatewayState.down || {}}
        />
    );
}

export default AccountDepositWithdrawContainer;
