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
// UPDATE (call-site migration, docs/UI_MIGRATION_PLAN.md §7.1): moved
// off `bitshares-ui-style-guide` and off antd's managed-form API
// (`Form.create()`/`getFieldDecorator`/`validateFields`/`setFieldsValue`/
// `resetFields`) entirely, onto the design-system `Form` (a layout
// primitive only, see its own header comment) and plain local state.
// Given this file's security-sensitivity, every behavioral subtlety
// below was verified by reading rc-form's and this app's own
// `Validation.js`'s actual source, not assumed equivalent.
//
// The old `getFieldDecorator("action", {initialValue: isBid ? BUY :
// SELL})(<Radio.Group>...)` call was kept in the pre-rewrite version
// purely for its rc-form *registration* side effect (see the removed
// comment this replaced, still true of the original): the Radio.Group
// it decorates is never placed into the rendered JSX, so it never
// mounts, never fires `onChange`, and the "action" field is therefore
// permanently pinned to whichever `initialValue` it registered with -
// which only ever depends on `isBid` (itself derived from the `type`
// prop, and confirmed fixed for a given `<ScaledOrderTab>` instance's
// whole lifetime: `Exchange.tsx`'s two call sites each pass a literal,
// never-changing `type="bid"`/`type="ask"`). A value that's fixed at
// mount and never changes again is exactly what a plain derived
// constant already is - `action` is now just `isBid ? BUY : SELL`,
// recomputed each render, with identical results. The whole `Radio`/
// `Radio.Group` import and JSX are dropped along with it.
//
// `priceLower`/`priceUpper`/`feeCurrency`/`amount`/`orderCount` become
// a single `values` state object, with `setFieldValue`/`setFieldsValue`
// helpers replacing `form.setFieldsValue` at every call site (internal:
// `handleClickBalance`/`handleCurrentPriceClick`; external: the outer
// `ScaledOrderTab`'s own `formRef.current.props.form.setFieldsValue
// (...)`/`.resetFields()` calls, reacting to `baseAsset`/
// `lastClickedPrice` prop changes - both untouched, see below). A
// `runRules(value, rules)` helper replicates rc-form's actual rule-
// running semantics directly against this app's own `Validation.js`
// rule objects (`{required: true, message}` or `{validator: (rule,
// value, cb) => ..., message}` - rc-form itself treats `required`
// specially, apart from custom validators, so `runRules` does too),
// stopping at the first failing rule - matching every real field's own
// `validateFirst: true`. `validateFields(callback)` runs this against
// each of the 4 fields that ever had `rules` (`feeCurrency`/`action`
// never did) and calls back with either `null` or a truthy error map,
// matching rc-form's own truthy/falsy contract (the only thing
// `handleSubmit`'s `if (err) return;` ever checked).
//
// Two things this rewrite deliberately did NOT try to also replicate,
// because reading the original found they were already inert:
// - No `Form.Item` anywhere derives its `help`/`validateStatus` from
//   rc-form's own validation state - only `totalInput`'s does, and
//   that's computed independently via `Validation.Rules.balance(...)
//   .validator(...)` directly, untouched by this rewrite. So the
//   `rules` arrays never actually surfaced visible error text; their
//   only real effect was gating `handleSubmit`'s `prepareOrders(...)`
//   call, which `validateFields` above still does.
// - `isFormValid()` (which already disables the Buy/Sell button
//   independently of `validateFields`) does NOT check `amount` against
//   `quoteAssetBalance` the way the sell-side `quantityRules`'s
//   `Validation.Rules.balance(...)` entry does - so `validateFields`'s
//   balance check is the one real, non-redundant safety net past the
//   disabled-button state, and is preserved exactly.
//
// The separate `orderCount` React state (a redundant echo of `form
// .getFieldValue("orderCount")`, synced via its own no-dependency-array
// effect purely so a *different* value - the numeric drift between the
// two copies - could trigger `checkFeeAssets()`) is dropped: with
// `values.orderCount` now the only copy, there's nothing left to sync.
// Its effect is replaced by one that compares each render's numeric
// `values.orderCount` against a ref holding the previous render's,
// calling `checkFeeAssets()` only when they genuinely differ (skipped
// on the very first render, exactly as before - the mount effect below
// already calls it once).
//
// `Form`'s antd-only `hideRequiredMark` prop is dropped: the design-
// system `Form.Item` never renders antd's little red required-asterisk
// in the first place, so there's nothing for this flag to suppress.
// `Button`'s antd-only `type="primary"` becomes `variant="accent"`,
// matching every other call site in this migration. Its submit button
// also gains an explicit `type="button"`: antd's own `Button` defaults
// its internal `htmlType` to `"button"` (unlike a native `<button>`,
// which defaults to `"submit"` inside a `<form>`), but the design-
// system `Button` has no such default - without it, clicking submit
// inside this file's `<Form>` would also fire a real (if inert, since
// `<Form>` has no `onSubmit`/`action`) native form submission alongside
// `handleSubmit`. Spelling out explicitly what antd already did
// silently, not a behavior change.
//
// `datePickerRef.current.picker.handleOpenChange(true/false)` (antd's
// own imperative open/close API for its calendar popup, triggered here
// when the separate expiration `<select>` picks "Specific time") has no
// true native equivalent: the design-system `DatePicker` now forwards
// its ref to the underlying native `<input>` (added for this one call
// site - see `DatePicker.tsx`'s own header), whose closest analogue is
// `.showPicker()` - but this input is rendered with the pre-existing
// `expiration-datetime-picker--hidden` CSS class (`visibility: hidden;
// height: 0`, since the UI's real, visible control is the `<select>`
// beside it), and most browsers refuse `.showPicker()` on an element
// that isn't actually being rendered, throwing `InvalidStateError`.
// Rather than restyle this picker to be visible (a real UI change, out
// of scope for a managed-form-API swap on a security-sensitive file,
// and unrelated to the order-placement math this file exists for), the
// call is wrapped in a `try`/`catch` and silently no-ops where the
// browser refuses it - a known, narrow, documented UX gap (the
// "specific time" calendar may not auto-open in every browser; the
// user can still reach the underlying input directly), not a
// correctness regression in anything this file actually computes or
// submits. There is no native equivalent for the old "close" call
// either (`handleOpenChange(false)`, fired when a *different*
// expiration option is picked) - dropped for the same reason.
import * as React from "react";
import moment from "moment";
import {Input} from "../../design-system/Input";
import {Form} from "../../design-system/Form";
import {Select} from "../../design-system/Select";
import {Button} from "../../design-system/Button";
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
import {DatePicker} from "../../design-system/DatePicker";

interface ScaledOrderFieldRule {
    required?: boolean;
    validator?: (
        rule: any,
        value: any,
        callback: (invalid?: boolean) => void
    ) => void;
    message: string;
}

// Replicates rc-form's actual rule-running contract against this app's
// own `Validation.js` rule objects - see this file's header comment.
// Exported (not just module-local) purely so it has direct unit test
// coverage, given this file's security-sensitivity.
export function runRules(
    value: any,
    rules: ScaledOrderFieldRule[]
): string | null {
    for (const rule of rules) {
        if (rule.required) {
            if (value === undefined || value === null || value === "") {
                return rule.message;
            }
            continue;
        }
        if (rule.validator) {
            let invalid = false;
            rule.validator(null, value, (result?: boolean) => {
                if (result === false) invalid = true;
            });
            if (invalid) return rule.message;
        }
    }
    return null;
}

interface ScaledOrderFormValues {
    priceLower?: string;
    priceUpper?: string;
    feeCurrency?: string;
    amount?: string;
    orderCount?: string;
}

interface ScaledOrderFormHandle {
    props: {
        form: {
            getFieldsValue: () => ScaledOrderFormValues & {action: string};
            setFieldsValue: (partial: Partial<ScaledOrderFormValues>) => void;
            resetFields: () => void;
            validateFields: (
                callback: (
                    err: Record<string, string> | null,
                    values: ScaledOrderFormValues & {action: string}
                ) => void
            ) => void;
        };
    };
}

interface ScaledOrderFormProps {
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

const ScaledOrderFormInner = React.forwardRef<
    ScaledOrderFormHandle,
    ScaledOrderFormProps
>(function ScaledOrderFormInner(props, ref) {
    const {
        type,
        quoteAsset,
        baseAsset,
        expirationCustomTime,
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

    const isBid = type === "bid";
    const action = isBid
        ? SCALED_ORDER_ACTION_TYPES.BUY
        : SCALED_ORDER_ACTION_TYPES.SELL;

    const initialValuesRef = React.useRef<ScaledOrderFormValues>({
        feeCurrency:
            ChainStore.getAsset("1.3.0") &&
            ChainStore.getAsset("1.3.0").get &&
            ChainStore.getAsset("1.3.0").get("symbol")
    });

    const [values, setValues] = React.useState<ScaledOrderFormValues>(
        initialValuesRef.current
    );
    const [feeAssets, setFeeAssets] = React.useState<any[]>([]);

    const datePickerRef = React.useRef<HTMLInputElement | null>(null);
    const firstClickRef = React.useRef(false);
    const secondClickRef = React.useRef(false);
    const isFirstRender = React.useRef(true);
    const prevOrderCountRef = React.useRef(
        Number(initialValuesRef.current.orderCount || 1)
    );

    const setFieldValue = (name: keyof ScaledOrderFormValues, value: any) => {
        setValues(prev => ({...prev, [name]: value}));
    };

    const setFieldsValue = (partial: Partial<ScaledOrderFormValues>) => {
        setValues(prev => ({...prev, ...partial}));
    };

    const resetFields = () => {
        setValues(initialValuesRef.current);
    };

    const getFormValues = () => ({...values, action});

    React.useImperativeHandle(ref, () => ({
        props: {
            form: {
                getFieldsValue: getFormValues,
                setFieldsValue,
                resetFields,
                validateFields: callback => {
                    const err = runValidation();
                    callback(err, getFormValues());
                }
            }
        }
    }));

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
            action === SCALED_ORDER_ACTION_TYPES.SELL &&
            baseAssetFlagBooleans.charge_market_fee
        ) {
            return true;
        }

        if (
            action === SCALED_ORDER_ACTION_TYPES.BUY &&
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
                    feeStatus && feeStatus.hasPoolBalance && feeStatus.hasBalance
            )
            .map(feeStatus => ({
                fee: feeStatus,
                amount:
                    feeStatus.fee.getAmount() / Math.pow(10, feeStatus.fee.precision),
                asset: ChainStore.getAsset(feeStatus.fee.asset_id)
            }));

    const getAccountAssetsFeeStatus = () => {
        const formOrderCount = values.orderCount;

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
        (getAccountAssetsFeeStatus() as Promise<any[]>).then(feeStatuses => {
            const assets = filterFeeStatuses(feeStatuses);
            setFeeAssets(assets);
        });
    };

    React.useEffect(() => {
        checkFeeAssets();
        // eslint-disable-next-line
    }, []);

    React.useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const formOrderCount = Number(values.orderCount || 1);
        const prevOrderCount = prevOrderCountRef.current;

        if (
            !isNaN(prevOrderCount) &&
            !isNaN(formOrderCount) &&
            prevOrderCount !== formOrderCount
        ) {
            prevOrderCountRef.current = formOrderCount;
            checkFeeAssets();
        }
    });

    const isFormValid = () => {
        const formValues = values;

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
        const formValues = values;

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
        let asset = null;

        if (action === SCALED_ORDER_ACTION_TYPES.SELL) asset = baseAsset;

        if (action === SCALED_ORDER_ACTION_TYPES.BUY) asset = quoteAsset;

        return Number(asset.getIn(["options", "market_fee_percent"]) / 100);
    };

    const getTotal = () => {
        const formValues = values;

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
        const quantity = Number(getTotal());

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
        const formValues = values;

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

    const getDatePickerRef = (node: HTMLInputElement | null) => {
        datePickerRef.current = node;
    };

    const handleClickBalance = () => {
        if (type === "bid") {
            setFieldValue("amount", getQuantityFromTotal(baseAssetBalance));
        } else {
            setFieldValue("amount", quoteAssetBalance);
        }
    };

    const handleCurrentPriceClick = () => {
        setFieldValue("priceLower", currentPrice);
    };

    const onExpirationSelectChange = (e: any) => {
        if (e.target.value === "SPECIFIC") {
            try {
                datePickerRef.current?.showPicker?.();
            } catch (err) {
                // Some browsers refuse `.showPicker()` on an element
                // that isn't actually visible - see this file's header
                // comment. Not a correctness issue, just a missed
                // auto-open.
            }
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
                try {
                    datePickerRef.current?.showPicker?.();
                } catch (err) {
                    // See onExpirationSelectChange above.
                }
                firstClickRef.current = false;
                secondClickRef.current = false;
            }
        }
    };

    const onExpirationSelectBlur = () => {
        firstClickRef.current = false;
        secondClickRef.current = false;
    };

    const quote = quoteAsset;
    const base = baseAsset;

    const marketFeeSymbol = isBid ? (
        <AssetNameWrapper name={quoteAsset.get("symbol")} />
    ) : (
        <AssetNameWrapper name={baseAsset.get("symbol")} />
    );

    const quantitySymbol = <AssetNameWrapper name={quoteAsset.get("symbol")} />;

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

    const priceLowerRules: ScaledOrderFieldRule[] = [
        Validation.Rules.required(),
        Validation.Rules.number(),
        // Validation.js's Rules.min JSDoc has a duplicate, conflicting
        // @param props tag (first {number}, then {Object}) that makes
        // TS's checkJs inference pick up `number` as the param type -
        // pre-existing, out of scope here; cast around it rather than
        // widen a shared util (same below for the other
        // Rules.min({...}) call sites).
        Validation.Rules.min({
            min: 0,
            name: "Price",
            higherThan: true
        } as any)
    ];

    const priceLowerInput = (
        <Input
            placeholder="0.0"
            style={{width: "100%"}}
            autoComplete="off"
            addonAfter={priceSymbol}
            value={values.priceLower || ""}
            onChange={e => setFieldValue("priceLower", e.target.value)}
        />
    );

    const priceLower = Number(values.priceLower || 0);

    const priceUpperRules: ScaledOrderFieldRule[] = [
        Validation.Rules.required(),
        Validation.Rules.number(),
        Validation.Rules.min({
            min: priceLower,
            name: "Price",
            higherThan: true
        } as any)
    ];

    const priceUpperInput = (
        <Input
            placeholder="0.0"
            style={{width: "100%"}}
            autoComplete="off"
            addonAfter={priceSymbol}
            value={values.priceUpper || ""}
            onChange={e => setFieldValue("priceUpper", e.target.value)}
        />
    );

    const feeCurrencySelect = (
        <Select
            showSearch
            dropdownMatchSelectWidth={false}
            style={{minWidth: "80px", maxWidth: "120px"}}
            value={values.feeCurrency}
            onChange={value => setFieldValue("feeCurrency", value)}
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
            value={getMarketFee() ?? ""}
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

    const quantityRules: ScaledOrderFieldRule[] = [
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

    const quantityInput = (
        <Input
            placeholder="0.0"
            style={{width: "100%"}}
            autoComplete="off"
            addonAfter={quantitySymbol}
            value={values.amount || ""}
            onChange={e => setFieldValue("amount", e.target.value)}
        />
    );

    const orderCountRules: ScaledOrderFieldRule[] = [
        Validation.Rules.required(),
        Validation.Rules.number(),
        Validation.Rules.min({
            min: 1,
            name: "Orders Count",
            higherThan: true
        } as any)
    ];

    const orderCountInput = (
        <Input
            style={{width: "100%"}}
            placeholder="0"
            autoComplete="off"
            addonAfter={counterpart.translate("scaled_orders.order_s")}
            value={values.orderCount || ""}
            onChange={e => setFieldValue("orderCount", e.target.value)}
        />
    );

    function runValidation(): Record<string, string> | null {
        const errors: Record<string, string> = {};

        const priceLowerError = runRules(values.priceLower, priceLowerRules);
        if (priceLowerError) errors.priceLower = priceLowerError;

        const priceUpperError = runRules(values.priceUpper, priceUpperRules);
        if (priceUpperError) errors.priceUpper = priceUpperError;

        const amountError = runRules(values.amount, quantityRules);
        if (amountError) errors.amount = amountError;

        const orderCountError = runRules(values.orderCount, orderCountRules);
        if (orderCountError) errors.orderCount = orderCountError;

        return Object.keys(errors).length > 0 ? errors : null;
    }

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
                style={{padding: "8px 15px"}}
            >
                <Form.Item
                    {...formItemProps}
                    label={counterpart.translate("scaled_orders.price_lower")}
                >
                    {priceLowerInput}
                </Form.Item>

                <Form.Item
                    {...formItemProps}
                    label={counterpart.translate("scaled_orders.price_upper")}
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
                    label={counterpart.translate("scaled_orders.order_count")}
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
                                moment(expirationTip).format("Do MMM YYYY hh:mm A")
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
                        <PriceText price={currentPrice} quote={quote} base={base} />{" "}
                        <AssetNameWrapper name={base.get("symbol")} noTip />/
                        <AssetNameWrapper name={quote.get("symbol")} noTip />
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
                            name={!isBid ? quote.get("symbol") : base.get("symbol")}
                            noTip
                        />
                    </span>
                </Form.Item>

                <Button
                    // Explicit `type="button"`: unlike antd's `Button`
                    // (which defaults its internal `htmlType` to
                    // `"button"`), the design-system `Button` is a thin
                    // wrapper with no such default, so inside a `<Form>`
                    // it would otherwise fall back to the native
                    // `<button>` default of `"submit"` - triggering a
                    // real (no-op, since `<Form>` has no `onSubmit`/
                    // `action`) native form submission on click, on top
                    // of `handleSubmit` below. Not a behavior change
                    // from the original, just naming explicitly what
                    // antd silently already did.
                    type="button"
                    onClick={handleSubmit}
                    variant="accent"
                    disabled={!isFormValid()}
                >
                    {counterpart.translate(
                        isBid ? "scaled_orders.action.buy" : "scaled_orders.action.sell"
                    )}
                </Button>
            </Form>
        </div>
    );
});

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

    const formRef = React.useRef<ScaledOrderFormHandle | null>(null);
    const isFirstRender = React.useRef(true);
    const prevBaseAssetRef = React.useRef(baseAsset);
    const prevLastClickedPriceRef = React.useRef(lastClickedPrice);

    const saveFormRef = (ref: ScaledOrderFormHandle | null) => {
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
                } as any);
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

        const step = ((priceUpper - priceLower) / (orderCount - 1)).toPrecision(5);

        const amountPerOrder = amount / orderCount;

        const sellAsset =
            values.action === SCALED_ORDER_ACTION_TYPES.SELL
                ? quoteAsset
                : baseAsset;
        const buyAsset =
            values.action === SCALED_ORDER_ACTION_TYPES.BUY ? quoteAsset : baseAsset;

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

        createScaledOrder(orders, ChainStore.getAsset(values.feeCurrency).get("id"));
    };

    const handleSubmit = () => {
        const form = formRef.current && formRef.current.props.form;
        if (!form) return;

        form.validateFields((err, values) => {
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
        <ScaledOrderFormInner
            ref={saveFormRef}
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
