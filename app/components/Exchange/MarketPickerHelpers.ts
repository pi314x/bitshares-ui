// TypeScript port of the legacy MarketPickerHelpers.js (Phase 4,
// docs/UI_MIGRATION_PLAN.md) - pure helper functions for the market
// picker's asset search/sort, used by `MarketPicker.jsx` (not yet
// ported) and reused unchanged by `CreatePoolModal.jsx`/
// `QuickTrade/QuickTrade.jsx`. No React involved; mechanical
// `.js`->`.ts` translation, no logic changes.
import {hasGatewayPrefix} from "common/gatewayUtils";
import {ChainStore} from "bitsharesjs";

function lookupAssets(
    value: any,
    gatewayAssets = false,
    getAssetList: (...args: any[]) => any,
    setState: (...args: any[]) => any
) {
    if (!value && value !== "") return;

    let quote = value.toUpperCase();

    if (quote.startsWith("BIT") && quote.length >= 6) {
        quote = value.substr(3, quote.length - 1);
    }

    getAssetList(quote, 10, gatewayAssets);

    setState({lookupQuote: quote});
}

function assetFilter(
    {
        searchAssets,
        marketPickerAsset,
        baseAsset,
        quoteAsset
    }: {
        searchAssets: any;
        marketPickerAsset: any;
        baseAsset: any;
        quoteAsset: any;
    },
    {inputValue, lookupQuote}: {inputValue: any; lookupQuote: any},
    setState: (...args: any[]) => any,
    checkAndUpdateMarketList: (...args: any[]) => any
) {
    setState({activeSearch: true});

    let assetCount = 0;
    const allMarkets: any[] = [];

    const baseSymbol = baseAsset.get("symbol");
    const quoteSymbol = quoteAsset.get("symbol");

    if (searchAssets.size && !!inputValue && inputValue.length > 2) {
        searchAssets
            .filter((a: any) => {
                try {
                    if (a.options.description) {
                        const description = JSON.parse(a.options.description);
                        if ("visible" in description) {
                            if (!description.visible) return false;
                        }
                    }
                } catch (e) {}

                return a.symbol.indexOf(lookupQuote) !== -1;
            })
            .forEach((asset: any) => {
                if (assetCount > 100) return;
                assetCount++;

                const issuerName = fetchIssuerName(asset.issuer);

                const base = baseAsset.get("symbol");
                const marketID = asset.symbol + "_" + base;

                const isQuoteAsset = quoteSymbol == marketPickerAsset;
                const includeAsset =
                    (isQuoteAsset && asset.symbol != baseSymbol) ||
                    (!isQuoteAsset && asset.symbol != quoteSymbol);

                if (includeAsset) {
                    allMarkets.push([
                        marketID,
                        {
                            quote: asset.symbol,
                            base: base,
                            issuerId: asset.issuer,
                            issuer: issuerName
                        }
                    ]);
                }
            });
    }

    const marketsList = sortMarketsList(allMarkets, inputValue);
    checkAndUpdateMarketList(marketsList);
}

function getMarketSortComponents(market: any) {
    const weight: any = {};
    const quote = market.quote;
    if (quote.indexOf(".") !== -1) {
        const [gateway, asset] = quote.split(".");
        weight.gateway = gateway;
        weight.asset = asset;
    } else {
        weight.asset = quote;
    }
    if (market.issuerId === "1.2.0") weight.isCommittee = true;
    return weight;
}

function sortMarketsList(allMarkets: any[], inputValue: string) {
    if (inputValue.startsWith("BIT") && inputValue.length >= 6) {
        inputValue = inputValue.substr(3, inputValue.length - 1);
    }
    return allMarkets.sort(([, marketA]: any, [, marketB]: any) => {
        const weightA = getMarketSortComponents(marketA);
        const weightB = getMarketSortComponents(marketB);

        if (weightA.asset !== weightB.asset) {
            if (weightA.asset === inputValue) return -1;
            if (weightB.asset === inputValue) return 1;
            if (weightA.asset > weightB.asset) return -1;
            if (weightA.asset < weightB.asset) return 1;
        }

        if (weightA.isCommittee ^ weightB.isCommittee) {
            if (weightA.isCommittee) return -1;
            if (weightB.isCommittee) return 1;
        }

        const aIsKnownGateway = hasGatewayPrefix(marketA.quote);
        const bIsKnownGateway = hasGatewayPrefix(marketB.quote);
        if (aIsKnownGateway && !bIsKnownGateway) return -1;
        if (bIsKnownGateway && !aIsKnownGateway) return 1;

        if (weightA.gateway > weightB.gateway) return 1;
        if (weightA.gateway < weightB.gateway) return -1;
        return 0;
    });
}

function fetchIssuerName(issuerId: string) {
    const issuer = (ChainStore as any).getObject(issuerId, false, false);
    if (!issuer) {
        return;
    } else {
        return issuer.get("name");
    }
}

export {lookupAssets, assetFilter, fetchIssuerName};
