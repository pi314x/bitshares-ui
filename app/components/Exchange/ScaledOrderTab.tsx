// TypeScript/functional-component port of the legacy ScaledOrderTab.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - the "place a scaled order" tab
// shown alongside the regular BuySell limit-order form, wired to
// Exchange.jsx's real _createScaledOrder handler (submits real limit
// orders via MarketsActions.createLimitOrder2). Security-sensitive per
// AGENTS.md: kept as a mechanical, line-for-line translation of the
// financial-math and order-preparation logic, no behavior changes.
//
// Confirmed dead, dropped:
// - `Col`/`Row` (bitshares-ui-style-guide) and `TranslateWithLinks`
//   imports: never referenced anywhere in the file.
// - `_getPreviewDataSource()`: defined, never called anywhere.
// - `ScaledOrderTab.handleCancel()`/its `hideModal` prop: bound in the
//   constructor but never invoked from render (no Cancel button calls
//   it), and neither of Exchange.jsx's two <ScaledOrderTab> call sites
//   ever pass a `hideModal` prop - calling it would throw.
//
// NOT dead, preserved exactly despite looking unused: `actionRadio`
// (`getFieldDecorator("action", {initialValue: ...})(<Radio.Group>...)`)
// is computed every render but its result is never placed into the
// returned JSX - the Buy/Sell radio buttons are never actually shown.
// This looks like dead code, but rc-form's `getFieldDecorator(name, opt)`
// registers the field (via `getFieldProps`, called synchronously inside
// `getFieldDecorator` itself - see node_modules/rc-form/lib/
// createBaseForm.js) as a side effect of being *called*, independent of
// whether the decorated element it returns is ever rendered. Since the
// Radio.Group is never mounted, no onChange ever fires, so the "action"
// field is permanently pinned to its initialValue: BUY on the bid/buy
// tab, SELL on the ask/sell tab. Dropping this call would leave
// `values.action` undefined and break `prepareOrders`/`_isMarketFeeVisible`
// /`_getMarketFeePercentage`, so it is kept (called for its registration
// side effect only, result intentionally discarded) rather than "cleaned
// up" into a real, rendered control.
import * as React from "react";
import moment from "moment";
import {Input, Form, Select, Button, Radio} from "bitshares-ui-style-guide";
import AssetNameWrapper from "../Utility/AssetName";
import {SCALED_ORDER_ACTION_TYPES} from "../../services/Exchange";
import {Asset} from "../../lib/common/MarketClasses";
import {ChainStore} from "bitsharesjs";
import counterpart from "counterpart";
import {Validation} from "../../services/Validation/Validation";
import assetUtils from "../../lib/common/asset_utils";
import {checkFeeStatusAsync} from "../../lib/common/trxHelper";
import PriceText from "../Utility/PriceText";
import AssetName from "../Utility/AssetName";
import {
    preciseAdd,
    preciseDivide,
    preciseMultiply,
    preciseMinus
} from "../../services/Math";
import {DatePicker} from "antd";

interface ScaledOrderFormProps {
    form: any;
    type: string;
    quoteAsset: any;
    baseAsset: any;
    expirationCustomTime: any;
    expirationType: string;
    expirations: any;
    currentPrice: any;
    currentAccount: any;
    baseAssetBalance: number;
    quoteAssetBalance: number;
    onExpirationTypeChange: (...args: any[]) => any;
    onExpirationCustomChange: (...args: any[]) => any;
    handleSubmit: () => void;
}

const ScaledOrderFormInner = React.forwardRef<any, ScaledOrderFormProps>(
    function ScaledOrderFormInner(props, ref) {
        const {
            type,
            quoteAsset,
            baseAsset,
            expirationCustomTime,
            form,
            expirationType,
            expirations,
            currentPrice,
            currentAccount,
            baseAssetBalance,
            quoteAssetBalance,
            onExpirationTypeChange,
            onExpirationCustomChange,
            handleSubmit
        } = props;

        const [orderCount, setOrderCount] = React.useState(1);
        const [feeAssets, setFeeAssets] = React.useState<any[]>([]);

        const datePickerRef = React.useRef<any>(null);
        const firstClickRef = React.useRef(false);
        const secondClickRef = React.useRef(false);
        const isFirstRender = React.useRef(true);

        React.useImperativeHandle(ref, () => ({props: {form}}));

        const getFormValues = () => form.getFieldsValue();

        const getBaseAssetFlags = () =>
            assetUtils.getFlagBooleans(
                baseAsset.getIn(["options", "flags"]),
                baseAsset.has("bitasset_data_id")
            );

        const getQuoteAssetFlags = () =>
            assetUtils.getFlagBooleans(
                quoteAsset.getIn(["options", "flags"]),
                quoteAsset.has("bitasset_data_id")
            );

        const isMarketFeeVisible = () => {
            const baseAssetFlagBooleans = getBaseAssetFlags();
            const quoteAssetFlagBooleans = getQuoteAssetFlags();

            if (
                getFormValues().action === SCALED_ORDER_ACTION_TYPES.SELL &&
                baseAssetFlagBooleans.charge_market_fee
            ) {
                return true;
            }

            if (
                getFormValues().action === SCALED_ORDER_ACTION_TYPES.BUY &&
                quoteAssetFlagBooleans.charge_market_fee
            ) {
                return true;
            }

            return false;
        };

        const filterFeeStatuses = (feeStatuses: any[]) =>
            feeStatuses
                .filter(
                    feeStatus =>
                        feeStatus &&
                        feeStatus.hasPoolBalance &&
                        feeStatus.hasBalance
                )
                .map(feeStatus => ({
                    fee: feeStatus,
                    amount:
                        feeStatus.fee.getAmount() /
                        Math.pow(10, feeStatus.fee.precision),
                    asset: ChainStore.getAsset(feeStatus.fee.asset_id)
                }));

        const getAccountAssetsFeeStatus = () => {
            const {orderCount: formOrderCount} = getFormValues();

            if (
                !currentAccount ||
                !currentAccount.get ||
                !currentAccount.get("balances")
            ) {
                return false;
            }

            return new Promise(resolve => {
                const promises: Promise<any>[] = [];

                currentAccount.get("balances").forEach((balance: any) => {
                    const balanceObj = ChainStore.getObject(balance);

                    // checkFeeStatusAsync's JSDoc has a duplicate, conflicting
                    // @param props tag (first {number}, then {Object}) that
                    // makes TS's checkJs inference pick up `number` as the
                    // param type - pre-existing in trxHelper.js, out of scope
                    // here; cast around it rather than widen a shared util.
                    const promise = checkFeeStatusAsync({
                        accountID: currentAccount.get("id"),
                        feeID: balanceObj.get("asset_type"),
                        type: "limit_order_create",
                        operationsCount: formOrderCount
                    } as any);

                    promises.push(promise);
                });

                Promise.all(promises).then(feesStatuses => {
                    resolve(feesStatuses);
                });
            });
        };

        const checkFeeAssets = () => {
            // get account balances, check is each balance available to pay fee
            // for limit_order, filter only available assets and put it to local state
            (getAccountAssetsFeeStatus() as Promise<any[]>).then(
                feeStatuses => {
                    const assets = filterFeeStatuses(feeStatuses);
                    setFeeAssets(assets);
                }
            );
        };

        React.useEffect(() => {
            checkFeeAssets();
        }, []);

        React.useEffect(() => {
            if (isFirstRender.current) {
                isFirstRender.current = false;
                return;
            }

            const formOrderCount = Number(getFormValues().orderCount || 1);
            const stateOrderCount = Number(orderCount);

            if (
                !isNaN(stateOrderCount) &&
                !isNaN(formOrderCount) &&
                Number(orderCount) !== formOrderCount
            ) {
                setOrderCount(formOrderCount);
                // checkFeeAssets() reads orderCount fresh from the form (not
                // from the `orderCount` state above), so calling it here
                // rather than after the setOrderCount commit (as the
                // original does, via a setState callback) is equivalent.
                checkFeeAssets();
            }
        });

        const isFormValid = () => {
            const formValues = getFormValues();

            if (!formValues) return false;

            if (
                !formValues.priceLower ||
                isNaN(Number(formValues.priceLower)) ||
                Number(formValues.priceLower) <= 0
            )
                return false;

            if (
                !formValues.amount ||
                isNaN(Number(formValues.amount)) ||
                Number(formValues.amount) <= 0
            )
                return false;

            if (
                !formValues.priceUpper ||
                isNaN(Number(formValues.priceUpper)) ||
                Number(formValues.priceUpper) <= 0 ||
                Number(formValues.priceUpper) <= Number(formValues.priceLower)
            )
                return false;

            if (
                !formValues.orderCount ||
                isNaN(Number(formValues.orderCount)) ||
                Number(formValues.orderCount) <= 1
            )
                return false;

            return true;
        };

        const getFee = () => {
            const formValues = getFormValues();

            let amount = 0;

            if (formValues && formValues.feeCurrency) {
                feeAssets.forEach(feeAsset => {
                    if (
                        feeAsset &&
                        feeAsset.asset &&
                        feeAsset.asset.get("symbol") === formValues.feeCurrency
                    ) {
                        amount = feeAsset.amount;
                    }
                });
            }

            return amount;
        };

        const getMarketFeePercentage = () => {
            const {action} = getFormValues();

            let asset = null;

            if (action === SCALED_ORDER_ACTION_TYPES.SELL) asset = baseAsset;

            if (action === SCALED_ORDER_ACTION_TYPES.BUY) asset = quoteAsset;

            return Number(asset.getIn(["options", "market_fee_percent"]) / 100);
        };

        const getTotal = () => {
            const formValues = getFormValues();

            const amount = Number(formValues.amount);
            const priceLower = Number(formValues.priceLower);
            const priceUpper = Number(formValues.priceUpper);
            const formOrderCount = Number(formValues.orderCount);

            const isCorrect = (value: number) => !isNaN(value);

            if (
                !isCorrect(priceLower) ||
                !isCorrect(priceUpper) ||
                !isCorrect(amount) ||
                !isCorrect(formOrderCount) ||
                formOrderCount <= 1 ||
                formOrderCount <= 0 ||
                priceLower >= priceUpper
            )
                return 0;

            const step = preciseDivide(
                preciseMinus(priceUpper, priceLower),
                preciseMinus(formOrderCount, 1)
            );

            const amountPerOrder = preciseDivide(amount, formOrderCount);

            let total: any = 0;

            for (let i = 0; i < formOrderCount; i += 1) {
                total = preciseAdd(
                    total,
                    preciseMultiply(
                        amountPerOrder,
                        preciseAdd(priceLower, preciseMultiply(step, i))
                    )
                );
            }

            return total;
        };

        const getMarketFee = () => {
            const formValues = getFormValues();

            const quantity = Number(getTotal());
            const action = formValues.action;

            if (isNaN(quantity)) return null;

            let asset = null;

            if (action === SCALED_ORDER_ACTION_TYPES.SELL) asset = baseAsset;

            if (action === SCALED_ORDER_ACTION_TYPES.BUY) asset = quoteAsset;

            if (!asset || !asset.get || !asset.getIn) return null;

            const maxMarketFee = new Asset({
                amount: asset.getIn(["options", "max_market_fee"]),
                asset_id: asset.get("asset_id"),
                precision: asset.get("precision")
            });

            const marketFeePercent = getMarketFeePercentage();

            return !quantity
                ? 0
                : Math.min(
                      maxMarketFee.getAmount({real: true}),
                      (quantity / 100) * marketFeePercent
                  ).toFixed(maxMarketFee.precision);
        };

        const getQuantityFromTotal = (total: number) => {
            const formValues = getFormValues();

            const priceLower = Number(formValues.priceLower);
            const priceUpper = Number(formValues.priceUpper);
            const formOrderCount = Number(formValues.orderCount);

            const isCorrect = (value: number) => !isNaN(value);

            if (
                !isCorrect(priceLower) ||
                !isCorrect(priceUpper) ||
                !isCorrect(total) ||
                !isCorrect(formOrderCount) ||
                formOrderCount <= 0 ||
                priceLower >= priceUpper
            )
                return 0;

            const step = preciseDivide(
                preciseMinus(priceUpper, priceLower),
                preciseMinus(formOrderCount, 1)
            );

            let sum: any = 0;

            for (let i = 0; i < formOrderCount; i += 1) {
                sum = preciseAdd(
                    sum,
                    Number(
                        preciseDivide(
                            preciseAdd(priceLower, preciseMultiply(step, i)),
                            formOrderCount
                        )
                    )
                );
            }

            return preciseDivide(total, sum);
        };

        const getDatePickerRef = (node: any) => {
            datePickerRef.current = node;
        };

        const handleClickBalance = () => {
            if (type === "bid") {
                form.setFieldsValue({
                    amount: getQuantityFromTotal(baseAssetBalance)
                });
            } else {
                form.setFieldsValue({
                    amount: quoteAssetBalance
                });
            }
        };

        const handleCurrentPriceClick = () => {
            form.setFieldsValue({priceLower: currentPrice});
        };

        const onExpirationSelectChange = (e: any) => {
            if (e.target.value === "SPECIFIC") {
                datePickerRef.current.picker.handleOpenChange(true);
            } else {
                datePickerRef.current.picker.handleOpenChange(false);
            }

            onExpirationTypeChange(e);
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

        const isBid = type === "bid";

        const quote = quoteAsset;
        const base = baseAsset;

        const {getFieldDecorator} = form;

        const marketFeeSymbol = isBid ? (
            <AssetNameWrapper name={quoteAsset.get("symbol")} />
        ) : (
            <AssetNameWrapper name={baseAsset.get("symbol")} />
        );

        const quantitySymbol = (
            <AssetNameWrapper name={quoteAsset.get("symbol")} />
        );

        const totalSymbol = <AssetNameWrapper name={baseAsset.get("symbol")} />;

        const priceSymbol = (
            <span>
                <AssetName dataPlace="right" name={baseAsset.get("symbol")} />
                &nbsp;/&nbsp;
                <AssetName dataPlace="right" name={quoteAsset.get("symbol")} />
            </span>
        );

        const formItemProps = {
            labelCol: {span: 6},
            wrapperCol: {span: 16, offset: 2}
        };

        getFieldDecorator("action", {
            initialValue: isBid
                ? SCALED_ORDER_ACTION_TYPES.BUY
                : SCALED_ORDER_ACTION_TYPES.SELL
        })(
            <Radio.Group>
                <Radio value={SCALED_ORDER_ACTION_TYPES.BUY}>
                    {counterpart.translate("scaled_orders.action.buy")}
                </Radio>
                <Radio value={SCALED_ORDER_ACTION_TYPES.SELL}>
                    {counterpart.translate("scaled_orders.action.sell")}
                </Radio>
            </Radio.Group>
        );

        const priceLowerInput = getFieldDecorator("priceLower", {
            validateFirst: true,
            validateTrigger: "onBlur",
            rules: [
                Validation.Rules.required(),
                Validation.Rules.number(),
                // Validation.js's Rules.min JSDoc has a duplicate,
                // conflicting @param props tag (first {number}, then
                // {Object}) that makes TS's checkJs inference pick up
                // `number` as the param type - pre-existing, out of scope
                // here; cast around it rather than widen a shared util
                // (same below for the other Rules.min({...}) call sites).
                Validation.Rules.min({
                    min: 0,
                    name: "Price",
                    higherThan: true
                } as any)
            ]
        })(
            <Input
                placeholder="0.0"
                style={{width: "100%"}}
                autoComplete="off"
                addonAfter={priceSymbol}
            />
        );

        const formValues = getFormValues();

        const priceLower = Number((formValues && formValues.priceLower) || 0);

        const priceUpperInput = getFieldDecorator("priceUpper", {
            validateFirst: true,
            validateTrigger: "onBlur",
            rules: [
                Validation.Rules.required(),
                Validation.Rules.number(),
                Validation.Rules.min({
                    min: priceLower,
                    name: "Price",
                    higherThan: true
                } as any)
            ]
        })(
            <Input
                placeholder="0.0"
                style={{width: "100%"}}
                autoComplete="off"
                addonAfter={priceSymbol}
            />
        );

        const feeCurrencySelect = getFieldDecorator("feeCurrency", {
            initialValue:
                ChainStore.getAsset("1.3.0") &&
                ChainStore.getAsset("1.3.0").get &&
                ChainStore.getAsset("1.3.0").get("symbol")
        })(
            <Select
                showSearch
                dropdownMatchSelectWidth={false}
                style={{minWidth: "80px", maxWidth: "120px"}}
            >
                {feeAssets &&
                    feeAssets.map &&
                    feeAssets.map(feeAsset => {
                        return (
                            <Select.Option
                                key={feeAsset.asset.get("symbol")}
                                value={`${feeAsset.asset.get("symbol")}`}
                            >
                                <AssetNameWrapper
                                    name={feeAsset.asset.get("symbol")}
                                    noTip={true}
                                />
                            </Select.Option>
                        );
                    })}
            </Select>
        );

        const feeInput = (
            <Input
                disabled
                placeholder="0.0"
                style={{width: "100%"}}
                autoComplete="off"
                addonAfter={feeCurrencySelect}
                value={getFee()}
            />
        );

        const marketFeeInput = (
            <Input
                disabled
                style={{width: "100%"}}
                autoComplete="off"
                addonAfter={marketFeeSymbol}
                value={getMarketFee()}
            />
        );

        const totalInput = (
            <Input
                disabled
                style={{width: "100%"}}
                autoComplete="off"
                addonAfter={totalSymbol}
                value={getTotal()}
            />
        );

        const totalInputValidation = Validation.Rules.balance({
            balance: baseAssetBalance,
            symbol: baseAsset.get("symbol")
        });

        const totalInputValidator = totalInputValidation.validator(
            null,
            getTotal(),
            (a: any) => a === undefined
        );
        const totalInputHelp =
            isBid && !totalInputValidator ? totalInputValidation.message : null;
        const totalInputStatus = isBid && !totalInputValidator ? "error" : "";

        const quantityRules = [
            Validation.Rules.required(),
            Validation.Rules.number(),
            Validation.Rules.min({
                min: 0,
                higherThan: true,
                name: "Quantity"
            } as any)
        ];

        if (!isBid) {
            quantityRules.push(
                Validation.Rules.balance({
                    balance: quoteAssetBalance,
                    symbol: quoteAsset.get("symbol")
                })
            );
        }

        const quantityInput = getFieldDecorator("amount", {
            validateFirst: true,
            validateTrigger: "onBlur",
            rules: quantityRules
        })(
            <Input
                placeholder="0.0"
                style={{width: "100%"}}
                autoComplete="off"
                addonAfter={quantitySymbol}
            />
        );

        const orderCountInput = getFieldDecorator("orderCount", {
            validateFirst: true,
            rules: [
                Validation.Rules.required(),
                Validation.Rules.number(),
                Validation.Rules.min({
                    min: 1,
                    name: "Orders Count",
                    higherThan: true
                } as any)
            ]
        })(
            <Input
                style={{width: "100%"}}
                placeholder="0"
                autoComplete="off"
                addonAfter={counterpart.translate("scaled_orders.order_s")}
            />
        );

        const lastPriceLabel = counterpart.translate(
            isBid ? "exchange.lowest_ask" : "exchange.highest_bid"
        );

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

        return (
            <div className="buy-sell-container" style={{padding: "5px"}}>
                <Form
                    className="order-form"
                    layout="horizontal"
                    hideRequiredMark={true}
                    style={{padding: "8px 15px"}}
                >
                    <Form.Item
                        {...formItemProps}
                        label={counterpart.translate(
                            "scaled_orders.price_lower"
                        )}
                    >
                        {priceLowerInput}
                    </Form.Item>

                    <Form.Item
                        {...formItemProps}
                        label={counterpart.translate(
                            "scaled_orders.price_upper"
                        )}
                    >
                        {priceUpperInput}
                    </Form.Item>

                    <Form.Item
                        {...formItemProps}
                        label={counterpart.translate("scaled_orders.quantity")}
                    >
                        {quantityInput}
                    </Form.Item>

                    <Form.Item
                        {...formItemProps}
                        label={counterpart.translate(
                            "scaled_orders.order_count"
                        )}
                    >
                        {orderCountInput}
                    </Form.Item>

                    <Form.Item
                        {...formItemProps}
                        help={totalInputHelp}
                        validateStatus={totalInputStatus}
                        label={counterpart.translate("scaled_orders.total")}
                    >
                        {totalInput}
                    </Form.Item>

                    <Form.Item
                        {...formItemProps}
                        label={counterpart.translate("scaled_orders.fee")}
                    >
                        {feeInput}
                    </Form.Item>

                    {isMarketFeeVisible() ? (
                        <Form.Item
                            {...formItemProps}
                            label={`${counterpart.translate(
                                "scaled_orders.market_fee"
                            )} ${getMarketFeePercentage()}%`}
                        >
                            {marketFeeInput}
                        </Form.Item>
                    ) : null}

                    <Form.Item
                        label={counterpart.translate("transaction.expiration")}
                        {...formItemProps}
                    >
                        <div
                            className="expiration-datetime-picker scaled-orders"
                            style={{marginTop: "5px"}}
                        >
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
                                onChange={onExpirationCustomChange}
                            />
                            <select
                                className="cursor-pointer"
                                style={{marginTop: "5px"}}
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
                    </Form.Item>

                    <Form.Item label={lastPriceLabel} {...formItemProps}>
                        <span
                            style={{
                                borderBottom: "#A09F9F 1px dotted",
                                cursor: "pointer"
                            }}
                            onClick={handleCurrentPriceClick}
                        >
                            <PriceText
                                price={currentPrice}
                                quote={quote}
                                base={base}
                            />{" "}
                            <AssetNameWrapper name={base.get("symbol")} noTip />
                            /
                            <AssetNameWrapper
                                name={quote.get("symbol")}
                                noTip
                            />
                        </span>
                    </Form.Item>

                    <Form.Item
                        label={counterpart.translate("exchange.balance")}
                        {...formItemProps}
                    >
                        <span
                            style={{
                                borderBottom: "#A09F9F 1px dotted",
                                cursor: "pointer"
                            }}
                            onClick={handleClickBalance}
                        >
                            {!isBid ? quoteAssetBalance : baseAssetBalance}{" "}
                            <AssetNameWrapper
                                name={
                                    !isBid
                                        ? quote.get("symbol")
                                        : base.get("symbol")
                                }
                                noTip
                            />
                        </span>
                    </Form.Item>

                    <Button
                        onClick={handleSubmit}
                        type="primary"
                        disabled={!isFormValid()}
                    >
                        {counterpart.translate(
                            isBid
                                ? "scaled_orders.action.buy"
                                : "scaled_orders.action.sell"
                        )}
                    </Button>
                </Form>
            </div>
        );
    }
);

const ScaledOrderForm: any = Form.create({})(ScaledOrderFormInner);

interface ScaledOrderTabProps {
    expirationType: string;
    expirations: any;
    expirationCustomTime: any;
    onExpirationTypeChange: (...args: any[]) => any;
    onExpirationCustomChange: (...args: any[]) => any;
    currentPrice: any;
    lastClickedPrice: any;
    currentAccount: any;
    createScaledOrder: (...args: any[]) => any;
    type: string;
    quoteAsset: any;
    baseAsset: any;
}

export default function ScaledOrderTab(props: ScaledOrderTabProps) {
    const {
        expirationType,
        expirations,
        expirationCustomTime,
        onExpirationTypeChange,
        onExpirationCustomChange,
        currentPrice,
        lastClickedPrice,
        currentAccount,
        createScaledOrder,
        type,
        quoteAsset,
        baseAsset
    } = props;

    const formRef = React.useRef<any>(null);
    const isFirstRender = React.useRef(true);
    const prevBaseAssetRef = React.useRef(baseAsset);
    const prevLastClickedPriceRef = React.useRef(lastClickedPrice);

    const saveFormRef = (ref: any) => {
        formRef.current = ref;
    };

    React.useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            prevBaseAssetRef.current = baseAsset;
            prevLastClickedPriceRef.current = lastClickedPrice;
            return;
        }

        const prevBaseAsset = prevBaseAssetRef.current;
        if (
            baseAsset &&
            prevBaseAsset &&
            baseAsset.get &&
            prevBaseAsset.get &&
            baseAsset.get("id") !== prevBaseAsset.get("id") &&
            formRef.current &&
            formRef.current.props &&
            formRef.current.props.form
        ) {
            formRef.current.props.form.resetFields();
        }

        const prevLastClickedPrice = prevLastClickedPriceRef.current;
        if (lastClickedPrice && lastClickedPrice !== prevLastClickedPrice) {
            if (
                formRef.current &&
                formRef.current.props &&
                formRef.current.props.form &&
                formRef.current.props.form.setFieldsValue
            ) {
                formRef.current.props.form.setFieldsValue({
                    priceLower: Number(lastClickedPrice)
                });
            }
        }

        prevBaseAssetRef.current = baseAsset;
        prevLastClickedPriceRef.current = lastClickedPrice;
    });

    const prepareOrders = (values: any) => {
        const orders = [];

        const amount = Number(values.amount);
        const priceLower = Number(values.priceLower);
        const priceUpper = Number(values.priceUpper);
        const orderCount = Number(values.orderCount);

        // Original had an if/else on expirationType === "SPECIFIC" here,
        // but both branches computed the exact same expression - collapsed
        // into one, no behavior change.
        const expirationTime = expirations[expirationType].get(type);

        const isCorrect = (value: number) => !isNaN(value);

        if (
            !isCorrect(priceLower) ||
            !isCorrect(priceUpper) ||
            !isCorrect(amount) ||
            !isCorrect(orderCount) ||
            orderCount <= 0 ||
            priceLower >= priceUpper
        )
            return;

        const step = ((priceUpper - priceLower) / (orderCount - 1)).toPrecision(
            5
        );

        const amountPerOrder = amount / orderCount;

        const sellAsset =
            values.action === SCALED_ORDER_ACTION_TYPES.SELL
                ? quoteAsset
                : baseAsset;
        const buyAsset =
            values.action === SCALED_ORDER_ACTION_TYPES.BUY
                ? quoteAsset
                : baseAsset;

        const sellAmount = (i: number) => {
            const scaledAmount = amountPerOrder * (priceLower + (step as any) * i);
            return values.action === SCALED_ORDER_ACTION_TYPES.BUY
                ? Number(scaledAmount.toPrecision(5)) *
                      Math.pow(10, sellAsset.get("precision"))
                : Number(amountPerOrder.toPrecision(5)) *
                      Math.pow(10, sellAsset.get("precision"));
        };

        const buyAmount = (i: number) => {
            const scaledAmount = amountPerOrder * (priceLower + (step as any) * i);
            return values.action === SCALED_ORDER_ACTION_TYPES.SELL
                ? Number(scaledAmount.toPrecision(5)) *
                      Math.pow(10, buyAsset.get("precision"))
                : Number(amountPerOrder.toPrecision(5)) *
                      Math.pow(10, buyAsset.get("precision"));
        };

        for (let i = 0; i < orderCount; i += 1) {
            orders.push({
                for_sale: new Asset({
                    asset_id: sellAsset.get("id"),
                    precision: sellAsset.get("precision"),
                    amount: sellAmount(i)
                }),
                to_receive: new Asset({
                    asset_id: buyAsset.get("id"),
                    precision: buyAsset.get("precision"),
                    amount: buyAmount(i)
                }),
                expirationTime: expirationTime
            });
        }

        createScaledOrder(
            orders,
            ChainStore.getAsset(values.feeCurrency).get("id")
        );
    };

    const handleSubmit = () => {
        const form = formRef.current.props.form;

        form.validateFields((err: any, values: any) => {
            if (err) return;

            prepareOrders(values);
        });
    };

    const getBalanceByAssetId = (assetId: string, precision: number) => {
        let balance = 0;

        const balances = currentAccount.get("balances");

        if (balances.get(assetId) !== undefined) {
            const balanceObj = ChainStore.getObject(balances.get(assetId));

            balance = balanceObj.get("balance") / Math.pow(10, precision);
        }

        return balance;
    };

    const baseAssetBalance = getBalanceByAssetId(
        baseAsset.get("id"),
        baseAsset.get("precision")
    );
    const quoteAssetBalance = getBalanceByAssetId(
        quoteAsset.get("id"),
        quoteAsset.get("precision")
    );

    return (
        <ScaledOrderForm
            wrappedComponentRef={saveFormRef}
            type={type}
            quoteAsset={quoteAsset}
            baseAsset={baseAsset}
            expirationCustomTime={expirationCustomTime}
            expirationType={expirationType}
            expirations={expirations}
            currentPrice={currentPrice}
            currentAccount={currentAccount}
            baseAssetBalance={baseAssetBalance}
            quoteAssetBalance={quoteAssetBalance}
            onExpirationTypeChange={onExpirationTypeChange}
            onExpirationCustomChange={onExpirationCustomChange}
            handleSubmit={handleSubmit}
        />
    );
}
