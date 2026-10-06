// TypeScript/functional-component port of the legacy SettleModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `onSubmit` builds and submits an
// `asset_settle` transaction via `WalletApi.new_transaction()`/
// `WalletDb.process_transaction()` - transcribed verbatim.
//
// `WorthLessSettlementWarning` was already a plain functional component
// wrapped in the (unchanged, out-of-scope) `withWorthLessSettlementFlag`
// HOC - only its own prop types needed adding.
//
// `AssetWrapper(Component, {propNames: ["asset", "core"], withDynamic:
// true, defaultProps: {core: "2.0.0"}})` kept as-is (shared HOC, out of
// scope). `UNSAFE_componentWillReceiveProps` (resets `amount` to 0 when
// the resolved `asset`'s id changes) becomes a `useEffect` keyed on
// `asset.get("id")` - no mount-guard needed, same reasoning as
// `ReserveAssetModal.tsx`/`CreateLockModal.tsx` (earlier Modal batches).
//
// The trivial outer `SettleModal` class (`render() { return
// <ModalContent {...this.props} />; }`) becomes a trivial passthrough
// function.
//
// Dropped as confirmed dead: the `ref="settlement_modal"` legacy string
// ref on `<Modal>` (never read via `this.refs.settlement_modal`
// anywhere). `showModal` (passed by both real callers,
// `BuySell.tsx`/`AccountPortfolioList.tsx`) is accepted but never read
// anywhere in the file, matching the original.
//
// Lint-forced fix (required by `yarn lint:changed`, which this file is
// now newly subject to - not a behavior "improvement"): the original's
// `footer` array put `key={"submit"}` on the inner `<Button>` instead of
// the outer `<Tooltip>`, which is the actual array element React's
// reconciler keys on (`react/jsx-key`). Added `key={"submit"}` to the
// `<Tooltip>` too rather than moving it, so nothing else changes.
//
// TS-forced adjustment: `parseInt(amount * Math.pow(...))` relied on
// JS's implicit ToString coercion of a numeric argument to `parseInt`
// (which TS's `parseInt(string, radix?)` signature rejects, inferring
// the product's type as `number` rather than `any` despite `amount`
// itself being `any`). Wrapped in an explicit `String(...)`, which
// performs the exact same coercion `parseInt` would have done
// implicitly - no behavior change.
import * as React from "react";
import {Fragment} from "react";
import Translate from "react-translate-component";
import AssetName from "../Utility/AssetName";
import MarketLink from "../Utility/MarketLink";
import BalanceComponent from "../Utility/BalanceComponent";
import WalletApi from "api/WalletApi";
import WalletDb from "stores/WalletDb";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import AmountSelector from "../Utility/AmountSelectorStyleGuide";
import withWorthLessSettlementFlag from "../Utility/withWorthLessSettlementFlag";
import TranslateWithLinks from "../Utility/TranslateWithLinks";
import {Alert} from "../../design-system/Alert";
import {Form} from "../../design-system/Form";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import {Tooltip} from "../../design-system/Tooltip";
import utils from "common/utils";
import AssetWrapper from "../Utility/AssetWrapper";

interface WorthLessSettlementWarningInnerProps {
    worthLessSettlement?: any;
    asset: any;
    shortBackingAsset?: any;
    marketPrice?: any;
    settlementPrice?: any;
}

const WorthLessSettlementWarning = (withWorthLessSettlementFlag as any)(
    ({
        worthLessSettlement,
        asset,
        shortBackingAsset,
        marketPrice: marketPriceProp,
        settlementPrice: settlementPriceProp
    }: WorthLessSettlementWarningInnerProps) => {
        const marketPrice = (utils as any).format_number(
            marketPriceProp,
            asset.get("precision")
        );
        const settlementPrice = (utils as any).format_number(
            settlementPriceProp,
            asset.get("precision")
        );
        switch (worthLessSettlement) {
            case true:
                return (
                    <div>
                        <Translate
                            component="h2"
                            content="exchange.settle_better_marketprice"
                        />
                        <span>
                            <TranslateWithLinks
                                string="exchange.worth_less_settlement_warning"
                                keys={[
                                    {
                                        value: (
                                            <MarketLink
                                                base={asset.get("id")}
                                                quote={shortBackingAsset.get(
                                                    "id"
                                                )}
                                            />
                                        ),
                                        arg: "market_link"
                                    }
                                ]}
                            />
                            <br />
                            &nbsp;&nbsp;
                            <Translate content="exchange.price_market" />
                            :&nbsp;&nbsp;
                            {marketPrice}
                            <br />
                            &nbsp;&nbsp;
                            <Translate content="exchange.settle" />
                            :&nbsp;&nbsp;
                            {settlementPrice}
                        </span>
                    </div>
                );
            case undefined:
                return (
                    <Translate content="exchange.checking_for_worth_less_settlement" />
                );
            default:
                return (
                    <div>
                        <Translate
                            component="h2"
                            content="exchange.settle_better_settleprice"
                        />
                        <span>
                            <TranslateWithLinks
                                string="exchange.settlement_hint"
                                keys={[
                                    {
                                        value: (
                                            <MarketLink
                                                base={asset.get("id")}
                                                quote={shortBackingAsset.get(
                                                    "id"
                                                )}
                                            />
                                        ),
                                        arg: "market_link"
                                    },
                                    {
                                        value: (
                                            <AssetName
                                                name={asset.get("symbol")}
                                            />
                                        ),
                                        arg: "long"
                                    }
                                ]}
                            />
                            <br />
                            &nbsp;&nbsp;
                            <Translate content="exchange.price_market" />
                            :&nbsp;&nbsp;
                            {marketPrice}
                            <br />
                            &nbsp;&nbsp;
                            <Translate content="exchange.settle" />
                            :&nbsp;&nbsp;
                            {settlementPrice}
                        </span>
                    </div>
                );
        }
    }
);

interface ModalContentState {
    amount: any;
}

interface ModalContentCoreProps {
    visible: boolean;
    modalId?: string;
    hideModal: () => void;
    showModal?: () => void;
    asset: any;
    core: any;
    account: any;
    getDynamicObject: (id: any) => any;
}

function ModalContent({
    visible,
    hideModal,
    asset,
    core,
    account,
    getDynamicObject
}: ModalContentCoreProps) {
    const [state, setState] = React.useState<ModalContentState>({
        amount: 0
    });

    const mergeState = (partial: Partial<ModalContentState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    React.useEffect(() => {
        setState({amount: 0});
    }, [asset.get("id")]);

    const getSettlementInfo = () => {
        const dynamic = getDynamicObject(asset.get("dynamic_asset_data_id"));
        const currentSupply =
            dynamic && dynamic.size ? dynamic.get("current_supply") : 0;
        const maintenanceInterval =
            core && core.size
                ? core.getIn(["parameters", "maintenance_interval"])
                : 0;
        const bitAsset = asset.get("bitasset").toJS();
        const currentSettled = bitAsset.force_settled_volume;
        const maxSettlementVolume =
            currentSupply *
            (bitAsset.options.maximum_force_settlement_volume / 10000);
        const remainingVolume = !currentSettled
            ? maxSettlementVolume
            : maxSettlementVolume - currentSettled;
        const settlementDelay = bitAsset.options.force_settlement_delay_sec;
        return {
            maxSettlementVolume,
            remainingVolume,
            maintenanceInterval,
            settlementDelay
        };
    };

    const onAmountChanged = ({amount}: any) => {
        mergeState({amount: amount});
    };

    const onSubmit = (e: any) => {
        let {amount} = state;
        e.preventDefault();

        hideModal();

        amount = parseInt(
            String(amount * Math.pow(10, asset.get("precision")))
        );

        const tr = (WalletApi as any).new_transaction();
        tr.add_type_operation("asset_settle", {
            fee: {
                amount: 0,
                asset_id: 0
            },
            account: account.get("id"),
            amount: {
                amount: amount,
                asset_id: asset.get("id")
            }
        });
        return (WalletDb as any)
            .process_transaction(tr, null, true)
            .then(() => {
                // console.log("asset settle result:", result);
                // this.dispatch(account_id);
                return true;
            })
            .catch((error: any) => {
                console.error("asset settle error: ", error);
                return false;
            });
    };

    const useMaxValue = (amount: any) => {
        mergeState({
            amount: amount / Math.pow(10, asset.get("precision"))
        });
    };

    if (!asset) {
        return null;
    }

    const options =
        asset && asset.getIn(["bitasset", "options"])
            ? asset.getIn(["bitasset", "options"]).toJS()
            : null;

    const isGlobalSettled =
        asset.get("bitasset").get("settlement_fund") > 0 ? true : false;

    let offset = 0;
    if (!isGlobalSettled) {
        offset =
            asset
                .get("bitasset")
                .get("options")
                .get("force_settlement_offset_percent") / 100;
    }

    // TODO
    // Check if force_settled_volume exceeds maximum_force_settlement_volume
    // Requires Dynamic Object for Total Supply
    // var maxSettlementVolume = asset.get("bitasset").get("options").get("maximum_force_settlement_volume");
    // var currentSettled = asset.get("bitasset").get("force_settled_volume");

    const assetID = asset.get("id");

    const account_balances = account.get("balances");

    const {name: assetName, prefix} = (utils as any).replaceName(asset);
    const assetFullName = (prefix ? prefix : "") + assetName;

    let currentBalance = null,
        balanceAmount: any = 0;

    account_balances &&
        account_balances.forEach((balance: any) => {
            const balanceObject: any = ChainStore.getObject(balance);
            if (!balanceObject.get("balance")) {
                return null;
            }
            if (balanceObject.get("asset_type") === assetID) {
                currentBalance = balance;
                balanceAmount = balanceObject.get("balance");
            }
        });

    const balanceText = (
        <span>
            <Translate content="exchange.balance" />
            :&nbsp;
            {currentBalance ? (
                <span
                    className="underline"
                    onClick={() => useMaxValue(balanceAmount)}
                >
                    <BalanceComponent balance={currentBalance} />
                </span>
            ) : (
                "0 " + asset.get("symbol")
            )}
        </span>
    );

    let isFundsToLow = false;
    if (
        state.amount >
        balanceAmount / Math.pow(10, asset.get("precision"))
    ) {
        isFundsToLow = true;
    }

    const footer = [
        <Tooltip
            key={"submit"}
            title={
                isFundsToLow
                    ? counterpart.translate("tooltip.lack_funds")
                    : null
            }
        >
            <Button
                key={"submit"}
                variant="accent"
                onClick={onSubmit}
                disabled={isFundsToLow}
            >
                {counterpart.translate("modal.settle.submit")}
            </Button>
        </Tooltip>,
        <Button key={"close"} onClick={hideModal}>
            {counterpart.translate("modal.close")}
        </Button>
    ];

    const {
        maxSettlementVolume,
        remainingVolume,
        settlementDelay,
        maintenanceInterval
    } = getSettlementInfo();

    const estimatedDelay = !isGlobalSettled
        ? (settlementDelay +
              Math.floor(state.amount / maxSettlementVolume) *
                  maintenanceInterval) /
          3600
        : 0;

    const isPredictionMarket = asset.getIn([
        "bitasset",
        "is_prediction_market"
    ]);

    const modalContent = isPredictionMarket ? (
        <Alert
            message={counterpart.translate(
                "tooltip.settle_market_prediction"
            )}
            type="info"
            showIcon
        />
    ) : (
        <React.Fragment>
            {isGlobalSettled ? (
                <Alert
                    message={counterpart.translate(
                        "exchange.settle_delay_globally_settled"
                    )}
                    type="warning"
                    showIcon
                />
            ) : (
                <Alert
                    message={counterpart.translate("exchange.settle_delay", {
                        hours: options.force_settlement_delay_sec / 3600
                    })}
                    description={
                        estimatedDelay
                            ? counterpart.translate("modal.settle.delay", {
                                  amount: estimatedDelay
                              })
                            : null
                    }
                    type="info"
                    showIcon
                />
            )}
            <WorthLessSettlementWarning asset={assetID} />
            <br />
            {!isGlobalSettled ? (
                <Translate
                    component="div"
                    content="exchange.settle_offset"
                    offset={offset}
                />
            ) : null}
            <br />
            <Form className="full-width" layout="vertical">
                <AmountSelector
                    label="modal.settle.amount"
                    amount={state.amount}
                    onChange={onAmountChanged}
                    display_balance={balanceText}
                    asset={assetID}
                    assets={[assetID]}
                    tabIndex={1}
                    style={
                        state.amount > remainingVolume
                            ? ({"margin-bottom": "0"} as any)
                            : {}
                    }
                />
                {state.amount > remainingVolume ? (
                    <Fragment>
                        <Translate
                            className="facolor-info"
                            content="modal.settle.max_volume"
                            amount={maxSettlementVolume}
                            asset={assetFullName}
                        />
                        <br />
                        <Translate
                            className="facolor-info"
                            content="modal.settle.remaining_volume"
                            amount={remainingVolume}
                            asset={assetFullName}
                        />
                    </Fragment>
                ) : null}
            </Form>
        </React.Fragment>
    );

    return (
        <Modal
            title={counterpart.translate("modal.settle.title", {
                asset: assetFullName
            })}
            visible={visible}
            footer={!isPredictionMarket ? footer : null}
            onCancel={hideModal}
        >
            {modalContent}
        </Modal>
    );
}

const WrappedModalContent = AssetWrapper(ModalContent, {
    propNames: ["asset", "core"],
    withDynamic: true,
    defaultProps: {core: "2.0.0"}
} as any);

function SettleModal(props: any) {
    return <WrappedModalContent {...props} />;
}

export default SettleModal;
