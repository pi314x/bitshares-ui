// Real orders for a strategy: a card that says whether the test on past prices lets them be placed (`placementGate`), the last look
// at every order (a dialog: what each buys or sells at what price, what the account holds, the network fee), and "Sign and send",
// the only thing that signs (the wallet's own prompt follows it). The orders are placed once; see `lib/common/strategyOrders.ts`.
import * as React from "react";
import {
    DialogNote,
    OperationDialog,
    useOperationSubmit
} from "../Utility/OperationDialog";
import AdvancedActions from "../../actions/AdvancedActions";
import {Alert} from "../../design-system/Alert";
import {Button} from "../../design-system/Button";
import {OrderReview, reviewOrders} from "../../lib/chain/strategyChain";
import {loadLastPrice} from "../../lib/chain/marketCandles";
import {AssetRef} from "../../lib/common/marketCandles";
import {StrategySpec} from "../../lib/common/strategies";
import {
    MAX_ORDERS,
    PlannedOrder,
    TestedStrategy,
    placementGate
} from "../../lib/common/strategyOrders";
import {amountText, percentText, priceText, unitsText} from "./format";
import styles from "./StrategiesPage.module.scss";
import {t} from "./text";

export interface PlaceOrdersProps {
    spec: StrategySpec;
    market: {trade: AssetRef; priced: AssetRef} | null;
    /** the last test on past prices that ended, with what it was a test of */
    tested: TestedStrategy | null;
    account: {id: string | null; name: string | null};
}

const errorText = (e: unknown): string =>
    String((e && (e as Error).message) || e).slice(0, 160);

function OrderLine(props: {
    order: PlannedOrder;
    trade: AssetRef;
    priced: AssetRef;
}) {
    const {order, trade, priced} = props;
    const asset = (id: string) => (id === trade.id ? trade : priced);
    const sell = asset(order.sell.asset);
    const receive = asset(order.receive.asset);
    return (
        <li>
            {t(order.side === "buy" ? "place_buy" : "place_sell", {
                pay: unitsText(order.sell.amount, sell.precision),
                payAsset: sell.symbol,
                receive: unitsText(order.receive.amount, receive.precision),
                receiveAsset: receive.symbol,
                price: priceText(order.price)
            })}
        </li>
    );
}

function ReviewDialog(props: {
    review: OrderReview;
    trade: AssetRef;
    priced: AssetRef;
    accountName: string | null;
    onCancel: () => void;
    onDone: (count: number) => void;
}) {
    const {review, trade, priced} = props;
    const count = review.plan.orders.length;
    const {submitting, error, run} = useOperationSubmit(
        true,
        () => props.onDone(count),
        t("place_sent")
    );
    // Closing the dialog ends the signing with it: the password prompt it raised is closed, and a password typed anyway signs
    // nothing (an order the person had dismissed must not be placed when they unlock the wallet a minute later).
    const gone = React.useRef(false);
    const asking = React.useRef(false);
    React.useEffect(() => {
        gone.current = false;
        return () => {
            gone.current = true;
            if (asking.current) AdvancedActions.cancelUnlock();
        };
    }, []);
    const left = review.plan.skipped.filter(s => s.reason === "funds").length;
    const tiny = review.plan.skipped.filter(s => s.reason === "tiny").length;
    return (
        <OperationDialog
            visible={true}
            title={t("place_dialog_title")}
            submitLabel={t("place_sign")}
            canSubmit={count > 0 && !review.shortOfCore}
            submitting={submitting}
            error={error}
            width={560}
            onSubmit={() =>
                run(async () => {
                    asking.current = true;
                    try {
                        await AdvancedActions.ensureUnlocked(props.accountName);
                    } finally {
                        asking.current = false;
                    }
                    if (gone.current) throw new Error("closed");
                    return AdvancedActions.sendNow(review.operations);
                })
            }
            onCancel={props.onCancel}
        >
            {review.shortOfCore ? (
                <Alert
                    type="error"
                    showIcon
                    message={t("place_short_fee", {
                        fee: review.fee ? unitsText(review.fee, 5) : "?"
                    })}
                />
            ) : null}
            <DialogNote>
                {t("place_intro", {
                    count,
                    name: props.accountName || "",
                    price: priceText(review.price),
                    priced: priced.symbol,
                    trade: trade.symbol
                })}
            </DialogNote>
            <ol className={styles.orders}>
                {review.plan.orders.map((order, i) => (
                    <OrderLine
                        key={i}
                        order={order}
                        trade={trade}
                        priced={priced}
                    />
                ))}
            </ol>
            {left > 0 ? (
                <DialogNote>{t("place_skipped", {count: left})}</DialogNote>
            ) : null}
            {tiny > 0 ? (
                <DialogNote>{t("place_tiny", {count: tiny})}</DialogNote>
            ) : null}
            <DialogNote>
                {t("place_spends", {
                    priced: priced.symbol,
                    pricedAmount: unitsText(
                        review.plan.spends.priced,
                        priced.precision
                    ),
                    trade: trade.symbol,
                    tradeAmount: unitsText(
                        review.plan.spends.trade,
                        trade.precision
                    )
                })}
            </DialogNote>
            <DialogNote>
                {review.fee !== null
                    ? t("place_fee", {
                          fee: unitsText(review.fee, 5),
                          count
                      })
                    : t("place_fee_unknown")}
            </DialogNote>
            <DialogNote>
                {t("place_stay", {until: review.expiration.toLocaleString()})}
            </DialogNote>
            <Alert type="warning" showIcon message={t("place_once")} />
        </OperationDialog>
    );
}

export default function PlaceOrders(props: PlaceOrdersProps): JSX.Element {
    const {spec, market, tested, account} = props;
    const [phase, setPhase] = React.useState<
        | {status: "idle"}
        | {status: "loading"}
        | {status: "error"; text: string}
        | {status: "review"; review: OrderReview}
        | {status: "sent"; count: number; at: number}
    >({status: "idle"});
    const alive = React.useRef(true);
    React.useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);

    const gate = placementGate(
        tested,
        spec,
        market ? market.trade.id : null,
        market ? market.priced.id : null
    );
    const ready = gate.ok && !!account.id && !!market;

    const review = async () => {
        if (!market || !account.id) return;
        setPhase({status: "loading"});
        try {
            const price = await loadLastPrice(market.trade, market.priced);
            if (price === null) {
                if (alive.current) {
                    setPhase({status: "error", text: t("place_err_price")});
                }
                return;
            }
            const result = await reviewOrders({
                spec,
                trade: market.trade,
                priced: market.priced,
                price,
                accountId: account.id
            });
            if (!alive.current) return;
            if (!result.ok) {
                setPhase({
                    status: "error",
                    text: t(`place_err_${result.error}`, {
                        trade: market.trade.symbol,
                        priced: market.priced.symbol,
                        max: MAX_ORDERS
                    })
                });
                return;
            }
            setPhase({status: "review", review: result.review});
        } catch (e) {
            if (alive.current) {
                setPhase({
                    status: "error",
                    text: t("place_err_read", {error: errorText(e)})
                });
            }
        }
    };

    return (
        <section className={styles.card}>
            <div className={styles.head}>
                <h3 className={styles.title}>{t("place_title")}</h3>
            </div>
            <div className={styles.body}>
                <p className={styles.about}>{t("place_lead")}</p>
                {!gate.ok ? (
                    <p className={styles.about}>
                        {t(`gate_${gate.reason}`, {max: MAX_ORDERS})}
                    </p>
                ) : tested && market ? (
                    <p className={styles.about}>
                        {t("gate_ok", {
                            pnl: amountText(tested.summary.pnl),
                            priced: market.priced.symbol,
                            percent: percentText(tested.summary.pnlPercent)
                        })}
                    </p>
                ) : null}
                {gate.ok && !account.id ? (
                    <p className={styles.about}>{t("gate_no_account")}</p>
                ) : null}
                <div className={styles.actions}>
                    <Button
                        variant="accent"
                        disabled={!ready || phase.status === "loading"}
                        onClick={review}
                    >
                        {phase.status === "loading"
                            ? t("place_reading")
                            : t("place_button")}
                    </Button>
                </div>
                {phase.status === "error" ? (
                    <Alert type="error" showIcon message={phase.text} />
                ) : null}
                {phase.status === "sent" ? (
                    <p className={styles.about}>
                        {t("place_done", {
                            count: phase.count,
                            when: new Date(phase.at).toLocaleString()
                        })}
                    </p>
                ) : null}
            </div>
            {phase.status === "review" && market ? (
                <ReviewDialog
                    review={phase.review}
                    trade={market.trade}
                    priced={market.priced}
                    accountName={account.name}
                    onCancel={() => setPhase({status: "idle"})}
                    onDone={count => {
                        if (alive.current) {
                            setPhase({
                                status: "sent",
                                count,
                                at: Date.now()
                            });
                        }
                    }}
                />
            ) : null}
        </section>
    );
}
