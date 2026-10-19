// Update an open limit order: its amount, its price, how long it lasts
// (limit_order_update). Only what the user changed is sent; the arithmetic and the
// chain's rules are `lib/common/orderUpdate.ts`. The transaction goes through
// `OrderUpdateActions` -> `WalletDb.process_transaction` (wallet unlock, signing).
import * as React from "react";
import counterpart from "counterpart";
import {FetchChain} from "bitsharesjs";
import {Input} from "../../design-system/Input";
import {Select} from "../../design-system/Select";
import {
    DialogField,
    DialogNote,
    OperationDialog,
    useOperationSubmit
} from "../Utility/OperationDialog";
import OrderUpdateActions from "../../actions/OrderUpdateActions";
import {
    OrderFacts,
    PlanError,
    currentPrice,
    planOrderUpdate
} from "../../lib/common/orderUpdate";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`order_update.${key}`, params) as string;

const KEEP = "keep";
const EXPIRES: Array<[string, number | null]> = [
    [KEEP, null],
    ["hour", 3600],
    ["day", 86400],
    ["week", 7 * 86400],
    ["month", 30 * 86400],
    ["year", 365 * 86400]
];

/** 12.50000 -> "12.5"; a figure for a field, never in exponent form. */
function fieldText(value: number, digits: number): string {
    return value
        .toFixed(Math.min(Math.max(digits, 0), 12))
        .replace(/(\.\d*?)0+$/, "$1")
        .replace(/\.$/, "");
}

interface Loaded {
    seller: string;
    facts: OrderFacts;
    sellSymbol: string;
    receiveSymbol: string;
}

export interface OrderUpdateModalProps {
    /** the order's id ("1.7.123"); the dialog is shut without one */
    orderId: string | null;
    onCancel: () => void;
    onDone: () => void;
}

export default function OrderUpdateModal({
    orderId,
    onCancel,
    onDone
}: OrderUpdateModalProps) {
    const visible = !!orderId;
    const [loaded, setLoaded] = React.useState<Loaded | null>(null);
    const [amountText, setAmountText] = React.useState("");
    const [priceText, setPriceText] = React.useState("");
    const [priceEdited, setPriceEdited] = React.useState(false);
    const [expiry, setExpiry] = React.useState(KEEP);
    const {submitting, error, run} = useOperationSubmit(
        visible,
        onDone,
        t("success")
    );

    React.useEffect(() => {
        setLoaded(null);
        if (!orderId) return;
        let cancelled = false;
        FetchChain("getObject", orderId)
            .then((order: any) => {
                if (cancelled || !order) return;
                const price = order.get("sell_price");
                const sellId = price.getIn(["base", "asset_id"]);
                const receiveId = price.getIn(["quote", "asset_id"]);
                return FetchChain("getAsset", [sellId, receiveId]).then(
                    (assets: any) => {
                        if (cancelled) return;
                        const [sell, receive] = assets.toArray
                            ? assets.toArray()
                            : assets;
                        const facts: OrderFacts = {
                            sellAssetId: sellId,
                            receiveAssetId: receiveId,
                            sellPrecision: sell.get("precision"),
                            receivePrecision: receive.get("precision"),
                            forSale: Number(order.get("for_sale")),
                            priceBase: Number(price.getIn(["base", "amount"])),
                            priceQuote: Number(price.getIn(["quote", "amount"]))
                        };
                        setLoaded({
                            seller: order.get("seller"),
                            facts,
                            sellSymbol: sell.get("symbol"),
                            receiveSymbol: receive.get("symbol")
                        });
                        setAmountText(
                            fieldText(
                                facts.forSale /
                                    Math.pow(10, facts.sellPrecision),
                                facts.sellPrecision
                            )
                        );
                        setPriceText(
                            fieldText(
                                Number(currentPrice(facts).toPrecision(8)),
                                12
                            )
                        );
                        setPriceEdited(false);
                        setExpiry(KEEP);
                    }
                );
            })
            .catch(() => {
                if (!cancelled) setLoaded(null);
            });
        return () => {
            cancelled = true;
        };
    }, [orderId]);

    const amount = amountText.trim() === "" ? NaN : Number(amountText);
    const price = priceText.trim() === "" ? NaN : Number(priceText);
    const expiresIn = (EXPIRES.find(([key]) => key === expiry) || [
        KEEP,
        null
    ])[1];

    const plan =
        loaded && orderId
            ? planOrderUpdate({
                  seller: loaded.seller,
                  orderId,
                  facts: loaded.facts,
                  amount,
                  price: priceEdited ? price : null,
                  expiresIn,
                  now: Date.now()
              })
            : null;

    const errorText = (code: PlanError): string => t(`err_${code}`);
    // the problem of a field is shown next to it once the user has typed in it
    const amountError =
        plan && !plan.ok && plan.error === "amount_invalid"
            ? errorText(plan.error)
            : null;
    const priceError =
        plan &&
        !plan.ok &&
        (plan.error === "price_invalid" ||
            plan.error === "too_small" ||
            plan.error === "too_big")
            ? errorText(plan.error)
            : null;

    const submit = () => {
        if (!plan || !plan.ok) return;
        run(() => OrderUpdateActions.update(plan.op));
    };

    const facts = loaded ? loaded.facts : null;
    const sellSymbol = loaded ? loaded.sellSymbol : "";
    const receiveSymbol = loaded ? loaded.receiveSymbol : "";

    return (
        <OperationDialog
            visible={visible}
            title={t("title", {order: orderId ? orderId.split(".")[2] : ""})}
            submitLabel={t("submit")}
            canSubmit={!!plan && plan.ok}
            submitting={submitting}
            error={error}
            onSubmit={submit}
            onCancel={onCancel}
        >
            {facts ? (
                <>
                    <DialogNote>
                        {t("selling", {
                            amount: fieldText(
                                facts.forSale /
                                    Math.pow(10, facts.sellPrecision),
                                facts.sellPrecision
                            ),
                            sell: sellSymbol,
                            price: fieldText(
                                Number(currentPrice(facts).toPrecision(8)),
                                12
                            ),
                            receive: receiveSymbol
                        })}
                    </DialogNote>
                    <DialogField
                        label={t("amount_label", {symbol: sellSymbol})}
                        help={t("amount_help")}
                        error={amountError}
                    >
                        <Input
                            value={amountText}
                            inputMode="decimal"
                            onChange={e => setAmountText(e.target.value)}
                        />
                    </DialogField>
                    <DialogField
                        label={t("price_label", {
                            receive: receiveSymbol,
                            sell: sellSymbol
                        })}
                        help={
                            plan && plan.ok
                                ? t("receive_help", {
                                      amount: fieldText(
                                          plan.receiveUnits /
                                              Math.pow(
                                                  10,
                                                  facts.receivePrecision
                                              ),
                                          facts.receivePrecision
                                      ),
                                      symbol: receiveSymbol
                                  })
                                : undefined
                        }
                        error={priceError}
                    >
                        <Input
                            value={priceText}
                            inputMode="decimal"
                            onChange={e => {
                                setPriceText(e.target.value);
                                setPriceEdited(true);
                            }}
                        />
                    </DialogField>
                    <DialogField label={t("expires_label")}>
                        <Select
                            value={expiry}
                            onChange={v => setExpiry(String(v))}
                        >
                            {EXPIRES.map(([key]) => (
                                <Select.Option key={key} value={key}>
                                    {t(`expires_${key}`)}
                                </Select.Option>
                            ))}
                        </Select>
                    </DialogField>
                    {plan && !plan.ok && plan.error === "nothing_changed" ? (
                        <span style={{color: "var(--muted)", fontSize: 12}}>
                            {t("err_nothing_changed")}
                        </span>
                    ) : null}
                </>
            ) : (
                <DialogNote>{t("loading")}</DialogNote>
            )}
        </OperationDialog>
    );
}
