// Redux-backed replacement for the Alt.js AssetActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves the exact
// method names and logic the original action creators ran.
//
// Only 3 of these methods were ever bound to `AssetStore`'s
// `bindListeners` (`getAssetList`, `lookupAsset`, `getAssetsByIssuer` -
// see `app/store/slices/assetSlice.ts`) - those dispatch into the Redux
// store at the exact point the original called Alt's `dispatch(...)`.
// The rest (`publishFeed`, `fundPool`, `claimPool`, `bidCollateral`,
// `updateOwner`, `updateFeedProducers`, `claimPoolFees`,
// `claimCollateralFees`, `assetGlobalSettle`, `createAsset`,
// `reserveAsset`) are transaction-signing action creators that called
// Alt's `dispatch(true)`/`dispatch(false)` after submitting a
// transaction, but no store anywhere binds a listener to them - that
// dispatch was already a complete no-op under Alt (nothing in
// `model.actionListeners` for those action ids), so it's dropped here
// rather than wired to a slice that doesn't exist. Each method's actual
// observable behavior - the promise it returns, and whether that promise
// resolves to `undefined` (the `dispatch => {...}` wrapper pattern,
// whose `.then()`/`.catch()` callbacks never returned a value) or to
// `true`/`false` (methods, like `reserveAsset`/`updateAsset`, whose
// `.then()`/`.catch()` callbacks explicitly did) - is preserved exactly.
//
// Every real Alt action also gets a `.defer(...args)` method for free
// (`alt/src/actions/index.js`), used by a real call site
// (`Explorer/Assets.tsx`'s `(AssetActions.getAssetList as
// any).defer(...)`). `withDefer` below replicates that exact mechanic
// for each exported method.
import {reduxStore} from "../store/reduxStore";
import {Apis} from "bitsharesjs-ws";
import utils from "common/utils";
import WalletApi from "api/WalletApi";
import WalletDb from "stores/WalletDb";
import {ChainStore} from "bitsharesjs";
import big from "bignumber.js";
import {gatewayPrefixes} from "common/gateways";
import {
    onGetAssetList,
    onGetAssetsByIssuer,
    onLookupAsset
} from "../store/slices/assetSlice";

const inProgress: {[key: string]: boolean} = {};

type Deferrable<T extends (...args: any[]) => any> = T & {
    defer: (...args: Parameters<T>) => void;
};

function withDefer<T extends (...args: any[]) => any>(fn: T): Deferrable<T> {
    const deferrable = fn as Deferrable<T>;
    deferrable.defer = (...args: Parameters<T>) =>
        setTimeout(() => fn(...args));
    return deferrable;
}

function publishFeed({publisher, asset_id, mcr, mssr, feedPrice, cer}: any) {
    const tr = WalletApi.new_transaction();
    /**
     * The naming convention is confusing!
     *
     * bitshares-core knows only settlement_price, which is the feed price as known from UI!
     *
     * UI definition:
     *  - Feed Price: Witness fed price, given by backend as settlement_price
     *  - Settlement Price: feed price * force settlement offset factor
     *
     */
    tr.add_type_operation("asset_publish_feed", {
        publisher,
        asset_id,
        feed: {
            settlement_price: feedPrice.toObject(),
            maintenance_collateral_ratio: mcr,
            maximum_short_squeeze_ratio: mssr,
            core_exchange_rate: cer.toObject()
        }
    });

    return WalletDb.process_transaction(tr, null, true)
        .then(() => {})
        .catch((error: any) => {
            console.log("----- fundPool error ----->", error);
        });
}

function fundPool(account_id: any, core: any, asset: any, amount: any) {
    const tr = WalletApi.new_transaction();
    const precision = utils.get_asset_precision(core.get("precision"));
    tr.add_type_operation("asset_fund_fee_pool", {
        fee: {
            amount: 0,
            asset_id: "1.3.0"
        },
        from_account: account_id,
        asset_id: asset.get("id"),
        amount: amount * precision
    });

    return WalletDb.process_transaction(tr, null, true)
        .then(() => {})
        .catch((error: any) => {
            console.log("----- fundPool error ----->", error);
        });
}

function claimPool(asset: any, amount: any) {
    const tr = WalletApi.new_transaction();
    tr.add_type_operation("asset_claim_pool", {
        fee: {
            amount: 0,
            asset_id: "1.3.0"
        },
        issuer: asset.get("issuer"),
        asset_id: asset.get("id"),
        amount_to_claim: amount.toObject()
    });
    return WalletDb.process_transaction(tr, null, true)
        .then(() => {})
        .catch((error: any) => {
            console.log("----- claimPool error ----->", error);
        });
}

function bidCollateral(
    account_id: any,
    core: any,
    asset: any,
    coll: any,
    debt: any
) {
    const core_precision = utils.get_asset_precision(core.get("precision"));
    const asset_precision = utils.get_asset_precision(asset.get("precision"));

    const tr = WalletApi.new_transaction();
    tr.add_type_operation("bid_collateral", {
        fee: {
            amount: 0,
            asset_id: "1.3.0"
        },
        bidder: account_id,
        additional_collateral: {
            amount: Math.round(coll * core_precision),
            asset_id: core.get("id")
        },
        debt_covered: {
            amount: Math.round(debt * asset_precision),
            asset_id: asset.get("id")
        },
        extensions: []
    });

    return WalletDb.process_transaction(tr, null, true)
        .then(() => {})
        .catch((error: any) => {
            console.log("----- collateralBid error ----->", error);
        });
}

function updateOwner(asset: any, new_issuer_id: any) {
    const tr = WalletApi.new_transaction();
    tr.add_type_operation("asset_update_issuer", {
        fee: {
            amount: 0,
            asset_id: "1.3.0"
        },
        issuer: asset.issuer,
        asset_to_update: asset.id,
        new_issuer: new_issuer_id
    });
    return WalletDb.process_transaction(tr, null, true)
        .then(() => {})
        .catch((error: any) => {
            console.log("----- updateOwner error ----->", error);
        });
}

function updateFeedProducers(account: any, asset: any, producers: any) {
    const tr = WalletApi.new_transaction();
    tr.add_type_operation("asset_update_feed_producers", {
        fee: {
            amount: 0,
            asset_id: "1.3.0"
        },
        issuer: account,
        asset_to_update: asset.get("id"),
        new_feed_producers: producers
    });

    return WalletDb.process_transaction(tr, null, true)
        .then(() => {})
        .catch((error: any) => {
            console.log("----- updateFeedProducers error ----->", error);
        });
}

function claimPoolFees(account_id: any, asset: any, amount: any) {
    const tr = WalletApi.new_transaction();

    tr.add_type_operation("asset_claim_fees", {
        fee: {
            amount: 0,
            asset_id: 0
        },
        issuer: account_id,
        amount_to_claim: {
            asset_id: asset.get("id"),
            amount: amount.getAmount()
        }
    });
    return WalletDb.process_transaction(tr, null, true)
        .then(() => {})
        .catch((error: any) => {
            console.log("----- claimFees error ----->", error);
        });
}

function claimCollateralFees(
    account_id: any,
    asset: any,
    backingAsset: any,
    claimFeesAmountAsset: any
) {
    const tr = WalletApi.new_transaction();

    tr.add_type_operation("asset_claim_fees", {
        fee: {
            amount: 0,
            asset_id: 0
        },
        issuer: account_id,
        amount_to_claim: {
            asset_id: backingAsset.asset_id,
            amount: claimFeesAmountAsset.getAmount()
        },
        extensions: {
            claim_from_asset_id: asset.get("id")
        }
    });
    return WalletDb.process_transaction(tr, null, true)
        .then(() => {})
        .catch((error: any) => {
            console.log("----- claimFees error ----->", error);
        });
}

function assetGlobalSettle(asset: any, account_id: any, price: any) {
    const tr = WalletApi.new_transaction();

    tr.add_type_operation("asset_global_settle", {
        fee: {
            amount: 0,
            asset_id: 0
        },
        issuer: account_id,
        asset_to_settle: asset.id,
        settle_price: price
    });
    return WalletDb.process_transaction(tr, null, true)
        .then(() => {})
        .catch((error: any) => {
            console.log(
                "[AssetActions.js:223] ----- assetGlobalSettle error ----->",
                error
            );
        });
}

function createAsset(
    account_id: any,
    createObject: any,
    flags: any,
    permissions: any,
    cer: any,
    isBitAsset: any,
    is_prediction_market: any,
    bitasset_opts: any,
    description: any
) {
    // Create asset action here...
    console.log(
        "create asset:",
        createObject,
        "flags:",
        flags,
        "isBitAsset:",
        isBitAsset,
        "bitasset_opts:",
        bitasset_opts
    );
    const tr = WalletApi.new_transaction();
    const precision = utils.get_asset_precision(createObject.precision);
    big.config({DECIMAL_PLACES: createObject.precision});
    const max_supply = new big(createObject.max_supply)
        .times(precision)
        .toString();
    const max_market_fee = new big(createObject.max_market_fee || 0)
        .times(precision)
        .toString();
    const corePrecision = utils.get_asset_precision(
        ChainStore.getAsset(cer.base.asset_id).get("precision")
    );
    const operationJSON: any = {
        fee: {
            amount: 0,
            asset_id: 0
        },
        issuer: account_id,
        symbol: createObject.symbol,
        precision: parseInt(createObject.precision, 10),
        common_options: {
            max_supply: max_supply,
            market_fee_percent: createObject.market_fee_percent * 100 || 0,
            max_market_fee: max_market_fee,
            issuer_permissions: permissions,
            flags: flags,
            core_exchange_rate: {
                base: {
                    amount: cer.base.amount * corePrecision,
                    asset_id: cer.base.asset_id
                },
                quote: {
                    amount: cer.quote.amount * precision,
                    asset_id: "1.3.1"
                }
            },
            whitelist_authorities: [],
            blacklist_authorities: [],
            whitelist_markets: [],
            blacklist_markets: [],
            description: description,
            extensions: {
                reward_percent: createObject.reward_percent
                    ? createObject.reward_percent * 100
                    : undefined,
                whitelist_market_fee_sharing: [],
                taker_fee_percent: createObject.taker_fee_percent
                    ? createObject.taker_fee_percent * 100
                    : undefined
            }
        },
        is_prediction_market: is_prediction_market,
        extensions: null
    };
    if (isBitAsset) {
        operationJSON.bitasset_opts = bitasset_opts;
    }
    tr.add_type_operation("asset_create", operationJSON);
    return WalletDb.process_transaction(tr, null, true)
        .then(() => {})
        .catch((error: any) => {
            console.log("----- createAsset error ----->", error);
        });
}

function updateAsset(
    issuer: any,
    new_issuer: any,
    update: any,
    core_exchange_rate: any,
    asset: any,
    flags: any,
    permissions: any,
    isBitAsset: any,
    bitasset_opts: any,
    original_bitasset_opts: any,
    description: any,
    auths: any,
    feedProducers: any,
    originalFeedProducers: any,
    assetChanged: any
) {
    // Create asset action here...
    const tr = WalletApi.new_transaction();
    if (assetChanged) {
        const quotePrecision = utils.get_asset_precision(asset.get("precision"));

        big.config({DECIMAL_PLACES: asset.get("precision")});
        const max_supply = new big(update.max_supply)
            .times(quotePrecision)
            .toString();
        const max_market_fee = new big(update.max_market_fee || 0)
            .times(quotePrecision)
            .toString();

        const cr_quote_asset = ChainStore.getAsset(
            core_exchange_rate.quote.asset_id
        );
        const cr_quote_precision = utils.get_asset_precision(
            cr_quote_asset.get("precision")
        );
        const cr_base_asset = ChainStore.getAsset(
            core_exchange_rate.base.asset_id
        );
        const cr_base_precision = utils.get_asset_precision(
            cr_base_asset.get("precision")
        );

        const cr_quote_amount = new big(core_exchange_rate.quote.amount)
            .times(cr_quote_precision)
            .toString();
        const cr_base_amount = new big(core_exchange_rate.base.amount)
            .times(cr_base_precision)
            .toString();

        const extensions = asset.getIn(["options", "extensions"]).toJS();
        if (update.reward_percent !== undefined) {
            extensions.reward_percent = update.reward_percent * 100;
        }
        if (auths.whitelist_market_fee_sharing) {
            extensions.whitelist_market_fee_sharing = auths.whitelist_market_fee_sharing.toJS();
        }
        if (update.taker_fee_percent !== undefined) {
            extensions.taker_fee_percent = update.taker_fee_percent * 100;
        }
        const updateObject: any = {
            fee: {
                amount: 0,
                asset_id: 0
            },
            asset_to_update: asset.get("id"),
            extensions: asset.get("extensions"),
            issuer: issuer,
            new_issuer: new_issuer,
            new_options: {
                max_supply: max_supply,
                max_market_fee: max_market_fee,
                market_fee_percent: update.market_fee_percent * 100,
                description: description,
                issuer_permissions: permissions,
                flags: flags,
                whitelist_authorities: auths.whitelist_authorities.toJS(),
                blacklist_authorities: auths.blacklist_authorities.toJS(),
                whitelist_markets: auths.whitelist_markets.toJS(),
                blacklist_markets: auths.blacklist_markets.toJS(),
                extensions: extensions,
                core_exchange_rate: {
                    quote: {
                        amount: cr_quote_amount,
                        asset_id: core_exchange_rate.quote.asset_id
                    },
                    base: {
                        amount: cr_base_amount,
                        asset_id: core_exchange_rate.base.asset_id
                    }
                }
            }
        };

        if (issuer === new_issuer || !new_issuer) {
            delete updateObject.new_issuer;
        }
        tr.add_type_operation("asset_update", updateObject);
    }

    console.log(
        "bitasset_opts:",
        bitasset_opts,
        "original_bitasset_opts:",
        original_bitasset_opts
    );
    if (
        isBitAsset &&
        (bitasset_opts.feed_lifetime_sec !==
            original_bitasset_opts.feed_lifetime_sec ||
            bitasset_opts.minimum_feeds !==
                original_bitasset_opts.minimum_feeds ||
            bitasset_opts.force_settlement_delay_sec !==
                original_bitasset_opts.force_settlement_delay_sec ||
            bitasset_opts.force_settlement_offset_percent !==
                original_bitasset_opts.force_settlement_offset_percent ||
            bitasset_opts.maximum_force_settlement_volume !==
                original_bitasset_opts.maximum_force_settlement_volume ||
            bitasset_opts.short_backing_asset !==
                original_bitasset_opts.short_backing_asset)
    ) {
        const bitAssetUpdateObject = {
            fee: {
                amount: 0,
                asset_id: 0
            },
            asset_to_update: asset.get("id"),
            issuer: issuer,
            new_options: bitasset_opts
        };

        tr.add_type_operation("asset_update_bitasset", bitAssetUpdateObject);
    }

    console.log(
        "feedProducers:",
        feedProducers,
        "originalFeedProducers:",
        originalFeedProducers
    );
    if (
        isBitAsset &&
        !utils.are_equal_shallow(feedProducers, originalFeedProducers)
    ) {
        tr.add_type_operation("asset_update_feed_producers", {
            fee: {
                amount: 0,
                asset_id: "1.3.0"
            },
            issuer: issuer,
            asset_to_update: asset.get("id"),
            new_feed_producers: feedProducers
        });
    }

    return WalletDb.process_transaction(tr, null, true)
        .then((result: any) => {
            console.log("asset create result:", result);
            // this.dispatch(account_id);
            return true;
        })
        .catch((error: any) => {
            console.log("----- updateAsset error ----->", error);
            return false;
        });
}

async function loadAssets() {
    let start = "A";
    const count = 10;

    let assets: any[] = [];
    let newAssets: any = null;
    while (assets.length == 0 || newAssets == null || newAssets.length > 0) {
        newAssets = await Apis.instance()
            .db_api()
            .exec("list_assets", [start, count]);
        assets = assets.concat(newAssets);
        start = assets[assets.length - 1].symbol + ".";
    }
    console.log("Assets loaded: ", assets.length);
}

function getAssetList(
    start: any,
    count: any,
    includeGateways = false
) {
    const id = start + "_" + count;
    if (!inProgress[id]) {
        inProgress[id] = true;
        reduxStore.dispatch(onGetAssetList({loading: true}));

        const assets = Apis.instance()
            .db_api()
            .exec("list_assets", [start, count])
            .then((assets: any) => {
                const bitAssetIDS: any[] = [];
                const dynamicIDS: any[] = [];

                assets.forEach((asset: any) => {
                    ChainStore._updateObject(asset, false);
                    dynamicIDS.push(asset.dynamic_asset_data_id);

                    if (asset.bitasset_data_id) {
                        bitAssetIDS.push(asset.bitasset_data_id);
                    }
                });

                const dynamicPromise = Apis.instance()
                    .db_api()
                    .exec("get_objects", [dynamicIDS]);

                const bitAssetPromise =
                    bitAssetIDS.length > 0
                        ? Apis.instance()
                              .db_api()
                              .exec("get_objects", [bitAssetIDS])
                        : null;

                Promise.all([dynamicPromise, bitAssetPromise]).then(
                    (results: any) => {
                        delete inProgress[id];
                        reduxStore.dispatch(
                            onGetAssetList({
                                assets: assets,
                                dynamic: results[0],
                                bitasset_data: results[1],
                                loading: false
                            })
                        );
                        return assets && assets.length;
                    }
                );
            })
            .catch((error: any) => {
                console.log("Error in AssetActions.getAssetList: ", error);
                reduxStore.dispatch(onGetAssetList({loading: false}));
                delete inProgress[id];
            });

        // Fetch next 10 assets for each gateAsset on request
        if (includeGateways) {
            gatewayPrefixes.forEach((a: any) => {
                getAssetList(a + "." + start, 10);
            });
        }

        return assets;
    }
}

function getAssetsByIssuer(
    issuer: any,
    count: any,
    start: any,
    includeGateways = false
) {
    const id = issuer + "_" + count;
    console.log("getAssetsByIssuer id = ", id);
    if (!inProgress[id]) {
        inProgress[id] = true;
        reduxStore.dispatch(onGetAssetsByIssuer({loading: true}));

        const assets = Apis.instance()
            .db_api()
            .exec("get_assets_by_issuer", [issuer, start, count])
            .then((assets: any) => {
                const dynamicIDS: any[] = [];

                assets.forEach((asset: any) => {
                    ChainStore._updateObject(asset, false);
                    dynamicIDS.push(asset.dynamic_asset_data_id);
                });
                const dynamicPromise = Apis.instance()
                    .db_api()
                    .exec("get_objects", [dynamicIDS]);
                Promise.all([dynamicPromise]).then((results: any) => {
                    delete inProgress[id];
                    reduxStore.dispatch(
                        onGetAssetsByIssuer({
                            assets: assets,
                            dynamic: results[0],
                            loading: false
                        })
                    );
                    return assets && assets.length;
                });
            })
            .catch((error: any) => {
                console.log("Error in AssetActions.getAssetList: ", error);
                reduxStore.dispatch(onGetAssetsByIssuer({loading: false}));
                delete inProgress[id];
            });

        // Fetch next 10 assets for each gateAsset on request
        if (includeGateways) {
            gatewayPrefixes.forEach((a: any) => {
                getAssetList(a + "." + start, 10);
            });
        }

        return assets;
    }
}

function lookupAsset(symbol: any, searchID: any) {
    const asset = ChainStore.getAsset(symbol);
    if (asset) {
        const payload = {
            assets: [asset],
            searchID: searchID,
            symbol: symbol
        };
        reduxStore.dispatch(onLookupAsset(payload));
        return payload;
    } else {
        // Hack to retry once until we replace this method with a new api call to lookup multiple assets
        setTimeout(() => {
            const asset = ChainStore.getAsset(symbol);
            if (asset) {
                reduxStore.dispatch(
                    onLookupAsset({
                        assets: [asset],
                        searchID: searchID,
                        symbol: symbol
                    })
                );
            }
        }, 200);
    }
}

function reserveAsset(amount: any, assetId: any, payer: any) {
    const tr = WalletApi.new_transaction();
    tr.add_type_operation("asset_reserve", {
        fee: {
            amount: 0,
            asset_id: 0
        },
        amount_to_reserve: {
            amount: amount,
            asset_id: assetId
        },
        payer,
        extensions: []
    });
    return WalletDb.process_transaction(tr, null, true)
        .then(() => {
            return true;
        })
        .catch((error: any) => {
            console.log("----- reserveAsset error ----->", error);
            return false;
        });
}

const AssetActionsFacade = {
    publishFeed: withDefer(publishFeed),
    fundPool: withDefer(fundPool),
    claimPool: withDefer(claimPool),
    bidCollateral: withDefer(bidCollateral),
    updateOwner: withDefer(updateOwner),
    updateFeedProducers: withDefer(updateFeedProducers),
    claimPoolFees: withDefer(claimPoolFees),
    claimCollateralFees: withDefer(claimCollateralFees),
    assetGlobalSettle: withDefer(assetGlobalSettle),
    createAsset: withDefer(createAsset),
    updateAsset: withDefer(updateAsset),
    loadAssets: withDefer(loadAssets),
    getAssetList: withDefer(getAssetList),
    getAssetsByIssuer: withDefer(getAssetsByIssuer),
    lookupAsset: withDefer(lookupAsset),
    reserveAsset: withDefer(reserveAsset)
};

export default AssetActionsFacade;
