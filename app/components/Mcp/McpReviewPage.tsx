// The review of a transaction an AI assistant prepared (MCP, docs/MCP.md): the page a link
// from the MCP server opens. The assistant cannot sign; the person reads what the
// application makes of the transaction, and signs it with their own wallet (the local
// wallet, or the browser extension with its own approval window) - or closes the page. The
// document in the link is read strictly and judged with the application's own data (see
// lib/common/mcpReview.ts); the words on this page are made from the operations, never taken
// from the document. Only in a build made with MCP_TRADING_ENABLED=true.
import * as React from "react";
import counterpart from "counterpart";
import {useNavigate} from "react-router-dom";
import {Alert} from "../../design-system/Alert";
import {Button} from "../../design-system/Button";
import {ButtonRow} from "../../design-system/ButtonRow";
import {Checkbox} from "../../design-system/Checkbox";
import {useOperationSubmit} from "../Utility/OperationDialog";
import {idOf, useCurrentAccount} from "../Advanced/fields";
import McpReviewActions, {ReviewAsset} from "../../actions/McpReviewActions";
import {parseOperationJson} from "../../lib/common/opJson";
import {
    MAX_DEVIATION_PERCENT,
    PriceAssessment,
    Problem,
    Proposal,
    assessPrice,
    computedReference,
    decode,
    lookupProblems,
    minutesLeft,
    problems as stateProblems,
    readPayload
} from "../../lib/common/mcpReview";
import {OPERATIONS, summarize} from "../../../mcp/src/proposal";
import {fromUnits} from "../../../mcp/src/format";
import styles from "./Mcp.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`mcp.review.${key}`, params) as string;

type Mark = "ok" | "warn" | "bad";

function Check({mark, children}: {mark: Mark; children: React.ReactNode}) {
    const cls =
        mark === "ok"
            ? styles.markOk
            : mark === "warn"
            ? styles.markWarn
            : styles.markBad;
    return (
        <li>
            <span className={`${styles.mark} ${cls}`} aria-hidden="true" />
            <span>{children}</span>
        </li>
    );
}

const OPERATION_NAME: Record<number, string> = {
    [OPERATIONS.limit_order_create]: "limit_order_create",
    [OPERATIONS.limit_order_cancel]: "limit_order_cancel"
};

/** The ids of the assets an operation names. */
function assetIds(proposal: Proposal): string[] {
    const [id, fields] = proposal.ops[0];
    return id === OPERATIONS.limit_order_create
        ? [fields.amount_to_sell.asset_id, fields.min_to_receive.asset_id]
        : [];
}

const amountText = (
    a: {amount: string; asset_id: string},
    assets: Record<string, ReviewAsset>
) => {
    const asset = assets[a.asset_id];
    return asset
        ? `${fromUnits(BigInt(a.amount), asset.precision)} ${asset.symbol}`
        : `${a.amount} ${a.asset_id}`;
};

export default function McpReviewPage() {
    const navigate = useNavigate();
    const me = useCurrentAccount();
    const accountId = idOf(me.account);
    const payload = React.useMemo(() => readPayload(window.location.href), []);
    const decoded = React.useMemo(() => decode(payload), [payload]);
    const proposal: Proposal | null = decoded.ok ? decoded.proposal : null;

    const [now, setNow] = React.useState(() => Date.now());
    React.useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 15000);
        return () => clearInterval(timer);
    }, []);

    // what the chain says: the assets, the market (an order), the order (a cancellation)
    const [assets, setAssets] = React.useState<Record<string, ReviewAsset>>({});
    const [assetsDone, setAssetsDone] = React.useState(false);
    const [ticker, setTicker] = React.useState<any | undefined>(undefined);
    const [order, setOrder] = React.useState<any | null | undefined>(undefined);
    const [acknowledged, setAcknowledged] = React.useState(false);
    const [done, setDone] = React.useState(false);
    const [chainId, setChainId] = React.useState<string | null>(() =>
        McpReviewActions.chainId()
    );

    React.useEffect(() => {
        if (chainId) return;
        const timer = setInterval(
            () => setChainId(McpReviewActions.chainId()),
            1000
        );
        return () => clearInterval(timer);
    }, [chainId]);

    React.useEffect(() => {
        if (!proposal || !chainId || proposal.chain !== chainId) return;
        let cancelled = false;
        const [kind, fields] = proposal.ops[0];
        const ids = assetIds(proposal);
        const load = async () => {
            try {
                if (kind === OPERATIONS.limit_order_create) {
                    const found = await McpReviewActions.getAssets(ids);
                    if (cancelled) return;
                    setAssets(found);
                    setAssetsDone(true);
                    if (found[ids[0]] && found[ids[1]]) {
                        const market = await McpReviewActions.getTicker(
                            ids[0],
                            ids[1]
                        ).catch(() => null);
                        if (!cancelled) setTicker(market);
                    } else {
                        setTicker(null);
                    }
                } else {
                    const found = await McpReviewActions.getOrder(fields.order);
                    if (cancelled) return;
                    setOrder(found);
                    if (found) {
                        const info = await McpReviewActions.getAssets([
                            found.sell_price.base.asset_id,
                            found.sell_price.quote.asset_id
                        ]);
                        if (!cancelled) setAssets(info);
                    }
                    setAssetsDone(true);
                }
            } catch (e) {
                if (cancelled) return;
                setAssetsDone(true);
                setTicker(null);
                setOrder((prev: any) => (prev === undefined ? null : prev));
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [proposal, chainId]);

    const {submitting, error, run} = useOperationSubmit(
        true,
        () => setDone(true),
        t("sent")
    );

    if (!payload) {
        return (
            <div className={styles.page}>
                <h2 className={styles.title}>{t("title")}</h2>
                <Alert
                    type="info"
                    showIcon
                    message={t("none_title")}
                    description={t("none_text")}
                />
            </div>
        );
    }
    if (!decoded.ok || !proposal) {
        const code = decoded.ok ? "fields" : decoded.error;
        return (
            <div className={styles.page}>
                <h2 className={styles.title}>{t("title")}</h2>
                <Alert
                    type="error"
                    showIcon
                    message={t("error_title")}
                    description={`${t("error_text", {code})}${
                        !decoded.ok && decoded.detail
                            ? ` (${decoded.detail})`
                            : ""
                    }`}
                />
            </div>
        );
    }

    const [kind, fields] = proposal.ops[0];
    const isCreate = kind === OPERATIONS.limit_order_create;
    const reference = computedReference(proposal, McpReviewActions.sha256Hex);
    const shown: Proposal = {...proposal};
    const blocking: Problem[] = stateProblems(shown, {
        now,
        chainId,
        accountId,
        sha256Hex: McpReviewActions.sha256Hex
    });
    const lookups: Problem[] = assetsDone
        ? lookupProblems(shown, assets, isCreate ? undefined : order)
        : [];
    const price: PriceAssessment | null =
        isCreate && assetsDone && ticker !== undefined
            ? assessPrice(shown, assets, ticker)
            : null;
    const left = minutesLeft(shown, now);
    const has = (p: Problem) =>
        blocking.indexOf(p) !== -1 || lookups.indexOf(p) !== -1;
    // an order is judged once the market has answered; a cancellation once the order has
    const judged = isCreate
        ? price !== null
        : assetsDone && order !== undefined;
    const needsAck =
        !!price && (price.kind === "worse" || price.kind === "unpriced");
    const canSign =
        !has("reference") &&
        !has("expired") &&
        !has("chain") &&
        !has("account") &&
        !has("asset_unknown") &&
        !has("order_missing") &&
        !has("order_not_yours") &&
        judged &&
        (!needsAck || acknowledged) &&
        !done;

    const lookup = (id: string) =>
        assets[id]
            ? {symbol: assets[id].symbol, precision: assets[id].precision}
            : null;
    const words = isCreate
        ? summarize(shown.ops[0] as any, lookup)
        : order
        ? `${t("cancel_order")} ${fields.order}: ${amountText(
              {
                  amount: String(order.for_sale),
                  asset_id: order.sell_price.base.asset_id
              },
              assets
          )}`
        : `${t("cancel_order")} ${fields.order}`;

    const onSign = () => {
        const name = OPERATION_NAME[kind];
        const built = parseOperationJson(name, JSON.stringify(fields));
        if (!built.ok) return;
        run(() => McpReviewActions.send(name, built.op[1]));
    };

    const side =
        price && "percent" in price
            ? price.percent >= 0
                ? "above"
                : "below"
            : "";
    const priceUnit =
        isCreate &&
        assets[fields.amount_to_sell.asset_id] &&
        assets[fields.min_to_receive.asset_id]
            ? `${assets[fields.amount_to_sell.asset_id].symbol} / ${
                  assets[fields.min_to_receive.asset_id].symbol
              }`
            : "";

    return (
        <div className={styles.page}>
            <h2 className={styles.title}>{t("title")}</h2>
            <Alert
                type="warning"
                showIcon
                message={t("banner_title")}
                description={t("banner_text")}
            />

            <section className={styles.card} aria-label={t("what")}>
                <h3 className={styles.heading}>{t("what")}</h3>
                <p className={styles.summary}>{words}</p>
                <dl className={styles.facts}>
                    <dt>{t("account")}</dt>
                    <dd>
                        {shown.account.name} ({shown.account.id})
                    </dd>
                    {isCreate ? (
                        <>
                            <dt>{t("sell")}</dt>
                            <dd>{amountText(fields.amount_to_sell, assets)}</dd>
                            <dt>{t("receive")}</dt>
                            <dd>{amountText(fields.min_to_receive, assets)}</dd>
                            <dt>{t("open_until")}</dt>
                            <dd>
                                {String(fields.expiration).replace("T", " ")}{" "}
                                UTC
                            </dd>
                            <dt>{t("fill_or_kill")}</dt>
                            <dd>{t(fields.fill_or_kill ? "yes" : "no")}</dd>
                        </>
                    ) : (
                        <>
                            <dt>{t("order")}</dt>
                            <dd>{fields.order}</dd>
                        </>
                    )}
                </dl>
                <div>
                    <div className={styles.muted}>{t("reference_title")}</div>
                    <span className={styles.reference}>{reference}</span>
                    <div className={styles.muted}>{t("reference_help")}</div>
                </div>
            </section>

            <section className={styles.card} aria-label={t("checks_title")}>
                <h3 className={styles.heading}>{t("checks_title")}</h3>
                <ul className={styles.checks}>
                    {has("reference") ? (
                        <Check mark="bad">{t("ref_bad")}</Check>
                    ) : (
                        <Check mark="ok">{t("ref_ok")}</Check>
                    )}
                    {has("expired") ? (
                        <Check mark="bad">{t("expired")}</Check>
                    ) : (
                        <Check mark="ok">{t("fresh", {minutes: left})}</Check>
                    )}
                    {!chainId ? (
                        <Check mark="warn">{t("chain_wait")}</Check>
                    ) : has("chain") ? (
                        <Check mark="bad">{t("chain_bad")}</Check>
                    ) : (
                        <Check mark="ok">{t("chain_ok")}</Check>
                    )}
                    {has("account") ? (
                        <Check mark="bad">
                            {me.name
                                ? t("account_bad", {
                                      name: shown.account.name,
                                      current: me.name
                                  })
                                : t("account_none", {name: shown.account.name})}
                        </Check>
                    ) : (
                        <Check mark="ok">
                            {t("account_ok", {name: shown.account.name})}
                        </Check>
                    )}
                    {has("asset_unknown") ? (
                        <Check mark="bad">{t("assets_unknown")}</Check>
                    ) : null}
                    {!isCreate && assetsDone ? (
                        has("order_missing") ? (
                            <Check mark="bad">{t("order_missing")}</Check>
                        ) : has("order_not_yours") ? (
                            <Check mark="bad">{t("order_not_yours")}</Check>
                        ) : (
                            <Check mark="ok">
                                {t("order_ok", {name: shown.account.name})}
                            </Check>
                        )
                    ) : null}
                    {isCreate && !assetsDone ? (
                        <Check mark="warn">{t("price_loading")}</Check>
                    ) : null}
                    {price && price.kind === "ok" ? (
                        <Check mark="ok">
                            {t(
                                Math.abs(price.percent) < 0.005
                                    ? "price_at"
                                    : "price_ok",
                                {
                                    percent: Math.abs(price.percent).toFixed(2),
                                    side: t(side),
                                    market: Number(price.market.toPrecision(6)),
                                    unit: priceUnit
                                }
                            )}
                        </Check>
                    ) : null}
                    {price && price.kind === "worse" ? (
                        <Check mark="bad">
                            {t("price_worse", {
                                percent: price.percent.toFixed(2),
                                market: Number(price.market.toPrecision(6)),
                                unit: priceUnit,
                                limit: MAX_DEVIATION_PERCENT
                            })}
                        </Check>
                    ) : null}
                    {price && price.kind === "unpriced" ? (
                        <Check mark="warn">{t("price_unpriced")}</Check>
                    ) : null}
                </ul>
                {needsAck ? (
                    <Checkbox
                        checked={acknowledged}
                        onChange={e => setAcknowledged(e.target.checked)}
                    >
                        {t("acknowledge")}
                    </Checkbox>
                ) : null}
            </section>

            {done ? (
                <Alert
                    type="success"
                    showIcon
                    message={t("done_title")}
                    description={t("done_text")}
                />
            ) : null}
            {error ? <Alert type="error" showIcon message={error} /> : null}
            <ButtonRow>
                <Button
                    variant="accent"
                    onClick={onSign}
                    disabled={!canSign || submitting}
                    loading={submitting}
                >
                    {t("sign")}
                </Button>
                <Button
                    onClick={() => navigate(done ? "/portfolio" : "/")}
                    disabled={submitting}
                >
                    {t(done ? "to_portfolio" : "close")}
                </Button>
            </ButtonRow>
        </div>
    );
}
