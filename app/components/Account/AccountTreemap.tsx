// TypeScript/functional-component port of the legacy AccountTreemap.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Structural changes (not behavior changes):
// - `AccountTreemap`'s `BindToChainState(Component)` (required
//   `preferredAsset` prop) replaced by a Container gating on the
//   resolved value under `useChainStoreTick()`. The `assets` prop
//   (`ChainTypes.ChainAssetsList`) is declared in the original propTypes
//   but never actually read anywhere in `AccountTreemap`'s own body -
//   confirmed dead, so no resolution Container is built for it here; it
//   is simply passed through unresolved, matching its already-inert
//   status.
// - `AccountTreemapBalanceWrapper`'s `BindToChainState(Component)`
//   (required `core_asset`, optional `balanceObjects` list) replaced by
//   a Container gating on `core_asset`, replicating
//   `BindToChainState.jsx`'s exact `chain_objects_list` resolution loop
//   for `balanceObjects` (same sparse-array quirk already documented for
//   `Utility/AssetSelect.tsx`/`Account/BalanceWrapper.tsx`).
// - `AccountTreemapWrapper`'s `AltContainer` (injecting `marketStats`
//   from `MarketsStore` and `settings` from `SettingsStore`) replaced by
//   two `useAltStore()` calls, the same multi-store pattern already
//   established in `Dashboard/DashboardList.tsx`.
//
// The commented-out `shouldComponentUpdate` was already dead (commented
// out in the original) - dropped along with the comment itself.
import * as React from "react";
import ReactHighcharts from "react-highcharts";
import Treemap from "highcharts/modules/treemap";
import Heatmap from "highcharts/modules/heatmap";
import utils from "common/utils";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import MarketUtils from "common/market_utils";
import MarketsStore from "stores/MarketsStore";
import SettingsStore from "stores/SettingsStore";
import {Link, withRouter} from "react-router-dom";
import {useAltStore} from "../../next/hooks/useAltStore";

Treemap(ReactHighcharts.Highcharts);
Heatmap(ReactHighcharts.Highcharts);

const LinkComponent = Link as React.ComponentType<any>;

function resolveObjectsList(prop: any, autosubscribe: boolean): any[] {
    const result: any[] = [];
    if (!prop) return result;
    let index = 0;
    prop.forEach((obj_id: any) => {
        ++index;
        if (obj_id) {
            result[index] = ChainStore.getObject(obj_id, false, autosubscribe);
        }
    });
    return result;
}

interface AccountTreemapCoreProps {
    balanceObjects?: any;
    core_asset: any;
    marketStats?: any;
    preferredAsset: any;
    history?: any;
}

function AccountTreemap({
    balanceObjects,
    core_asset,
    marketStats,
    preferredAsset,
    history
}: AccountTreemapCoreProps) {
    let accountBalances: any = null;

    if (balanceObjects && balanceObjects.length > 0) {
        let totalValue = 0;
        accountBalances = balanceObjects.forEach((balance: any) => {
            if (!balance) return;
            const balanceObject =
                typeof balance == "string"
                    ? ChainStore.getObject(balance)
                    : balance;
            const asset_type = balanceObject.get("asset_type");
            const asset = ChainStore.getAsset(asset_type);
            if (!asset || !preferredAsset) return;
            const amount = Number(balanceObject.get("balance"));
            const eqValue = MarketUtils.convertValue(
                amount,
                preferredAsset,
                asset,
                marketStats,
                core_asset
            );

            if (!eqValue) return;
            const precision = utils.get_asset_precision(
                preferredAsset.get("precision")
            );
            totalValue += eqValue / precision;
        });

        accountBalances = balanceObjects
            .map((balance: any, index: number) => {
                if (!balance) return null;
                const balanceObject =
                    typeof balance == "string"
                        ? ChainStore.getObject(balance)
                        : balance;
                const asset_type = balanceObject.get("asset_type");
                const asset = ChainStore.getAsset(asset_type);
                if (!asset) return null;
                const amount = Number(balanceObject.get("balance"));

                const eqValue = MarketUtils.convertValue(
                    amount,
                    preferredAsset,
                    asset,
                    marketStats,
                    core_asset
                );

                if (!eqValue) {
                    return null;
                }

                const precision = utils.get_asset_precision(
                    preferredAsset.get("precision")
                );
                const finalValue = eqValue / precision;
                const percent = (finalValue / totalValue) * 100;

                /*
                * Filter out assets that make up a small percentage of
                * the total value of the account
                */
                if (percent < 0.5) return null;
                if (finalValue < 1) return null;
                const symbol = asset.get("symbol");
                return {
                    symbol: symbol,
                    name: `${symbol} (${
                        totalValue === 0 ? 0 : percent.toFixed(2)
                    }%)`,
                    value: finalValue,
                    color: (ReactHighcharts as any).Highcharts.getOptions().colors[
                        index
                    ]
                };
            })
            .filter((n: any) => !!n);
    }

    if (
        accountBalances &&
        accountBalances.length === 1 &&
        accountBalances[0].value === 0
    ) {
        accountBalances = null;
    }

    const config = {
        chart: {
            backgroundColor: "rgba(255, 0, 0, 0)",
            height: 250,
            spacingLeft: 0,
            spacingRight: 0,
            spacingBottom: 0
        },
        credits: {
            enabled: false
        },
        legend: {
            enabled: false
        },
        plotOptions: {
            treemap: {
                animation: false,
                tooltip: {
                    pointFormatter: function(this: any) {
                        return `<b>${
                            this.name
                        }</b>: ${(ReactHighcharts as any).Highcharts.numberFormat(
                            this.value,
                            0
                        )} ${preferredAsset.get("symbol")}`;
                    }
                }
            },
            series: {
                cursor: "pointer",
                point: {
                    events: {
                        click: function(this: any) {
                            const link = `/asset/${this.symbol}`;
                            history.push(link);
                        }
                    }
                }
            }
        },
        series: [
            {
                type: "treemap",
                levels: [
                    {
                        level: 1,
                        layoutAlgorithm: "sliceAndDice",
                        dataLabels: {
                            enabled: true,
                            align: "center",
                            verticalAlign: "middle"
                        }
                    }
                ],
                data: accountBalances
            }
        ],
        title: {
            text: null
        }
    };

    return <AccountTreemapView accountBalances={accountBalances} config={config} />;
}

function AccountTreemapView({
    accountBalances,
    config
}: {
    accountBalances: any;
    config: any;
}) {
    return (
        <div className="account-treemap">
            <div className="account-treemap--legend">
                {accountBalances &&
                    accountBalances.map(
                        ({name, symbol, color}: any, key: number) => {
                            return (
                                <LinkComponent key={key} to={`/asset/${symbol}`}>
                                    <div className="legend-item">
                                        <div
                                            className="legend-square"
                                            style={{backgroundColor: color}}
                                        />
                                        {name}
                                    </div>
                                </LinkComponent>
                            );
                        }
                    )}
            </div>
            <ReactHighcharts config={config} />
        </div>
    );
}

interface AccountTreemapContainerProps
    extends Omit<AccountTreemapCoreProps, "preferredAsset"> {
    preferredAsset: string;
    assets?: any;
}

function AccountTreemapContainer({
    preferredAsset,
    ...rest
}: AccountTreemapContainerProps) {
    useChainStoreTick();
    const resolvedPreferredAsset = ChainStore.getAsset(preferredAsset);

    if (!resolvedPreferredAsset) {
        return <span />;
    }

    return (
        <AccountTreemap {...rest} preferredAsset={resolvedPreferredAsset} />
    );
}

interface AccountTreemapBalanceWrapperProps {
    balanceObjects?: any;
    core_asset?: string;
    settings: any;
    [key: string]: any;
}

function AccountTreemapBalanceWrapper({
    balanceObjects = [],
    core_asset = "1.3.0",
    settings,
    ...rest
}: AccountTreemapBalanceWrapperProps) {
    useChainStoreTick();
    const resolvedCoreAsset = ChainStore.getAsset(core_asset);
    const resolvedBalanceObjects = resolveObjectsList(balanceObjects, false);

    if (!resolvedCoreAsset) {
        return <span />;
    }

    const assets = resolvedBalanceObjects
        .filter(a => !!a)
        .map(a => {
            return a.get("asset_type");
        });

    return (
        <AccountTreemapContainer
            preferredAsset={settings.get("unit", "1.3.0")}
            assets={assets}
            balanceObjects={resolvedBalanceObjects}
            core_asset={resolvedCoreAsset}
            {...rest}
        />
    );
}

interface AccountTreemapWrapperProps {
    refCallback?: any;
    [key: string]: any;
}

function AccountTreemapWrapper(props: AccountTreemapWrapperProps) {
    const settingsState = useAltStore<any>(SettingsStore);
    const marketsState = useAltStore<any>(MarketsStore);

    return (
        <AccountTreemapBalanceWrapper
            {...props}
            ref={props.refCallback}
            marketStats={marketsState.allMarketStats}
            settings={settingsState.settings}
        />
    );
}

export default withRouter(AccountTreemapWrapper as any) as React.ComponentType<any>;
