// TypeScript/functional-component port of the legacy XbtsxGateway.jsx
// (Phase 7, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Preserved verbatim (not "fixed"): `_getActiveCoin(props, state)` expects
// `state` to be an object with an `.action` field (`{action: "deposit"}`),
// but `UNSAFE_componentWillReceiveProps` calls it with `this.state.action`
// - a plain *string* ("deposit"/"withdraw"), not an object - so inside
// `_getActiveCoin`, `state.action` reads a property off a string and is
// always `undefined`, making both the cached-coin lookup key
// (`activeCoin_xbtsx_undefined`) and the `firstTimeCoin` fallback always
// resolve to a coin-less state. In practice this whole branch is
// unreachable: this component's only caller (`AccountDepositWithdraw.jsx`)
// never passes a `provider` prop, so `nextProps.provider !== this.props
// .provider` is always `undefined !== undefined` (`false`). Replicated
// exactly (same buggy string-not-object argument) via a
// previous-render-ref comparison, matching this migration's established
// `UNSAFE_componentWillReceiveProps` translation pattern, rather than
// silently correcting it.
//
// Also preserved: the constructor always calls `_getActiveCoin(props,
// {action: "deposit"})` for the *initial* `activeCoin`, regardless of
// what the initial `action` state actually is (which is read separately
// from the `xbtsxAction` view setting) - so a user who last left this
// screen on "withdraw" still gets their *deposit*-mode remembered coin
// pre-selected on first mount.
import * as React from "react";
import XbtsxGatewayDepositRequest from "./XbtsxGatewayDepositRequest";
import Translate from "react-translate-component";
import SettingsStore from "stores/SettingsStore";
import SettingsActions from "actions/SettingsActions";
import {
    RecentTransactions,
    TransactionWrapper
} from "components/Account/RecentTransactions";
import Immutable from "immutable";
import LoadingIndicator from "../../LoadingIndicator";
import {useAltStore} from "../../../next/hooks/useAltStore";

function getActiveCoin(props: any, state: {action: string}) {
    const cachedCoin = props.viewSettings.get(
        `activeCoin_xbtsx_${state.action}`,
        null
    );
    let firstTimeCoin = null;
    if (state.action == "deposit") {
        firstTimeCoin = "PPY";
    }
    if (state.action == "withdraw") {
        firstTimeCoin = "PPY";
    }
    const activeCoin = cachedCoin ? cachedCoin : firstTimeCoin;
    return activeCoin;
}

interface XbtsxGatewayProps {
    coins: any[];
    account: any;
    provider?: any;
    style?: any;
}

function XbtsxGateway(props: XbtsxGatewayProps) {
    const {coins, account} = props;
    const settingsState = useAltStore<any>(SettingsStore as any);
    const viewSettings = settingsState.viewSettings;

    const [action, setAction] = React.useState<string>(() =>
        viewSettings.get(`xbtsxAction`, "deposit")
    );
    const [activeCoin, setActiveCoin] = React.useState<any>(() =>
        getActiveCoin({...props, viewSettings}, {action: "deposit"})
    );

    // Mirrors UNSAFE_componentWillReceiveProps: only fires on the
    // `provider` prop changing, not on this component's own state-driven
    // re-renders - see file header for why this is unreachable in
    // practice with this component's current sole caller.
    const prevProviderRef = React.useRef(props.provider);
    const isFirstRenderRef = React.useRef(true);
    if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;
    } else if (props.provider !== prevProviderRef.current) {
        setActiveCoin(getActiveCoin({...props, viewSettings}, action as any));
    }
    prevProviderRef.current = props.provider;

    const onSelectCoin = (e: any) => {
        setActiveCoin(e.target.value);

        const setting: any = {};
        setting[`activeCoin_xbtsx_${action}`] = e.target.value;
        (SettingsActions as any).changeViewSetting(setting);
    };

    const changeAction = (type: string) => {
        const newActiveCoin = getActiveCoin(
            {...props, viewSettings},
            {
                action: type
            }
        );

        setAction(type);
        setActiveCoin(newActiveCoin);

        (SettingsActions as any).changeViewSetting({[`xbtsxAction`]: type});
    };

    if (!coins.length) {
        return <LoadingIndicator />;
    }

    const filteredCoins = coins.filter((a: any) => {
        if (!a || !a.symbol) {
            return false;
        } else {
            return action === "deposit"
                ? a.depositAllowed
                : a.withdrawalAllowed;
        }
    });

    const coinOptions = filteredCoins
        .map((coin: any) => {
            const option =
                action === "deposit"
                    ? coin.backingCoin.toUpperCase()
                    : coin.symbol;
            return (
                <option value={option} key={coin.symbol}>
                    {option}
                </option>
            );
        })
        .filter((a: any) => {
            return a !== null;
        });

    let coin = filteredCoins.filter((coin: any) => {
        return action === "deposit"
            ? coin.backingCoin.toUpperCase() === activeCoin
            : coin.symbol === activeCoin;
    })[0];

    if (!coin) coin = filteredCoins[0];

    const isDeposit = action === "deposit";

    const supportUrl = "https://t.me/xbtsio";

    return (
        <div style={props.style}>
            <div className="grid-block no-margin vertical medium-horizontal no-padding">
                <div className="medium-4">
                    <div>
                        <label
                            style={{minHeight: "2rem"}}
                            className="left-label"
                        >
                            <Translate content={"gateway.choose_" + action} />:{" "}
                        </label>
                        <select
                            className="external-coin-types bts-select"
                            onChange={onSelectCoin}
                            value={activeCoin}
                        >
                            {coinOptions}
                        </select>
                    </div>
                </div>

                <div className="medium-6 medium-offset-1">
                    <label style={{minHeight: "2rem"}} className="left-label">
                        <Translate content="gateway.gateway_text" />:
                    </label>
                    <div style={{paddingBottom: 15}}>
                        <ul className="button-group segmented no-margin">
                            <li
                                className={
                                    action === "deposit" ? "is-active" : ""
                                }
                            >
                                <a onClick={() => changeAction("deposit")}>
                                    <Translate content="gateway.deposit" />
                                </a>
                            </li>
                            <li
                                className={
                                    action === "withdraw" ? "is-active" : ""
                                }
                            >
                                <a onClick={() => changeAction("withdraw")}>
                                    <Translate content="gateway.withdraw" />
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {!coin ? null : (
                <div>
                    <div style={{marginBottom: 15}}>
                        <XbtsxGatewayDepositRequest
                            key={`${coin.symbol}`}
                            gateway={coin.gatewayWallet}
                            issuer_account={coin.issuer}
                            account={account}
                            deposit_asset={coin.backingCoin.toUpperCase()}
                            deposit_asset_name={coin.name}
                            deposit_coin_type={coin.backingCoin.toLowerCase()}
                            deposit_account={coin.gatewayWallet}
                            deposit_wallet_type={coin.walletType}
                            receive_asset={coin.symbol}
                            receive_coin_type={coin.symbol.toLowerCase()}
                            supports_output_memos={coin.memoSupport}
                            min_amount={coin.minAmount}
                            asset_precision={coin.precision}
                            action={action}
                        />
                        <label className="left-label">Support</label>
                        <div>
                            <Translate content="gateway.xbtsx.support_block" />
                            <br />
                            <br />
                            <a
                                href={supportUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="external-link"
                            >
                                {supportUrl}
                            </a>
                        </div>
                    </div>

                    {coin && coin.symbol ? (
                        <TransactionWrapper
                            asset={coin.symbol}
                            fromAccount={
                                isDeposit ? coin.issuerId : account.get("id")
                            }
                            to={isDeposit ? account.get("id") : coin.issuerId}
                        >
                            {({asset, to, fromAccount}: any) => {
                                return (
                                    <RecentTransactions
                                        accountsList={Immutable.List([
                                            account.get("id")
                                        ])}
                                        limit={10}
                                        compactView={true}
                                        fullHeight={true}
                                        filter="transfer"
                                        title={
                                            <Translate
                                                content={
                                                    "gateway.recent_" + action
                                                }
                                            />
                                        }
                                        customFilter={{
                                            fields: ["to", "from", "asset_id"],
                                            values: {
                                                to: to.get("id"),
                                                from: fromAccount.get("id"),
                                                asset_id: asset.get("id")
                                            }
                                        }}
                                    />
                                );
                            }}
                        </TransactionWrapper>
                    ) : null}
                </div>
            )}
        </div>
    );
}

export default XbtsxGateway;
