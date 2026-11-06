// What instant trade is, on the page that does it: a short answer always in view, and the
// rest (what it costs, why it can fail, how it differs from Trade) one tap away.
import * as React from "react";
import counterpart from "counterpart";
import {Collapse} from "../../design-system/Collapse";
import styles from "./QuickTradeHelp.module.scss";

const t = (key: string) =>
    counterpart.translate(`exchange.quick_trade_help.${key}`) as string;

const POINTS = [
    "amounts",
    "all_or_nothing",
    "price",
    "costs",
    "moves",
    "trade"
];

export default function QuickTradeHelp() {
    return (
        <div className={styles.help}>
            <p className={styles.lead}>{t("lead")}</p>
            <Collapse className={styles.more}>
                <Collapse.Panel header={t("more")}>
                    <dl className={styles.points}>
                        {POINTS.map(point => (
                            <div className={styles.point} key={point}>
                                <dt>{t(`${point}_title`)}</dt>
                                <dd>{t(`${point}_text`)}</dd>
                            </div>
                        ))}
                    </dl>
                </Collapse.Panel>
            </Collapse>
        </div>
    );
}
