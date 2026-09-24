// TypeScript/functional-component port of the legacy BuySell.jsx (Phase
// 4, docs/UI_MIGRATION_PLAN.md) - the buy/sell order form (price/amount
// /total/fee inputs, expiration picker, submit button, quick-deposit/
// borrow/settle actions). Security-sensitive per AGENTS.md: this is the
// form behind Exchange.jsx's real order-submission flow, though the
// actual transaction building/submission itself lives in Exchange.jsx's
// callback props (`onSubmit`/`onBuy`/`onDeposit`/`onBorrow`) - this
// component only computes what to display and which callback to invoke,
// so it is kept as a strictly mechanical, line-for-line translation with
// particular care around the submit button's disabled/enabled state and
// the bid/ask (`onSubmit(true)`/`onSubmit(false)`) wiring.
//
// Confirmed dead, dropped:
// - `_setPrice(price)`: defined, never called anywhere (the actual
//   "click to use this price" handler in `render()` calls the *prop*
//   `this.props.setPrice` directly, a different thing with a similar
//   name - not this method).
// - The local `const currentAccount = AccountStore.getState()
//   .currentAccount;` (and the now-unused `AccountStore` import): every
//   other place in the file reads `this.props.currentAccount` (a real,
//   passed-down prop) instead - this shadowing local is computed and
//   then never read anywhere.
//
// Structural changes:
// - `BindToChainState(BuySell)` only ever resolved one prop this way:
//   `balance: ChainTypes.ChainObject` (not `.isRequired`, so the
//   original never blocked rendering on it - confirmed by reading
//   `BindToChainState.jsx`'s `render()`, which only loading-gates
//   `required_props`). `quote`/`base` are plain already-resolved
//   Immutable objects passed directly by `Exchange.jsx`, not chain-type
//   props at all. Replaced with a small `BuySellContainer` that resolves
//   `balance` via `ChainStore.getObject(props.balance)` under
//   `useChainStoreTick()` and passes it straight through - no loading-
//   gate placeholder needed, matching the original's non-blocking
//   behavior for a non-required chain prop.
// - The real, meaningful `shouldComponentUpdate` (an explicit allowlist
//   of checked props - a genuine performance gate, not a no-op) is
//   preserved via `React.memo` with the exact logical-inverse
//   comparator; state-based comparisons (`isSettleModalVisible`,
//   `isQuickDepositVisible`) need no replication, since this component's
//   own `useState` updates always re-render it regardless of the memo
//   comparator.
// - `shouldComponentUpdate` also ran `_forceRender(nextProps)` as an
//   inline side effect: when `parentWidth` changes, it toggled local
//   `forceReRender` state true-then-false across two extra render
//   passes, purely so `render()`'s live `this.refs.order_form
//   .clientWidth` read (used to decide `singleColumnForm`) would be
//   re-measured once against the post-layout DOM (the *first* render
//   triggered by a `parentWidth` change still reflects the *previous*
//   layout, since React's render phase runs before that update commits
//   to the DOM). Replicated with a `clientWidth` state value, measured
//   in a `useLayoutEffect` keyed on `[parentWidth]` (mount-skipped, same
//   as the original - `_forceRender` is only ever invoked from inside
//   `shouldComponentUpdate`, which never runs on the initial mount
//   either) - this achieves the same "re-render once more after layout
//   settles" outcome as the original's double-toggle, more directly.
// - `getDatePickerRef`/`onExpirationSelectChange`/`onExpirationSelectClick`
//   /`onExpirationSelectBlur` mirror the identical pattern already
//   ported in `ScaledOrderTab.tsx` (a `useRef` for the antd `DatePicker`
//   instance plus two `useRef` booleans for the double-click-to-open
//   gesture).
//
// Preserved verbatim (not "fixed"): the "fee asset selection" block
// mutates the `feeAssets` *prop* array in place via `.splice(1, 1)`
// (rather than cloning it first) - a pre-existing mutation of caller-
// owned data, kept exactly as-is.
import * as React from "react";
import cnames from "classnames";
import classNames from "classnames";
import utils from "common/utils";
import Translate from "react-translate-component";
import TranslateWithLinks from "../Utility/TranslateWithLinks";
import counterpart from "counterpart";
import PriceText from "../Utility/PriceText";
import AssetName from "../Utility/AssetName";
import {Asset} from "common/MarketClasses";
import ExchangeInput from "./ExchangeInput";
import assetUtils from "common/asset_utils";
import {DatePicker} from "antd";
import moment from "moment";
import Icon from "../Icon/Icon";
import SettleModal from "../Modal/SettleModal";
import {Button, Select, Popover, Tooltip} from "bitshares-ui-style-guide";
import ReactTooltip from "react-tooltip";
import GatewayStore from "../../stores/GatewayStore";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface BuySellProps {
    type?: string;
    quote: any;
    base: any;
    amountChange: (...args: any[]) => any;
    priceChange: (...args: any[]) => any;
    totalChange: (...args: any[]) => any;
    onSubmit: (...args: any[]) => any;
    onExpirationTypeChange: (...args: any[]) => any;
    onExpirationCustomChange: (...args: any[]) => any;
    balance: any;
    balanceId?: string;
    balancePrecision: number;
    fee: any;
    isPredictionMarket?: boolean;
    currentPrice: any;
    currentPriceObject: any;
    feeAsset: any;
    feeAssets: any[];
    hasFeeBalance?: boolean;
    hideHeader?: boolean;
    verticalOrderForm?: boolean;
    amount?: any;
    price?: any;
    total?: any;
    account?: any;
    className?: any;
    styles?: any;
    isOpen?: boolean;
    singleColumnOrderForm?: boolean;
    hideFunctionButtons?: boolean;
    parentWidth?: any;
    expirationType: string;
    expirations: any;
    expirationCustomTime: any;
    onFlip?: (...args: any[]) => any;
    onTogglePosition?: (...args: any[]) => any;
    moveOrderForm?: (...args: any[]) => any;
    setPrice: (...args: any[]) => any;
    currentBridges?: any;
    backedCoin?: any;
    currentAccount?: any;
    onBuy: (...args: any[]) => any;
    onDeposit: (...args: any[]) => any;
    onBorrow?: (...args: any[]) => any;
    onChangeFeeAsset: (...args: any[]) => any;
}

function BuySellInner(props: BuySellProps) {
    const {
        type = "bid",
        quote,
        base,
        amountChange,
        fee,
        isPredictionMarket,
        priceChange,
        onSubmit,
        balance,
        totalChange,
        balancePrecision,
        currentPrice,
        currentPriceObject,
        hasFeeBalance,
        hideHeader,
        verticalOrderForm,
        expirationCustomTime,
        expirationType,
        expirations,
        parentWidth
    } = props;

    let feeAsset = props.feeAsset;
    const feeAssets = props.feeAssets;

    const [isSettleModalVisible, setIsSettleModalVisible] = React.useState(
        false
    );
    const [isQuickDepositVisible, setIsQuickDepositVisible] = React.useState(
        false
    );
    const [clientWidth, setClientWidth] = React.useState(0);

    const orderFormRef = React.useRef<HTMLFormElement>(null);
    const datePickerRef = React.useRef<any>(null);
    const firstClickRef = React.useRef(false);
    const secondClickRef = React.useRef(false);

    const isFirstParentWidthRender = React.useRef(true);
    React.useLayoutEffect(() => {
        if (isFirstParentWidthRender.current) {
            isFirstParentWidthRender.current = false;
            return;
        }
        if (orderFormRef.current) {
            setClientWidth(orderFormRef.current.clientWidth);
        }
    }, [parentWidth]);

    const getDatePickerRef = (node: any) => {
        datePickerRef.current = node;
    };

    const showSettleModal = () => {
        setIsSettleModalVisible(true);
    };

    const hideSettleModal = () => {
        setIsSettleModalVisible(false);
    };

    const addBalance = (balanceToAdd: any) => {
        if (type === "bid") {
            totalChange({
                target: {value: balanceToAdd.getAmount({real: true}).toString()}
            });
        } else {
            amountChange({
                target: {value: balanceToAdd.getAmount({real: true}).toString()}
            });
        }
    };

    const handleQuickDepositVisibleChange = (visible: boolean) => {
        setIsQuickDepositVisible(visible);
        if (visible) {
            setTimeout(() => {
                (ReactTooltip as any).rebuild();
            }, 20);
        }
    };

    const onDeposit = () => {
        setIsQuickDepositVisible(false);
        props.onDeposit();
    };

    const onBuy = () => {
        setIsQuickDepositVisible(false);
        props.onBuy();
    };

    const onExpirationSelectChange = (e: any) => {
        if (e.target.value === "SPECIFIC") {
            datePickerRef.current.picker.handleOpenChange(true);
        } else {
            datePickerRef.current.picker.handleOpenChange(false);
        }

        props.onExpirationTypeChange(e);
    };

    const onExpirationSelectClick = (e: any) => {
        if (e.target.value === "SPECIFIC") {
            if (firstClickRef.current) {
                secondClickRef.current = true;
            }
            firstClickRef.current = true;
            if (secondClickRef.current) {
                datePickerRef.current.picker.handleOpenChange(true);
                firstClickRef.current = false;
                secondClickRef.current = false;
            }
        }
    };

    const onExpirationSelectBlur = () => {
        firstClickRef.current = false;
        secondClickRef.current = false;
    };

    const singleColumnForm =
        clientWidth < 450 || props.singleColumnOrderForm ? true : false;

    let amount, price, total;

    if (props.amount) amount = props.amount;
    if (props.price) price = props.price;
    if (props.total) total = props.total;

    const balanceAmount = new Asset({
        amount: balance ? balance.get("balance") : 0,
        precision: balancePrecision,
        asset_id: props.balanceId
    });

    const maxBaseMarketFee = new Asset({
        amount: base.getIn(["options", "max_market_fee"]),
        asset_id: base.get("asset_id"),
        precision: base.get("precision")
    });
    const maxQuoteMarketFee = new Asset({
        amount: quote.getIn(["options", "max_market_fee"]),
        asset_id: quote.get("asset_id"),
        precision: quote.get("precision")
    });
    const baseMarketFeePercent =
        base.getIn(["options", "market_fee_percent"]) / 100 + "%";
    const quoteMarketFeePercent =
        quote.getIn(["options", "market_fee_percent"]) / 100 + "%";
    const quoteFee = !amount
        ? 0
        : Math.min(
              maxQuoteMarketFee.getAmount({real: true}),
              (amount * quote.getIn(["options", "market_fee_percent"])) / 10000
          ).toFixed(maxQuoteMarketFee.precision);
    const baseFee = !amount
        ? 0
        : Math.min(
              maxBaseMarketFee.getAmount({real: true}),
              (total * base.getIn(["options", "market_fee_percent"])) / 10000
          ).toFixed(maxBaseMarketFee.precision);
    const baseFlagBooleans = (assetUtils as any).getFlagBooleans(
        base.getIn(["options", "flags"]),
        base.has("bitasset_data_id")
    );
    const quoteFlagBooleans = (assetUtils as any).getFlagBooleans(
        quote.getIn(["options", "flags"]),
        quote.has("bitasset_data_id")
    );

    const {name: baseName, prefix: basePrefix} = (utils as any).replaceName(
        base
    );
    const baseMarketFee = baseFlagBooleans["charge_market_fee"] ? (
        verticalOrderForm ? (
            <Tooltip
                title={counterpart.translate("tooltip.market_fee", {
                    percent: baseMarketFeePercent,
                    asset: (basePrefix || "") + baseName
                })}
            >
                <div className="grid-block no-overflow wrap shrink">
                    <div className="small-12 buy-sell-label">
                        <Translate content="explorer.asset.summary.market_fee" />
                        , {baseMarketFeePercent}
                    </div>
                    <div className="inputAddon small-12">
                        <ExchangeInput
                            placeholder="0.0"
                            id="baseMarketFee"
                            defaultValue={baseFee}
                            value={baseFee}
                            addonAfter={
                                <span>
                                    <AssetName noTip name={base.get("symbol")} />
                                </span>
                            }
                        />
                    </div>
                </div>
            </Tooltip>
        ) : singleColumnForm ? (
            <Tooltip
                title={counterpart.translate("tooltip.market_fee", {
                    percent: baseMarketFeePercent,
                    asset: (basePrefix || "") + baseName
                })}
            >
                <div className="grid-block no-overflow wrap shrink">
                    <div className="small-3 buy-sell-label">
                        <Translate content="explorer.asset.summary.market_fee" />
                        , {baseMarketFeePercent}
                    </div>
                    <div className="inputAddon small-9">
                        <ExchangeInput
                            placeholder="0.0"
                            id="baseMarketFee"
                            defaultValue={baseFee}
                            value={baseFee}
                            addonAfter={
                                <span>
                                    <AssetName noTip name={base.get("symbol")} />
                                </span>
                            }
                        />
                    </div>
                </div>
            </Tooltip>
        ) : (
            <Tooltip
                title={counterpart.translate("tooltip.market_fee", {
                    percent: baseMarketFeePercent,
                    asset: (basePrefix || "") + baseName
                })}
            >
                <div className="grid-block no-overflow wrap shrink">
                    <div className="small-12 buy-sell-label">
                        <Translate content="explorer.asset.summary.market_fee" />
                        , {baseMarketFeePercent}
                    </div>
                    <div className="inputAddon small-12">
                        <ExchangeInput
                            placeholder="0.0"
                            id="baseMarketFee"
                            defaultValue={baseFee}
                            value={baseFee}
                            addonAfter={
                                <span>
                                    <AssetName noTip name={base.get("symbol")} />
                                </span>
                            }
                        />
                    </div>
                </div>
            </Tooltip>
        )
    ) : null;

    const {name: quoteName, prefix: quotePrefix} = (utils as any).replaceName(
        quote
    );
    const quoteMarketFee = quoteFlagBooleans["charge_market_fee"] ? (
        verticalOrderForm ? (
            <Tooltip
                title={counterpart.translate("tooltip.market_fee", {
                    percent: quoteMarketFeePercent,
                    asset: (quotePrefix || "") + quoteName
                })}
            >
                <div className="grid-block no-overflow wrap shrink">
                    <div className="small-12 buy-sell-label">
                        <Translate content="explorer.asset.summary.market_fee" />
                        , {quoteMarketFeePercent}
                    </div>
                    <div className="inputAddon small-12">
                        <ExchangeInput
                            placeholder="0.0"
                            id="quoteMarketFee"
                            defaultValue={quoteFee}
                            value={quoteFee}
                            addonAfter={
                                <span>
                                    <AssetName
                                        style={{width: 100}}
                                        noTip
                                        name={quote.get("symbol")}
                                    />
                                </span>
                            }
                        />
                    </div>
                </div>
            </Tooltip>
        ) : singleColumnForm ? (
            <Tooltip
                title={counterpart.translate("tooltip.market_fee", {
                    percent: quoteMarketFeePercent,
                    asset: (quotePrefix || "") + quoteName
                })}
            >
                <div className="grid-block no-overflow wrap shrink">
                    <div className="small-3 buy-sell-label">
                        <Translate content="explorer.asset.summary.market_fee" />
                        , {quoteMarketFeePercent}
                    </div>
                    <div className="inputAddon small-9">
                        <ExchangeInput
                            placeholder="0.0"
                            id="quoteMarketFee"
                            defaultValue={quoteFee}
                            value={quoteFee}
                            addonAfter={
                                <span>
                                    <AssetName
                                        style={{width: 100}}
                                        noTip
                                        name={quote.get("symbol")}
                                    />
                                </span>
                            }
                        />
                    </div>
                </div>
            </Tooltip>
        ) : (
            <Tooltip
                title={counterpart.translate("tooltip.market_fee", {
                    percent: quoteMarketFeePercent,
                    asset: (quotePrefix || "") + quoteName
                })}
            >
                <div className="grid-block no-overflow wrap shrink">
                    <div className="small-12 buy-sell-label">
                        <Translate content="explorer.asset.summary.market_fee" />
                        , {quoteMarketFeePercent}
                    </div>
                    <div className="inputAddon small-12">
                        <ExchangeInput
                            placeholder="0.0"
                            id="quoteMarketFee"
                            defaultValue={quoteFee}
                            value={quoteFee}
                            addonAfter={
                                <span>
                                    <AssetName
                                        style={{width: 100}}
                                        noTip
                                        name={quote.get("symbol")}
                                    />
                                </span>
                            }
                        />
                    </div>
                </div>
            </Tooltip>
        )
    ) : null;

    const emptyCell = !verticalOrderForm ? (
        <div
            style={{visibility: "hidden"}}
            className="grid-block no-overflow wrap shrink"
        >
            <div className="small-3 buy-sell-label">
                <Translate content="explorer.asset.summary.market_fee" />
            </div>
            <div className="inputAddon small-9">
                <ExchangeInput
                    placeholder="0.0"
                    id="emptyPlaceholder"
                    defaultValue="0"
                    addonAfter={
                        <span>
                            <AssetName
                                style={{width: 100}}
                                noTip
                                name={quote.get("symbol")}
                            />
                        </span>
                    }
                />
            </div>
        </div>
    ) : null;

    const isBid = type === "bid";
    const marketFee =
        isBid && quoteMarketFee
            ? quoteMarketFee
            : !isBid && baseMarketFee
            ? baseMarketFee
            : quoteMarketFee || baseMarketFee
            ? emptyCell
            : null;

    const hasBalance = isBid
        ? balanceAmount.getAmount({real: true}) >= parseFloat(total)
        : balanceAmount.getAmount({real: true}) >= parseFloat(amount);

    const forceSellText = isBid
        ? counterpart.translate("exchange.buy")
        : counterpart.translate("exchange.sell");

    const noBalance = isPredictionMarket
        ? false
        : !(balanceAmount.getAmount() > 0 && hasBalance);
    const invalidPrice = !(price > 0);
    const invalidAmount = !(amount > 0);

    const disabled = noBalance || invalidPrice || invalidAmount;

    const buttonClass = classNames(type, {
        disabled: disabled
    });
    const balanceSymbol = isBid ? base.get("symbol") : quote.get("symbol");

    const disabledText = invalidPrice
        ? counterpart.translate("exchange.invalid_price")
        : invalidAmount
        ? counterpart.translate("exchange.invalid_amount")
        : noBalance
        ? counterpart.translate("exchange.no_balance")
        : null;

    // Fee asset selection
    if (
        feeAssets[1] &&
        feeAssets[1].getIn([
            "options",
            "core_exchange_rate",
            "quote",
            "asset_id"
        ]) === "1.3.0" &&
        feeAssets[1].getIn([
            "options",
            "core_exchange_rate",
            "base",
            "asset_id"
        ]) === "1.3.0"
    ) {
        feeAsset = feeAssets[0];
        feeAssets.splice(1, 1);
    }
    let index = 0;
    const options = feeAssets.map(asset => {
        const {name, prefix} = (utils as any).replaceName(asset);
        return (
            <Select.Option key={asset.get("id")} value={index++}>
                {prefix}
                {name}
            </Select.Option>
        );
    });

    // Subtract fee from amount to sell
    let balanceToAdd;

    if (feeAsset.get("symbol") === balanceSymbol) {
        balanceToAdd = balanceAmount.clone(
            balanceAmount.getAmount() - fee.getAmount()
        );
    } else {
        balanceToAdd = balanceAmount;
    }

    let expirationTip;

    if (expirationType !== "SPECIFIC") {
        expirationTip = expirations[expirationType].get();
    }

    const expirationsOptionsList = Object.keys(expirations).map(key => (
        <option value={key} key={key}>
            {key === "SPECIFIC" && expirationCustomTime !== "Specific"
                ? moment(expirationCustomTime).format("Do MMM YYYY hh:mm A")
                : expirations[key].title}
        </option>
    ));

    const containerClass = "small-12";
    let formContent;

    // OrderForm is in panel
    if (verticalOrderForm) {
        formContent = (
            <div className={containerClass}>
                <div className="grid-block no-overflow wrap shrink">
                    <Translate
                        className="small-12 buy-sell-label"
                        content="exchange.price"
                    />
                    <div className="inputAddon small-12">
                        <ExchangeInput
                            id={`${type}Price`}
                            value={price}
                            onChange={priceChange}
                            autoComplete="off"
                            placeholder="0.0"
                            addonAfter={
                                <span>
                                    <AssetName
                                        dataPlace="right"
                                        name={base.get("symbol")}
                                    />
                                    &nbsp;/&nbsp;
                                    <AssetName
                                        dataPlace="right"
                                        name={quote.get("symbol")}
                                    />
                                </span>
                            }
                        />
                    </div>
                </div>
                <div className="grid-block no-overflow wrap shrink">
                    <Translate
                        className="small-12 buy-sell-label"
                        content="transfer.amount"
                    />
                    <div className="inputAddon small-12">
                        <ExchangeInput
                            id={`${type}Amount`}
                            value={amount}
                            onChange={amountChange}
                            autoComplete="off"
                            placeholder="0.0"
                            addonAfter={
                                <span>
                                    <AssetName
                                        dataPlace="right"
                                        name={quote.get("symbol")}
                                    />
                                </span>
                            }
                        />
                    </div>
                </div>
                <div className="grid-block no-overflow wrap shrink">
                    <Translate
                        className="small-12 buy-sell-label"
                        content="exchange.total"
                    />
                    <div className="inputAddon small-12">
                        <ExchangeInput
                            id={`${type}Total`}
                            value={total}
                            onChange={totalChange}
                            autoComplete="off"
                            placeholder="0.0"
                            addonAfter={
                                <span>
                                    <AssetName
                                        dataPlace="right"
                                        name={base.get("symbol")}
                                    />
                                </span>
                            }
                        />
                    </div>
                </div>
                <div className="grid-block no-overflow wrap shrink">
                    <Translate
                        className="small-12 buy-sell-label"
                        content="transfer.fee"
                    />
                    <div className="inputAddon small-12">
                        <ExchangeInput
                            id={`${type}Fee`}
                            placeholder="0.0"
                            defaultValue={
                                !hasFeeBalance
                                    ? counterpart.translate(
                                          "transfer.errors.insufficient"
                                      )
                                    : fee.getAmount({real: true})
                            }
                            disabled
                            addonAfter={
                                <Select
                                    style={{width: 100}}
                                    disabled={feeAssets.length === 1}
                                    defaultValue={feeAssets.indexOf(
                                        props.feeAsset
                                    )}
                                    onChange={props.onChangeFeeAsset}
                                >
                                    {options}
                                </Select>
                            }
                        />
                    </div>
                </div>
                {marketFee}
            </div>
        );
    } else {
        formContent = singleColumnForm ? (
            <div className={containerClass}>
                <div className="grid-block no-overflow wrap shrink">
                    <Translate
                        className="small-3 buy-sell-label"
                        content="exchange.price"
                    />
                    <div className="inputAddon small-9">
                        <ExchangeInput
                            id={`${type}Price`}
                            value={price}
                            onChange={priceChange}
                            autoComplete="off"
                            placeholder="0.0"
                            addonAfter={
                                <span>
                                    <AssetName
                                        dataPlace="right"
                                        name={base.get("symbol")}
                                    />
                                    &nbsp;/&nbsp;
                                    <AssetName
                                        dataPlace="right"
                                        name={quote.get("symbol")}
                                    />
                                </span>
                            }
                        />
                    </div>
                </div>
                <div className="grid-block no-overflow wrap shrink">
                    <Translate
                        className="small-3 buy-sell-label"
                        content="transfer.amount"
                    />
                    <div className="inputAddon small-9">
                        <ExchangeInput
                            id={`${type}Amount`}
                            value={amount}
                            onChange={amountChange}
                            autoComplete="off"
                            placeholder="0.0"
                            addonAfter={
                                <span>
                                    <AssetName
                                        dataPlace="right"
                                        name={quote.get("symbol")}
                                    />
                                </span>
                            }
                        />
                    </div>
                </div>
                <div className="grid-block no-overflow wrap shrink">
                    <Translate
                        className="small-3 buy-sell-label"
                        content="exchange.total"
                    />
                    <div className="inputAddon small-9">
                        <ExchangeInput
                            id={`${type}Total`}
                            value={total}
                            onChange={totalChange}
                            autoComplete="off"
                            placeholder="0.0"
                            addonAfter={
                                <span>
                                    <AssetName
                                        dataPlace="right"
                                        name={base.get("symbol")}
                                    />
                                </span>
                            }
                        />
                    </div>
                </div>
                <div className="grid-block no-overflow wrap shrink">
                    <Translate
                        className="small-3 buy-sell-label"
                        content="transfer.fee"
                    />
                    <div className="inputAddon small-9">
                        <ExchangeInput
                            id={`${type}Fee`}
                            placeholder="0.0"
                            value={
                                !hasFeeBalance
                                    ? counterpart.translate(
                                          "transfer.errors.insufficient"
                                      )
                                    : fee.getAmount({real: true})
                            }
                            disabled
                            addonAfter={
                                <Select
                                    style={{width: 100}}
                                    disabled={feeAssets.length === 1}
                                    defaultValue={feeAssets.indexOf(
                                        props.feeAsset
                                    )}
                                    onChange={props.onChangeFeeAsset}
                                >
                                    {options}
                                </Select>
                            }
                        />
                    </div>
                </div>
                {marketFee}
            </div>
        ) : (
            <div className={containerClass}>
                <div className="grid-block no-overflow wrap shrink">
                    <div className="small-6">
                        <div className="small-11 grid-block no-overflow wrap shrink">
                            <Translate
                                className="small-3 buy-sell-label"
                                content="exchange.price"
                            />
                            <div
                                className="small-9 buy-sell-label"
                                style={{textAlign: "right"}}
                            >
                                <span
                                    style={{
                                        borderBottom: "#A09F9F 1px dotted",
                                        cursor: "pointer"
                                    }}
                                    onClick={() =>
                                        props.setPrice(
                                            type,
                                            currentPriceObject.sellPrice()
                                        )
                                    }
                                >
                                    <PriceText
                                        price={currentPrice}
                                        quote={quote}
                                        base={base}
                                    />{" "}
                                </span>
                            </div>
                        </div>
                        <div className="inputAddon small-11">
                            <ExchangeInput
                                id={`${type}Price`}
                                value={price}
                                onChange={priceChange}
                                autoComplete="off"
                                placeholder="0.0"
                                addonAfter={
                                    <span>
                                        <AssetName
                                            dataPlace="right"
                                            name={base.get("symbol")}
                                        />
                                        &nbsp;/&nbsp;
                                        <AssetName
                                            dataPlace="right"
                                            name={quote.get("symbol")}
                                        />
                                    </span>
                                }
                            />
                        </div>
                    </div>
                    <div className="small-6">
                        <div className="small-12 grid-block no-overflow wrap shrink">
                            <Translate
                                className="small-3 buy-sell-label"
                                content="exchange.total"
                            />
                            <div
                                className="small-9 buy-sell-label"
                                style={{textAlign: "right"}}
                            >
                                <Translate
                                    className="small-3 buy-sell-label"
                                    content="exchange.balance"
                                />
                                &nbsp;
                                <span
                                    style={{
                                        borderBottom: "#A09F9F 1px dotted",
                                        cursor: "pointer"
                                    }}
                                    onClick={() => addBalance(balanceToAdd)}
                                >
                                    {(utils as any).format_number(
                                        balanceAmount.getAmount({real: true}),
                                        balancePrecision
                                    )}{" "}
                                </span>
                            </div>
                        </div>

                        <div className="inputAddon small-12">
                            <ExchangeInput
                                id={`${type}Total`}
                                value={total}
                                onChange={totalChange}
                                autoComplete="off"
                                placeholder="0.0"
                                addonAfter={
                                    <span>
                                        <AssetName
                                            dataPlace="right"
                                            name={base.get("symbol")}
                                        />
                                    </span>
                                }
                            />
                        </div>
                    </div>
                </div>
                <div className="grid-block no-overflow wrap shrink">
                    <div className="small-6">
                        <Translate
                            className="small-3 buy-sell-label"
                            content="transfer.amount"
                        />
                        <div className="inputAddon small-11">
                            <ExchangeInput
                                id={`${type}Amount`}
                                value={amount}
                                onChange={amountChange}
                                autoComplete="off"
                                placeholder="0.0"
                                addonAfter={
                                    <span>
                                        <AssetName
                                            dataPlace="right"
                                            name={quote.get("symbol")}
                                        />
                                    </span>
                                }
                            />
                        </div>
                    </div>
                    <div className="small-6">
                        <Translate
                            className="small-3 buy-sell-label"
                            content="transfer.fee"
                        />
                        <div className="inputAddon small-12">
                            <ExchangeInput
                                id={`${type}Fee`}
                                placeholder="0.0"
                                defaultValue={
                                    !hasFeeBalance
                                        ? counterpart.translate(
                                              "transfer.errors.insufficient"
                                          )
                                        : fee.getAmount({real: true})
                                }
                                disabled
                                addonAfter={
                                    <Select
                                        style={{width: 100}}
                                        disabled={feeAssets.length === 1}
                                        defaultValue={feeAssets.indexOf(
                                            props.feeAsset
                                        )}
                                        onChange={props.onChangeFeeAsset}
                                    >
                                        {options}
                                    </Select>
                                }
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const otherAsset = isBid ? base : quote;
    const isBitAsset = !!otherAsset.get("bitasset");
    // check if globally settled
    const isGloballySettled =
        isBitAsset && otherAsset.get("bitasset").get("settlement_fund") > 0;

    return (
        <div className={cnames(props.className)} style={props.styles}>
            <div className="buy-sell-container" style={{paddingRight: 5}}>
                {!hideHeader ? (
                    <div
                        className={
                            "exchange-content-header exchange-content-header--buy-sell-form " +
                            type
                        }
                    >
                        <span>
                            <TranslateWithLinks
                                string="exchange.buysell_formatter"
                                noLink
                                noTip
                                keys={[
                                    {
                                        type: "asset",
                                        value: quote.get("symbol"),
                                        arg: "asset"
                                    },
                                    {
                                        type: "translate",
                                        value: isPredictionMarket
                                            ? "exchange.short"
                                            : isBid
                                            ? "exchange.buy"
                                            : "exchange.sell",
                                        arg: "direction"
                                    }
                                ]}
                            />
                        </span>
                        {props.onFlip && !props.hideFunctionButtons ? (
                            <span
                                onClick={props.onFlip}
                                style={{
                                    cursor: "pointer",
                                    fontSize: "1rem"
                                }}
                                className="flip-arrow"
                            >
                                {" "}
                                &#8646;
                            </span>
                        ) : null}
                        {props.onTogglePosition && !props.hideFunctionButtons ? (
                            <span
                                onClick={props.onTogglePosition}
                                style={{
                                    cursor: "pointer",
                                    fontSize: "1rem"
                                }}
                                className="flip-arrow"
                            >
                                {" "}
                                &#8645;
                            </span>
                        ) : null}
                        {props.moveOrderForm && !props.hideFunctionButtons ? (
                            <Icon
                                onClick={props.moveOrderForm}
                                name="thumb-tack"
                                className="icon-14px icon-fill order-book-button-v"
                                style={{marginLeft: 5}}
                            />
                        ) : null}
                    </div>
                ) : null}

                <form
                    ref={orderFormRef}
                    className={
                        (!props.isOpen ? "hide-container " : "") + "order-form"
                    }
                    style={{fontSize: "14px"}}
                    noValidate
                >
                    <div className="grid-block no-overflow wrap shrink">
                        {props.moveOrderForm && verticalOrderForm ? (
                            <div
                                style={{width: "100%", textAlign: "right"}}
                                onClick={props.moveOrderForm}
                            >
                                <Icon
                                    name="thumb-tack"
                                    className="icon-18px icon-fill order-book-button-v"
                                />
                            </div>
                        ) : null}
                        {formContent}
                    </div>

                    <div className="grid-block no-overflow wrap shrink">
                        <div
                            className={
                                singleColumnForm
                                    ? "small-12 grid-block"
                                    : "small-6"
                            }
                        >
                            <Translate
                                className="small-4 buy-sell-label"
                                content="transaction.expiration"
                            />
                            <div className="small-8 expiration-datetime-picker">
                                <DatePicker
                                    ref={getDatePickerRef}
                                    className="expiration-datetime-picker--hidden"
                                    showTime
                                    showToday={false}
                                    disabledDate={(current: any) =>
                                        current < moment().add(59, "minutes")
                                    }
                                    value={
                                        expirationCustomTime !== "Specific"
                                            ? expirationCustomTime
                                            : moment().add(1, "hour")
                                    }
                                    onChange={props.onExpirationCustomChange}
                                />
                                <select
                                    className="cursor-pointer"
                                    onChange={onExpirationSelectChange}
                                    onClick={onExpirationSelectClick}
                                    onBlur={onExpirationSelectBlur}
                                    data-tip={
                                        expirationTip &&
                                        moment(expirationTip).format(
                                            "Do MMM YYYY hh:mm A"
                                        )
                                    }
                                    value={expirationType}
                                >
                                    {expirationsOptionsList}
                                </select>
                            </div>
                        </div>
                        {!singleColumnForm ? (
                            <div className="small-6">{marketFee}</div>
                        ) : null}
                        <div className="small-12 medium-12 xlarge-12">
                            {singleColumnForm ? (
                                <div className="grid-block no-overflow wrap shrink">
                                    <Translate
                                        className="small-4 buy-sell-label"
                                        content={
                                            isBid
                                                ? "exchange.lowest_ask"
                                                : "exchange.highest_bid"
                                        }
                                    />
                                    <div className="small-8 buy-sell-label">
                                        <span
                                            style={{
                                                borderBottom:
                                                    "#A09F9F 1px dotted",
                                                cursor: "pointer"
                                            }}
                                            onClick={() =>
                                                props.setPrice(
                                                    type,
                                                    currentPriceObject.sellPrice()
                                                )
                                            }
                                        >
                                            <PriceText
                                                price={currentPrice}
                                                quote={quote}
                                                base={base}
                                            />{" "}
                                            <AssetName
                                                name={base.get("symbol")}
                                                noTip
                                            />
                                            /
                                            <AssetName
                                                name={quote.get("symbol")}
                                                noTip
                                            />
                                        </span>
                                    </div>
                                </div>
                            ) : null}
                            {singleColumnForm ? (
                                <div className="grid-block no-overflow wrap shrink">
                                    <Translate
                                        className="small-4 buy-sell-label"
                                        content="exchange.balance"
                                    />
                                    <div className="small-8 buy-sell-label">
                                        <span
                                            style={{
                                                borderBottom:
                                                    "#A09F9F 1px dotted",
                                                cursor: "pointer"
                                            }}
                                            onClick={() =>
                                                addBalance(balanceToAdd)
                                            }
                                        >
                                            {(utils as any).format_number(
                                                balanceAmount.getAmount({
                                                    real: true
                                                }),
                                                balancePrecision
                                            )}{" "}
                                            <AssetName
                                                name={balanceSymbol}
                                                noTip
                                            />
                                        </span>
                                    </div>
                                </div>
                            ) : null}
                            <div style={{marginTop: 10}}>
                                <div>
                                    <Tooltip
                                        placement="top"
                                        title={disabledText ? disabledText : ""}
                                    >
                                        <Button
                                            className={
                                                disabled ? undefined : buttonClass
                                            }
                                            disabled={disabled}
                                            onClick={() => onSubmit(true)}
                                            type="primary"
                                            style={{margin: 5}}
                                        >
                                            {isBid ? "Buy" : "Sell"}
                                        </Button>
                                    </Tooltip>

                                    {props.currentBridges &&
                                    !props.backedCoin ? (
                                        <Tooltip
                                            title={
                                                (GatewayStore as any).isDown(
                                                    "TRADE"
                                                )
                                                    ? counterpart.translate(
                                                          "external_service_provider.is_down"
                                                      )
                                                    : counterpart.translate(
                                                          "exchange.quick_deposit_bridge",
                                                          {
                                                              target: isBid
                                                                  ? baseName
                                                                  : quoteName
                                                          }
                                                      )
                                            }
                                        >
                                            <Button
                                                style={{margin: 5}}
                                                onClick={() => props.onBuy()}
                                                disabled={
                                                    (GatewayStore as any).isDown(
                                                        "TRADE"
                                                    ) ||
                                                    !props.currentAccount ||
                                                    props.currentAccount.get(
                                                        "id"
                                                    ) === "1.2.3"
                                                }
                                            >
                                                <Translate
                                                    content="exchange.quick_deposit"
                                                    asset={
                                                        isBid
                                                            ? baseName
                                                            : quoteName
                                                    }
                                                />
                                            </Button>
                                        </Tooltip>
                                    ) : null}
                                    {props.backedCoin &&
                                    !props.currentBridges ? (
                                        <Tooltip
                                            title={
                                                (GatewayStore as any).isDown(
                                                    "OPEN"
                                                )
                                                    ? counterpart.translate(
                                                          "external_service_provider.is_down"
                                                      )
                                                    : counterpart.translate(
                                                          "tooltip.gateway"
                                                      )
                                            }
                                        >
                                            <Button
                                                style={{margin: 5}}
                                                onClick={() => props.onDeposit()}
                                                disabled={
                                                    (GatewayStore as any).isDown(
                                                        "OPEN"
                                                    ) ||
                                                    !props.currentAccount ||
                                                    props.currentAccount.get(
                                                        "id"
                                                    ) === "1.2.3"
                                                }
                                            >
                                                <Translate
                                                    content="exchange.quick_deposit"
                                                    asset={
                                                        isBid
                                                            ? baseName
                                                            : quoteName
                                                    }
                                                />
                                            </Button>
                                        </Tooltip>
                                    ) : null}
                                    {props.currentBridges &&
                                    props.backedCoin ? (
                                        <Popover
                                            title={
                                                <Translate
                                                    content="exchange.quick_deposit"
                                                    asset={
                                                        isBid
                                                            ? baseName
                                                            : quoteName
                                                    }
                                                />
                                            }
                                            trigger="click"
                                            visible={isQuickDepositVisible}
                                            onVisibleChange={
                                                handleQuickDepositVisibleChange
                                            }
                                            content={
                                                <div>
                                                    <Tooltip
                                                        title={
                                                            (GatewayStore as any).isDown(
                                                                "OPEN"
                                                            )
                                                                ? counterpart.translate(
                                                                      "external_service_provider.is_down"
                                                                  )
                                                                : counterpart.translate(
                                                                      "exchange.quick_deposit_gateway",
                                                                      {
                                                                          asset: isBid
                                                                              ? baseName
                                                                              : quoteName
                                                                      }
                                                                  )
                                                        }
                                                    >
                                                        <Button
                                                            style={{
                                                                marginRight: 5
                                                            }}
                                                            onClick={onDeposit}
                                                            disabled={(GatewayStore as any).isDown(
                                                                "OPEN"
                                                            )}
                                                        >
                                                            <Translate content="exchange.quick_deposit_gateway_button" />
                                                        </Button>
                                                    </Tooltip>

                                                    <Tooltip
                                                        title={
                                                            (GatewayStore as any).isDown(
                                                                "TRADE"
                                                            )
                                                                ? counterpart.translate(
                                                                      "external_service_provider.is_down"
                                                                  )
                                                                : counterpart.translate(
                                                                      "exchange.quick_deposit_bridge",
                                                                      {
                                                                          target: isBid
                                                                              ? baseName
                                                                              : quoteName
                                                                      }
                                                                  )
                                                        }
                                                    >
                                                        <Button
                                                            onClick={onBuy}
                                                            disabled={(GatewayStore as any).isDown(
                                                                "TRADE"
                                                            )}
                                                        >
                                                            <Translate content="exchange.quick_deposit_bridge_button" />
                                                        </Button>
                                                    </Tooltip>
                                                </div>
                                            }
                                        >
                                            <Tooltip
                                                title={counterpart.translate(
                                                    "exchange.quick_deposit_tooltip",
                                                    {
                                                        asset: isBid
                                                            ? baseName
                                                            : quoteName
                                                    }
                                                )}
                                            >
                                                <Button
                                                    style={{margin: 5}}
                                                    disabled={
                                                        !props.currentAccount ||
                                                        props.currentAccount.get(
                                                            "id"
                                                        ) === "1.2.3"
                                                    }
                                                >
                                                    <Translate
                                                        content="exchange.quick_deposit"
                                                        asset={
                                                            isBid
                                                                ? baseName
                                                                : quoteName
                                                        }
                                                    />
                                                </Button>
                                            </Tooltip>
                                        </Popover>
                                    ) : null}
                                    {props.onBorrow && !isGloballySettled ? (
                                        <Button
                                            style={{margin: 5}}
                                            disabled={
                                                !props.currentAccount ||
                                                props.currentAccount.get(
                                                    "id"
                                                ) === "1.2.3"
                                            }
                                            onClick={props.onBorrow}
                                        >
                                            <Translate content="exchange.borrow" />
                                        </Button>
                                    ) : null}
                                    {isGloballySettled ? (
                                        <Button
                                            style={{margin: 5}}
                                            disabled={
                                                !props.currentAccount ||
                                                props.currentAccount.get(
                                                    "id"
                                                ) === "1.2.3"
                                            }
                                            onClick={showSettleModal}
                                            data-tip={counterpart.translate(
                                                "exchange.settle_globally_settled_tooltip"
                                            )}
                                        >
                                            <Translate content="exchange.settle_globally_settled" />
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="grid-content clear-fix no-padding">
                            {/* SHORT button */}
                            {disabledText && isPredictionMarket ? (
                                <Tooltip title={disabledText} placement="right">
                                    <div
                                        style={{paddingRight: 10}}
                                        className="float-right"
                                    >
                                        <input
                                            style={{margin: 0}}
                                            className={buttonClass}
                                            type="submit"
                                            onClick={() => onSubmit(false)}
                                            value={forceSellText}
                                        />
                                    </div>
                                </Tooltip>
                            ) : isPredictionMarket ? (
                                <Tooltip title={""} placement="right">
                                    <div
                                        style={{paddingRight: 10}}
                                        className="float-right"
                                    >
                                        <input
                                            style={{margin: 0}}
                                            className={buttonClass}
                                            type="submit"
                                            onClick={() => onSubmit(false)}
                                            value={forceSellText}
                                        />
                                    </div>
                                </Tooltip>
                            ) : null}
                        </div>
                    </div>
                </form>
            </div>

            {isGloballySettled && !!props.currentAccount && (
                <SettleModal
                    visible={isSettleModalVisible}
                    hideModal={hideSettleModal}
                    showModal={showSettleModal}
                    asset={otherAsset.get("id")}
                    account={props.currentAccount}
                />
            )}
        </div>
    );
}

function buySellPropsAreEqual(prevProps: BuySellProps, nextProps: BuySellProps) {
    return !(
        nextProps.amount !== prevProps.amount ||
        nextProps.onBorrow !== prevProps.onBorrow ||
        nextProps.total !== prevProps.total ||
        nextProps.currentPrice !== prevProps.currentPrice ||
        nextProps.price !== prevProps.price ||
        nextProps.balance !== prevProps.balance ||
        nextProps.account !== prevProps.account ||
        nextProps.className !== prevProps.className ||
        (nextProps.fee && prevProps.fee
            ? nextProps.fee.ne(prevProps.fee)
            : false) ||
        nextProps.isPredictionMarket !== prevProps.isPredictionMarket ||
        nextProps.feeAsset !== prevProps.feeAsset ||
        nextProps.isOpen !== prevProps.isOpen ||
        nextProps.hasFeeBalance !== prevProps.hasFeeBalance ||
        nextProps.expirationType !== prevProps.expirationType ||
        nextProps.expirationCustomTime !== prevProps.expirationCustomTime ||
        nextProps.parentWidth !== prevProps.parentWidth ||
        nextProps.singleColumnOrderForm !== prevProps.singleColumnOrderForm ||
        nextProps.hideFunctionButtons !== prevProps.hideFunctionButtons
    );
}

const MemoizedBuySell = React.memo(BuySellInner, buySellPropsAreEqual);

function BuySellContainer(props: any) {
    useChainStoreTick();
    const balance = props.balance
        ? (ChainStore as any).getObject(props.balance)
        : props.balance;

    return <MemoizedBuySell {...props} balance={balance} />;
}

export default BuySellContainer;
