// TypeScript port of the legacy EquivalentValueComponent.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes, with the
// same deliberate class-preservation deviation as the just-ported
// `EquivalentPrice.tsx` (see that file's header comment, and
// `MarketStatsCheck.tsx`'s from `Utility/` batch 11, for the full
// reasoning): `class ValueComponent extends MarketStatsCheck` genuinely
// relies on inheriting `MarketStatsCheck`'s lifecycle methods (live
// `MarketsActions.getMarketStatsInterval(...)` subscriptions) and calls
// `super.shouldComponentUpdate(np)` - converting it to a function
// component would silently stop those lifecycle methods from firing,
// with no compile-time or test signal. `ValueComponent` therefore stays
// an ES6 class here too - typed, mechanically cleaned up, no logic
// changes.
//
// Not otherwise security-sensitive per AGENTS.md: grepped for
// `WalletDb`, `WalletApi`, `.add_type_operation`, `process_transaction`
// - none appear. This component only displays a computed equivalent
// value, no transaction is built here.
//
// The other 2 exported components in this file have no such
// inheritance and convert cleanly to function components:
// - `EquivalentValueComponent` (a plain wrapper class around
//   `ValueComponent`, wrapped with `connect(..., {listenTo:
//   [MarketsStore]})`) becomes a function component calling
//   `useAltStore(MarketsStore)`.
// - `BalanceValueComponent` (wraps `EquivalentValueComponent`, wrapped
//   with `BindToChainState(BalanceValueComponent, {keep_updating:
//   true})`) becomes a Container+Core pair using `useChainStoreTick()` +
//   `ChainStore.getObject(...)` for its single required `balance`
//   (`ChainTypes.ChainObject.isRequired`) prop, matching this
//   migration's established `BindToChainState` translation. Preserved
//   verbatim, not "fixed": grepped `BindToChainState.jsx` itself for
//   `keep_updating` - it recognizes no such option (only `show_loader`,
//   `all_props`, `require_all_props`, `tempComponent` via
//   `defaultProps`) - so `{keep_updating: true}` was already a pure
//   no-op in the original; the Container here applies the plain default
//   fallback (`<span />` while `balance` is unresolved), same as every
//   other `BindToChainState(Component)` call with no recognized options.
import * as React from "react";
import FormattedAsset from "./FormattedAsset";
import AssetWrapper from "./AssetWrapper";
import utils from "common/utils";
import MarketsStore from "stores/MarketsStore";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import MarketStatsCheck from "./MarketStatsCheck";
import MarketUtils from "common/market_utils";
import {Tooltip} from "bitshares-ui-style-guide";
import {ChainStore} from "bitsharesjs";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const getEquivalentValue = function(
    amount: any,
    toAsset: any,
    fromAsset: any,
    fullPrecision: any = null,
    coreAsset: any = null,
    allMarketStats: any = null
) {
    try {
        return (MarketUtils as any).convertValue(
            amount,
            toAsset,
            fromAsset,
            allMarketStats
                ? allMarketStats
                : (MarketsStore.getState() as any).allMarketStats,
            coreAsset ? coreAsset : (ChainStore as any).getAsset("1.3.0"),
            fullPrecision ? fullPrecision : true
        );
    } catch (err) {
        console.log(err);
    }
};

/**
 *  Given an asset amount, displays the equivalent value in baseAsset if possible
 *
 *  Expects three properties
 *  -'toAsset' which should be a asset id
 *  -'fromAsset' which is the asset id of the original asset amount
 *  -'amount' which is the amount to convert
 *  -'fullPrecision' boolean to tell if the amount uses the full precision of the asset
 */
class ValueComponent extends MarketStatsCheck {
    static defaultProps = {
        fullPrecision: true,
        noDecimals: false,
        fullDecimals: false,
        hide_asset: false
    };

    shouldComponentUpdate(np: any): boolean {
        return (
            super.shouldComponentUpdate(np) ||
            !(utils as any).are_equal_shallow(np.pulsate, this.props.pulsate) ||
            np.toAsset !== this.props.toAsset ||
            np.fromAsset !== this.props.fromAsset ||
            np.amount !== this.props.amount
        );
    }

    render() {
        const {
            amount,
            toAsset,
            fromAsset,
            fullPrecision,
            coreAsset,
            ...others
        } = this.props as any;

        const toID = toAsset.get("id");
        const toSymbol = toAsset.get("symbol");

        const eqValue = getEquivalentValue(
            amount,
            toAsset,
            fromAsset,
            fullPrecision,
            coreAsset
        );

        if (!eqValue && eqValue !== 0) {
            return (
                <Tooltip
                    placement="bottom"
                    title={counterpart.translate("tooltip.no_price")}
                >
                    <div
                        className="tooltip inline-block"
                        style={{fontSize: "0.9rem"}}
                    >
                        <Translate content="account.no_price" />
                    </div>
                </Tooltip>
            );
        }

        return (
            <FormattedAsset
                noPrefix
                amount={eqValue}
                asset={toID}
                decimalOffset={
                    toSymbol.indexOf("BTC") !== -1
                        ? 4
                        : (this.props as any).fullDecimals
                            ? 0
                            : (this.props as any).noDecimals
                                ? toAsset.get("precision")
                                : toAsset.get("precision") - 2
                }
                {...others}
            />
        );
    }
}
const WrappedValueComponent = AssetWrapper(ValueComponent as any, {
    propNames: ["toAsset", "fromAsset", "coreAsset"],
    defaultProps: {
        toAsset: "1.3.0",
        coreAsset: "1.3.0"
    }
});

interface EquivalentValueComponentProps {
    refCallback?: (ref: any) => void;
    [key: string]: any;
}

function EquivalentValueComponent(props: EquivalentValueComponentProps) {
    const {refCallback, ...others} = props;
    const marketsState = useAltStore<any>(MarketsStore);

    return (
        <WrappedValueComponent
            {...others}
            allMarketStats={marketsState.allMarketStats}
            ref={refCallback}
        />
    );
}

const balanceToAsset = function(balance: any) {
    const isBalanceObject = balance.getIn(["balance", "amount"]);
    if (isBalanceObject || isBalanceObject === 0) {
        return {
            asset_id: balance.getIn(["balance", "asset_id"]),
            amount: Number(balance.getIn(["balance", "amount"]))
        };
    } else {
        return {
            asset_id: balance.get("asset_type"),
            amount: Number(balance.get("balance"))
        };
    }
};

interface BalanceValueComponentCoreProps {
    balance: any;
    satoshis?: number | null;
    [key: string]: any;
}

function BalanceValueComponentCore({
    balance,
    satoshis = null,
    ...others
}: BalanceValueComponentCoreProps) {
    const balanceAsset = balanceToAsset(balance);
    let amount = balanceAsset.amount;
    // override amount if desired
    if (!!satoshis) {
        amount = satoshis;
    }
    const fromAsset = balanceAsset.asset_id;
    if (isNaN(amount)) return <span>--</span>;
    return (
        <EquivalentValueComponent
            amount={amount}
            fromAsset={fromAsset}
            noDecimals={true}
            fullPrecision={!!satoshis ? false : (others as any).fullPrecision}
            {...others}
        />
    );
}

function BalanceValueComponent(props: BalanceValueComponentCoreProps) {
    useChainStoreTick();
    const balance = (ChainStore as any).getObject(props.balance);

    if (balance === undefined) return <span />;

    return <BalanceValueComponentCore {...props} balance={balance} />;
}

export {
    EquivalentValueComponent,
    BalanceValueComponent,
    balanceToAsset,
    getEquivalentValue
};
