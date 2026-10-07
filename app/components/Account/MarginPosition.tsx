// TypeScript/functional-component port of the legacy MarginPosition.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `_onClosePosition` builds and
// submits a `call_order_update` operation via `WalletApi
// .new_transaction()`/`WalletDb.process_transaction()` - transcribed
// verbatim, no restructuring.
//
// The dynamic string ref (`ref={this.state.modalRef}`, read back via
// `this.refs[this.state.modalRef].show()`) is a *real*, load-bearing ref
// (unlike several confirmed-dead refs dropped in earlier batches) -
// replaced with a plain `useRef()` object ref. This still works because
// `BorrowModal` (the ref target) is still a class component (`.jsx`),
// so a ref naturally resolves to its instance either way.
//
// Structural change (not a behavior change): `BindToChainState(Component,
// {tempComponent: "tr"})` (optional `object`, required `debtAsset`/
// `collateralAsset`) replaced by a Container under `useChainStoreTick()`,
// replicating the `tempComponent` fallback (`<tr />` while required
// props are unresolved) exactly, per the same pattern used for
// `AccountWhitelist.tsx`'s `AccountRow` in an earlier batch.
//
// Dropped as confirmed dead (visible directly in the file): `state
// .hasOrder`, set once in the constructor but never read anywhere else -
// `render()` recomputes an equivalent `has_order` local from the current
// `object` prop directly instead.
//
// `getCRTip`'s original `if (!statusClass || statusClass === "")` is
// simplified to `if (!statusClass)` - `""` is already falsy, so the
// second clause was always dead; TS flags the redundant comparison as
// a type error once `getStatusClass`'s return type is inferred, and the
// simplification is behaviorally identical.
//
//  Given a collateral position object (call order) and account,
//  display it in a pretty way, in case no call order id was provided -
//  display a placeholder
//
//  Expects property, 'object' which should be a call order id
//  and another property called 'account' which should be an
//  account
import * as React from "react";
import FormattedAsset from "../Utility/FormattedAsset";
import FormattedPrice from "../Utility/FormattedPrice";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import AssetName from "../Utility/AssetName";
import BorrowModal from "../Modal/BorrowModal";
import WalletApi from "api/WalletApi";
import WalletDb from "stores/WalletDb";
import utils from "common/utils";
import counterpart from "counterpart";
import Icon from "../Icon/Icon";
import TotalBalanceValue from "../Utility/TotalBalanceValue";
import {List} from "immutable";
import {Link} from "react-router-dom";
import {Tooltip} from "../../design-system/Tooltip";
import {Icon as AntIcon} from "../../design-system/Icon";
import asset_utils from "../../lib/common/asset_utils";

const alignRight: React.CSSProperties = {textAlign: "right"};
const alignLeft: React.CSSProperties = {textAlign: "left"};

const LinkComponent = Link as React.ComponentType<any>;

interface MarginPositionCoreProps {
    object?: any;
    debtAsset: any;
    collateralAsset: any;
    account: any;
}

function MarginPosition({
    object,
    debtAsset,
    collateralAsset,
    account
}: MarginPositionCoreProps) {
    const has_order_init = object != null;
    const [modalRef_] = React.useState(
        () =>
            "cp_modal_" +
            (has_order_init
                ? object.getIn(["call_price", "quote", "asset_id"])
                : debtAsset.get("id"))
    );
    const [isBorrowModalVisible, setIsBorrowModalVisible] = React.useState(false);
    const modalRef = React.useRef<any>(null);

    const showBorrowModal = () => {
        setIsBorrowModalVisible(true);
    };

    const hideBorrowModal = () => {
        setIsBorrowModalVisible(false);
    };

    const onUpdatePosition = (e: any) => {
        e.preventDefault();
        modalRef.current.show();
    };

    const getFeedPrice = () => {
        return (
            1 /
            utils.get_asset_price(
                asset_utils
                    .extractRawFeedPrice(debtAsset)
                    .getIn(["quote", "amount"]),
                collateralAsset,
                asset_utils
                    .extractRawFeedPrice(debtAsset)
                    .getIn(["base", "amount"]),
                debtAsset
            )
        );
    };

    const onClosePosition = (e: any) => {
        e.preventDefault();
        const tr = (WalletApi as any).new_transaction();

        tr.add_type_operation("call_order_update", {
            fee: {
                amount: 0,
                asset_id: 0
            },
            funding_account: object.get("borrower"),
            delta_collateral: {
                amount: -object.get("collateral"),
                asset_id: object.getIn(["call_price", "base", "asset_id"])
            },
            delta_debt: {
                amount: -object.get("debt"),
                asset_id: object.getIn(["call_price", "quote", "asset_id"])
            }
        });

        (WalletDb as any).process_transaction(tr, null, true);
    };

    // how many units of the debt asset the borrower has
    // in his/her wallet. This has nothing to do with
    // how many of the asset the borrower has borrowed.
    const getBalance = () => {
        // the debt asset id which we want to display
        let row_asset_id = null;

        // in case we displaying a margin position, not a placeholder
        if (object != null) {
            row_asset_id = object.getIn(["call_price", "quote", "asset_id"]);
        } else {
            row_asset_id = debtAsset.get("id");
        }

        const account_balances = account.get("balances");

        let balance = 0;

        // for every debt the account has, we iterate
        // through every balance the user has
        if (account_balances) {
            account_balances.forEach((a: any, asset_type: any) => {
                if (asset_type == row_asset_id) {
                    const balanceObject = ChainStore.getObject(a);

                    // get the balance
                    balance = balanceObject.get("balance");
                }
            });
        }

        // it's possible that the account doesn't hold
        // any of the asset here
        return balance;
    };

    const getCollateralRatio = () => {
        const co = object.toJS();
        const c = utils.get_asset_amount(co.collateral, collateralAsset);
        const d = utils.get_asset_amount(co.debt, debtAsset);
        return c / (d / getFeedPrice());
    };

    const getMR = () => {
        return (
            debtAsset.getIn([
                "bitasset",
                "current_feed",
                "maintenance_collateral_ratio"
            ]) / 1000
        );
    };

    const getStatusClass = () => {
        const cr = getCollateralRatio();
        const mr = getMR();

        if (isNaN(cr)) return null;
        if (cr < mr) {
            return "danger";
        } else if (cr < mr + 0.5) {
            return "warning";
        } else {
            return "";
        }
    };

    const getCRTip = () => {
        const statusClass = getStatusClass();
        const mr = getMR();
        if (!statusClass) return null;

        if (statusClass === "danger") {
            return counterpart.translate("tooltip.cr_danger", {mr});
        } else if (statusClass === "warning") {
            return counterpart.translate("tooltip.cr_warning", {mr});
        } else {
            return null;
        }
    };

    const getTargetCollateralRatio = () => {
        const co = object && object.toJS();

        return co && !isNaN(co.target_collateral_ratio)
            ? co.target_collateral_ratio / 1000
            : 0;
    };

    const has_order = object != null;
    const balance = getBalance();
    const co = has_order ? object.toJS() : null;

    const {isBitAsset} = utils.replaceName(debtAsset);

    const isPrediction =
        debtAsset.get("bitasset") &&
        debtAsset.getIn(["bitasset", "is_prediction_market"]);

    const settlement_fund = debtAsset.getIn(["bitasset", "settlement_fund"]);

    const mcr = debtAsset.getIn([
        "bitasset",
        "current_feed",
        "maintenance_collateral_ratio"
    ]);

    const hasGlobalSettlement = settlement_fund > 0 ? true : false;

    const balance_asset = has_order
        ? co.call_price.quote.asset_id
        : debtAsset.get("id");
    const debt_amount = has_order ? co.debt : 0;
    const collateral_amount = has_order ? co.collateral : 0;
    const collateral_asset = has_order
        ? co.call_price.base.asset_id
        : collateralAsset.get("id");
    const target_collateral_ratio = getTargetCollateralRatio();

    return (
        <tr className="margin-row">
            <td style={alignLeft}>
                <LinkComponent to={`/asset/${debtAsset.get("symbol")}`}>
                    <AssetName noTip name={debtAsset.get("symbol")} />
                </LinkComponent>
            </td>
            <td style={alignRight}>
                <FormattedAsset amount={balance} asset={balance_asset} hide_asset />
            </td>
            <td style={alignRight}>
                <FormattedAsset
                    amount={debt_amount}
                    asset={balance_asset}
                    hide_asset
                />
            </td>
            <td style={alignRight} className="column-hide-medium">
                <FormattedAsset
                    decimalOffset={3}
                    amount={collateral_amount}
                    asset={collateral_asset}
                />
            </td>
            {has_order ? (
                <td
                    data-place="bottom"
                    data-tip={getCRTip()}
                    className={"center-content " + getStatusClass()}
                >
                    {isPrediction
                        ? "1:1"
                        : utils.format_number(getCollateralRatio(), 2)}
                </td>
            ) : (
                <td />
            )}
            <td>
                {target_collateral_ratio && !isPrediction
                    ? utils.format_number(target_collateral_ratio, 2)
                    : null}
            </td>
            <td style={alignRight}>
                {has_order ? (
                    <TotalBalanceValue
                        noTip
                        balances={List()}
                        debt={{[debtAsset.get("id")]: co.debt}}
                        collateral={{
                            [collateralAsset.get("id")]: parseInt(
                                co.collateral,
                                10
                            )
                        }}
                        hide_asset
                    />
                ) : null}
            </td>
            <td style={alignRight} className={"column-hide-small"}>
                {has_order ? (
                    isPrediction ? (
                        "-"
                    ) : (
                        <FormattedPrice
                            base_amount={collateral_amount}
                            base_asset={collateralAsset.get("id")}
                            quote_amount={debt_amount * (mcr / 1000)}
                            quote_asset={debtAsset.get("id")}
                            hide_symbols
                        />
                    )
                ) : null}
            </td>
            <td style={alignRight} className={"column-hide-small"}>
                {has_order ? (
                    isPrediction ? (
                        "1"
                    ) : (
                        <FormattedPrice
                            base_amount={asset_utils
                                .extractRawFeedPrice(debtAsset)
                                .getIn(["base", "amount"])}
                            base_asset={co.call_price.quote.asset_id}
                            quote_amount={asset_utils
                                .extractRawFeedPrice(debtAsset)
                                .getIn(["quote", "amount"])}
                            quote_asset={co.call_price.base.asset_id}
                            hide_symbols
                        />
                    )
                ) : null}
            </td>
            <td className={"center-content column-hide-small"} style={alignLeft}>
                {has_order ? (
                    <FormattedPrice
                        base_amount={co.call_price.base.amount}
                        base_asset={co.call_price.base.asset_id}
                        quote_amount={co.call_price.quote.amount}
                        quote_asset={co.call_price.quote.asset_id}
                        hide_value
                    />
                ) : null}
            </td>
            <td style={{textAlign: "center"}}>
                <LinkComponent
                    to={`/market/${debtAsset.get(
                        "symbol"
                    )}_${collateralAsset.get("symbol")}`}
                >
                    <Icon
                        name="trade"
                        title="icons.trade.trade"
                        className="icon-14px"
                        style={{marginRight: 5}}
                    />
                </LinkComponent>
            </td>
            <td>
                {hasGlobalSettlement ? (
                    <Tooltip
                        placement={"left"}
                        title={counterpart.translate("tooltip.borrow_disabled", {
                            asset: isBitAsset
                                ? "bit" + `${debtAsset.get("symbol")}`
                                : `${debtAsset.get("symbol")}`
                        })}
                    >
                        <div style={{paddingBottom: 5}}>
                            <AntIcon type={"question-circle"} />
                        </div>
                    </Tooltip>
                ) : (
                    <Tooltip
                        placement={"left"}
                        title={counterpart.translate("tooltip.update_position")}
                    >
                        <div style={{paddingBottom: 5}}>
                            <a onClick={onUpdatePosition}>
                                <Icon
                                    name="adjust"
                                    title="icons.adjust"
                                    className="icon-14px rotate90"
                                />
                            </a>
                        </div>
                    </Tooltip>
                )}
            </td>
            <td>
                {has_order ? (
                    <div
                        data-place="left"
                        data-tip={counterpart.translate(
                            "tooltip.close_position",
                            {
                                amount: utils.get_asset_amount(
                                    co.debt,
                                    debtAsset
                                ),
                                asset: debtAsset.get("symbol")
                            }
                        )}
                        style={{paddingBottom: 5}}
                    >
                        <a onClick={onClosePosition}>
                            <Icon
                                name="cross-circle"
                                title="icons.cross_circle.close_position"
                                className="icon-14px"
                            />
                        </a>
                    </div>
                ) : null}
                {debtAsset ? (
                    <BorrowModal
                        visible={isBorrowModalVisible}
                        showModal={showBorrowModal}
                        hideModal={hideBorrowModal}
                        ref={modalRef}
                        modalId={modalRef_}
                        quoteAssetObj={balance_asset}
                        backingAssetObj={debtAsset.getIn([
                            "bitasset",
                            "options",
                            "short_backing_asset"
                        ])}
                        accountObj={account}
                    />
                ) : null}
            </td>
        </tr>
    );
}

interface MarginPositionContainerProps {
    object?: any;
    debtAsset: any;
    collateralAsset: any;
    account: any;
}

function MarginPositionContainer({
    object,
    debtAsset,
    collateralAsset,
    account
}: MarginPositionContainerProps) {
    useChainStoreTick();
    const resolvedObject = object ? ChainStore.getObject(object) : object;
    const resolvedDebtAsset = ChainStore.getAsset(debtAsset);
    const resolvedCollateralAsset = ChainStore.getAsset(collateralAsset);

    if (!resolvedDebtAsset || !resolvedCollateralAsset) {
        return <tr />;
    }

    return (
        <MarginPosition
            object={resolvedObject}
            debtAsset={resolvedDebtAsset}
            collateralAsset={resolvedCollateralAsset}
            account={account}
        />
    );
}

export default MarginPositionContainer;
