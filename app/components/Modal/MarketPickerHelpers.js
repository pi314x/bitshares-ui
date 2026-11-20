// (the order of a search's results is shared with the market picker)
import {sortMarketsList} from "../Exchange/MarketPickerHelpers";
import {ChainStore} from "bitsharesjs";

function lookupAssets(value, gatewayAssets = false, getAssetList, setState) {
    if (!value && value !== "") return;

    let quote = value.toUpperCase();

    if (quote.startsWith("BIT") && quote.length >= 6) {
        quote = value.substr(3, quote.length - 1);
    }

    getAssetList(quote, 10, gatewayAssets);

    setState({lookupQuote: quote});
}

function lookupAccountAssets(
    value,
    toFind,
    start,
    gatewayAssets = false,
    getAssetList,
    setState
) {
    if (!value && value !== "") return;

    getAssetList(value, 10, start, gatewayAssets);

    setState({lookupQuote: toFind});
}

function assetFilter(
    // marketPickerAsset stays: callers pass it and TypeScript checks them against this shape
    // eslint-disable-next-line no-unused-vars
    {searchAssets, marketPickerAsset /*, baseAsset, quoteAsset*/},
    {inputValue, lookupQuote},
    setState,
    checkAndUpdateMarketList
) {
    setState({activeSearch: true});

    let assetCount = 0;
    let allMarkets = [];

    if (searchAssets.size && !!inputValue && inputValue.length > 2) {
        searchAssets
            .filter(a => {
                try {
                    if (a.options.description) {
                        let description = JSON.parse(a.options.description);
                        if ("visible" in description) {
                            if (!description.visible) return false;
                        }
                    }
                } catch (e) {}

                return a.symbol.indexOf(lookupQuote) !== -1;
            })
            .forEach(asset => {
                if (assetCount > 100) return;
                assetCount++;

                let issuerName = fetchIssuerName(asset.issuer);
                let marketID = asset.symbol;
                allMarkets.push([
                    marketID,
                    {
                        id: asset.id,
                        quote: asset.symbol,
                        base: "",
                        issuerId: asset.issuer,
                        issuer: issuerName
                    }
                ]);
            });
    }

    const marketsList = sortMarketsList(allMarkets, inputValue);
    checkAndUpdateMarketList(marketsList);
}

function fetchIssuerName(issuerId) {
    let issuer = ChainStore.getObject(issuerId, false, false);
    if (!issuer) {
        return;
    } else {
        return issuer.get("name");
    }
}

export {lookupAssets, assetFilter, fetchIssuerName, lookupAccountAssets};
