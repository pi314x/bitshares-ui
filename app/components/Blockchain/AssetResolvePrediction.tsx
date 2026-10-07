// TypeScript/functional-component port of the legacy
// AssetResolvePrediction.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Non-security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `ApplicationApi`, `.add_type_operation`, `process_transaction`
// - none appear. `onSubmit` only calls
// `AssetActions.assetGlobalSettle(asset, account.get("id"), price)` (a
// flux action creator dispatching to `AssetStore`, out of scope here,
// which builds/signs the real `asset_global_settle` transaction).
//
// `AssetResolvePrediction = BindToChainState(AssetResolvePrediction)`
// (required `account: ChainTypes.ChainAccount.isRequired`) becomes a
// Container+Core split, gating on `resolvedAccount === undefined` with a
// blank `<span/>` fallback, per `BindToChainState.jsx`'s exact "only
// `undefined` - still resolving - blocks; a resolved `null` renders
// through" semantics (this class declares neither
// `defaultProps.tempComponent` nor `{show_loader: true}` at the wrap
// site). Unlike `AssetPublishFeed.jsx`, this file is never additionally
// wrapped in `AssetWrapper` - the real caller (`Asset.tsx`) passes an
// already-resolved `asset` object directly, not an id string, so no
// asset-resolution HOC was ever applied here.
//
// `shouldComponentUpdate` (compares `np.asset.id`/state fields against
// current) is a pure render-gating boolean with no other observable side
// effect - dropped entirely, per this migration's established precedent
// (no hooks equivalent; never changes final rendered output, only how
// often identical output is recomputed).
//
// `onPriceChanged`/`onPriceChangedObject`/`onReset`/`onChange`/
// `onChangeRadio` become plain closures using a local `mergeState`
// helper for the original's multi-key `setState({...})` calls.
import * as React from "react";
import Translate from "react-translate-component";
import AssetActions from "actions/AssetActions";
import counterpart from "counterpart";
import {Radio} from "../../design-system/Radio";
import {Tooltip} from "../../design-system/Tooltip";
import {Button} from "../../design-system/Button";
import {Form} from "../../design-system/Form";
import AmountSelector from "../Utility/AmountSelectorStyleGuide";
import {ChainStore} from "bitsharesjs";
import {Asset, Price} from "../../lib/common/MarketClasses";
import assetUtils from "../../lib/common/asset_utils";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface AssetResolvePredictionState {
    globalSettlementPrice: any;
    customPrice: boolean;
}

interface AssetResolvePredictionCoreProps {
    asset: any;
    account: any;
    [key: string]: any;
}

function AssetResolvePredictionCore({
    asset,
    account
}: AssetResolvePredictionCoreProps) {
    const [state, setState] = React.useState<AssetResolvePredictionState>({
        globalSettlementPrice: null,
        customPrice: false
    });

    const mergeState = (patch: Partial<AssetResolvePredictionState>) => {
        setState(prev => ({...prev, ...patch}));
    };

    const onPriceChanged = (value: any) => {
        if (value == 2 && !state.customPrice) {
            mergeState({
                globalSettlementPrice: 1,
                customPrice: true
            });
        } else {
            mergeState({
                globalSettlementPrice: value
            });
        }
    };

    const onSubmit = () => {
        const base = new (Asset as any)({
            real: 1,
            asset_id: asset.id,
            precision: asset.precision
        });
        const quoteAsset = (ChainStore as any).getAsset(
            asset.bitasset.options.short_backing_asset
        );
        const quote = new (Asset as any)({
            real: state.globalSettlementPrice,
            asset_id: asset.bitasset.options.short_backing_asset,
            precision: quoteAsset.get("precision")
        });

        const price = new (Price as any)({
            quote,
            base
        });

        (AssetActions as any)
            .assetGlobalSettle(asset, account.get("id"), price)
            .then(() => {
                onReset();
            });
    };

    const onReset = () => {
        mergeState({
            globalSettlementPrice: null,
            customPrice: false
        });
    };

    const onChange = ({amount}: {amount: any}) => {
        onPriceChanged(amount);
    };

    const onChangeRadio = (e: any) => {
        onPriceChanged(e.target.value);
    };

    const base = (ChainStore as any).getAsset(
        asset.bitasset.options.short_backing_asset
    );

    const description = (assetUtils as any).parseDescription(
        asset.options.description
    );

    return (
        <div>
            <Form
                style={{paddingBottom: "1rem"}}
                className="full-width"
                layout="vertical"
            >
                <div>
                    <Tooltip
                        title={counterpart.translate(
                            "explorer.asset.prediction_market_asset.tooltip_prediction"
                        )}
                        placement={"topLeft"}
                    >
                        <Translate content="explorer.asset.prediction_market_asset.prediction" />
                        {": "}
                        <p>{description.condition}</p>
                    </Tooltip>
                </div>
                <div>
                    <Tooltip
                        title={counterpart.translate(
                            "explorer.asset.prediction_market_asset.tooltip_resolution_date"
                        )}
                        placement={"topLeft"}
                    >
                        <Translate content="explorer.asset.prediction_market_asset.resolution_date" />
                        {": "}
                        <p>{description.expiry}</p>
                    </Tooltip>
                </div>
                <Radio.Group
                    onChange={onChangeRadio}
                    value={state.globalSettlementPrice}
                >
                    <Radio
                        value={1}
                        disabled={state.customPrice ? true : undefined}
                    >
                        <Translate content="boolean.true" />
                    </Radio>
                    <Radio
                        value={0}
                        disabled={state.customPrice ? true : undefined}
                    >
                        <Translate content="boolean.false" />
                    </Radio>
                    <Radio
                        value={
                            !state.customPrice
                                ? 2
                                : state.globalSettlementPrice
                        }
                    >
                        <Translate content="settings.custom" />
                    </Radio>
                </Radio.Group>
                <br />
                <br />
                <AmountSelector
                    disabled={state.customPrice ? undefined : true}
                    label="explorer.asset.price_feed.global_settlement_price"
                    amount={state.globalSettlementPrice}
                    onChange={onChange}
                    asset={base.get("id")}
                    base={asset.symbol}
                    isPrice
                    assets={[base.get("id")]}
                    placeholder="0.0"
                    style={{
                        width: "100%"
                    }}
                />
                <div style={{paddingTop: "1rem"}} className="button-group">
                    <Button
                        variant="accent"
                        disabled={
                            state.globalSettlementPrice == null
                                ? true
                                : undefined
                        }
                        onClick={onSubmit}
                    >
                        <Translate content="account.perm.publish_prediction" />
                    </Button>
                    <Button style={{marginLeft: "8px"}} onClick={onReset}>
                        <Translate content="account.perm.reset" />
                    </Button>
                </div>
            </Form>
        </div>
    );
}

interface AssetResolvePredictionContainerProps {
    account: any;
    asset: any;
    [key: string]: any;
}

function AssetResolvePrediction({
    account,
    ...rest
}: AssetResolvePredictionContainerProps) {
    useChainStoreTick();
    const resolvedAccount = (ChainStore as any).getAccount(account);

    if (resolvedAccount === undefined) {
        return <span />;
    }

    return (
        <AssetResolvePredictionCore {...(rest as any)} account={resolvedAccount} />
    );
}

export default AssetResolvePrediction;
