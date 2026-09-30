// TypeScript/functional-component port of the legacy
// PriceAlertNotifications.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: purely compares market prices to
// user-set alert thresholds and fires UI notifications.
//
// This component never renders anything (`render()` always returns
// `null`) - its whole purpose is a side effect (firing notifications,
// dispatching `SettingsActions.setPriceAlert` to drop fulfilled rules)
// that the original ran directly inside `render()`, unconditionally, on
// *every* render (mount included - there's no lifecycle gating at all,
// unlike every other render-adjacent method ported elsewhere in this
// migration). Translated to a `useEffect` keyed on `[priceAlert,
// allMarketStats]` with no mount-skip guard, since the original's
// behavior already includes the mount case - this also moves the side
// effect from render phase to commit phase, which doesn't change
// anything observable for a component that renders nothing else.
//
// `connect(Component, {listenTo: [MarketsStore, SettingsStore],
// getProps})` - both `allMarketStats`/`priceAlert` are genuinely used -
// replicated with `useAltStore(MarketsStore)` + `useAltStore
// (SettingsStore)`.
import * as React from "react";
import MarketsStore from "../stores/MarketsStore";
import SettingsStore from "../stores/SettingsStore";
import {PRICE_ALERT_TYPES} from "../services/Exchange";
import {Notification, Icon} from "bitshares-ui-style-guide";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import SettingsActions from "../actions/SettingsActions";
import AssetName from "./Utility/AssetName";
import {useAltStore} from "../next/hooks/useAltStore";

function getRulesForCheck(priceAlertRules: any[], markets: any) {
    return priceAlertRules.map((rule, key) => {
        const pair = `${rule.quoteAssetSymbol}_${rule.baseAssetSymbol}`;

        let price = null;

        try {
            const market = markets.get(pair);

            price = market && market.price && market.price.toReal();
        } catch (e) {
            console.error(
                `PriceAlertNotifications: Unable to get real price for pair ${pair}: `,
                e
            );
        }

        return {
            ruleKey: key,
            type: rule.type,
            pair: pair,
            quoteAssetSymbol: rule.quoteAssetSymbol,
            baseAssetSymbol: rule.baseAssetSymbol,
            actualPrice: price,
            expectedPrice: rule.price
        };
    });
}

function getFulfilledRules(rules: any[]) {
    return rules.filter(rule => {
        if (isNaN(Number(rule.actualPrice))) return false;

        if (
            Number(rule.type) === Number((PRICE_ALERT_TYPES as any).HIGHER_THAN) &&
            Number(rule.actualPrice) >= Number(rule.expectedPrice)
        ) {
            return true;
        } else if (
            Number(rule.type) === Number((PRICE_ALERT_TYPES as any).LOWER_THAN) &&
            Number(rule.actualPrice) <= Number(rule.expectedPrice)
        ) {
            return true;
        }

        return false;
    });
}

function filterByFulfilledRules(fulfilledRules: any[]) {
    return (_rule: any, key: number) => {
        return !fulfilledRules.some(fulfilledRule => {
            return key === fulfilledRule.ruleKey;
        });
    };
}

function notifyAboutRules(rules: any[]) {
    // Notification.

    rules.forEach(rule => {
        if (Number(rule.type) === Number((PRICE_ALERT_TYPES as any).LOWER_THAN)) {
            (Notification as any).info({
                duration: 30,
                message: counterpart.translate("exchange.price_alert.title"),
                description: (
                    <Translate
                        content="exchange.price_alert.notification.lower_than"
                        component="div"
                        pair={
                            <span className="price-alert--notification--pair-name">
                                <AssetName name={rule.quoteAssetSymbol} />/
                                <AssetName name={rule.baseAssetSymbol} />
                            </span>
                        }
                        expectedPrice={
                            <span className="price-alert--notification--expected-price">
                                {rule.expectedPrice}
                            </span>
                        }
                        actualPrice={
                            <span className="price-alert--notification--actual-price price-alert--notification--actual-price-down">
                                {rule.actualPrice}
                            </span>
                        }
                    />
                ),
                icon: (
                    <Icon
                        type="caret-down"
                        className="price-alert--notification--icon price-alert--notification--icon--down"
                    />
                )
            });
        }

        if (Number(rule.type) === Number((PRICE_ALERT_TYPES as any).HIGHER_THAN)) {
            (Notification as any).info({
                duration: 30,
                message: counterpart.translate("exchange.price_alert.title"),
                description: (
                    <Translate
                        content="exchange.price_alert.notification.higher_than"
                        component="div"
                        pair={
                            <span className="price-alert--notification--pair-name">
                                <AssetName name={rule.quoteAssetSymbol} />/
                                <AssetName name={rule.baseAssetSymbol} />
                            </span>
                        }
                        expectedPrice={
                            <span className="price-alert--notification--expected-price">
                                {rule.expectedPrice}
                            </span>
                        }
                        actualPrice={
                            <span className="price-alert--notification--actual-price price-alert--notification--actual-price-up">
                                {rule.actualPrice}
                            </span>
                        }
                    />
                ),
                icon: (
                    <Icon
                        type="caret-up"
                        className="price-alert--notification--icon price-alert--notification--icon--up"
                    />
                )
            });
        }
    });
}

export default function PriceAlertNotifications() {
    const marketsState = useAltStore<any>(MarketsStore);
    const settingsState = useAltStore<any>(SettingsStore);
    const allMarketStats = marketsState.allMarketStats;
    const priceAlert = settingsState.priceAlert.toJS();

    React.useEffect(() => {
        if (
            !priceAlert ||
            !priceAlert.length ||
            !allMarketStats ||
            !allMarketStats.size
        ) {
            return;
        }

        const notificationsRules = getRulesForCheck(priceAlert, allMarketStats);

        // do notifications for
        const fulfilledRules = getFulfilledRules(notificationsRules);

        notifyAboutRules(fulfilledRules);

        // update notifications array
        const updatedPriceAlert = priceAlert.filter(
            filterByFulfilledRules(fulfilledRules)
        );

        if (updatedPriceAlert.length !== priceAlert.length) {
            (SettingsActions as any).setPriceAlert(updatedPriceAlert);
        }
    }, [priceAlert, allMarketStats]);

    return null;
}
