// Phase 9 (docs/UI_MIGRATION_PLAN.md): plain singleton replacing the real
// Alt `alt.createActions(PoolActions)` wrapper - grep-confirmed no store
// ever bound to this class AND no real call site anywhere in the app
// calls `createPool`/`create_liquidity_pool` (both dead code already,
// pre-existing). `createPool` returned an Alt thunk (`dispatch =>
// {...}`) purely so it could call `dispatch` - dropped per the same
// dead-dispatch precedent as `HtlcActions`/`AssetActions`/
// `AccountActions`, with `WalletDb.process_transaction`'s real logic
// preserved exactly. Also drops 4 already-unused bindings (`Apis`,
// `gatewayPrefixes`, `price`, `inProgress` - dead since before this
// port, confirmed via `git show` against the pre-port file) surfaced by
// `yarn lint:changed` now that this file is part of a diff.
import utils from "common/utils";
import WalletApi from "api/WalletApi";
import WalletDb from "stores/WalletDb";
import {ChainStore} from "bitsharesjs";
import big from "bignumber.js";

class PoolActions {
    createPool(
        account_id,
        createObject,
        flags,
        permissions,
        cer,
        isBitAsset,
        is_prediction_market,
        bitasset_opts,
        description
    ) {
        // Create pool action here...
        console.log(
            "create pool:",
            createObject,
            "flags:",
            flags,
            "isBitAsset:",
            isBitAsset,
            "bitasset_opts:",
            bitasset_opts
        );
        let tr = WalletApi.new_transaction();
        let precision = utils.get_asset_precision(createObject.precision);
        big.config({DECIMAL_PLACES: createObject.precision});
        let max_supply = new big(createObject.max_supply)
            .times(precision)
            .toString();
        let max_market_fee = new big(createObject.max_market_fee || 0)
            .times(precision)
            .toString();
        let corePrecision = utils.get_asset_precision(
            ChainStore.getAsset(cer.base.asset_id).get("precision")
        );
        let operationJSON = {
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
                    reward_percent: createObject.reward_percent * 100 || 0,
                    whitelist_market_fee_sharing: []
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
            .then(() => {
                // console.log("pool create result:", result);
            })
            .catch(error => {
                console.log("----- createAsset error ----->", error);
            });
    }

    // Already an empty, uncalled stub before this port (confirmed via
    // `git show` against the pre-port file) - params dropped since none
    // were ever read.
    create_liquidity_pool() {}
}

export default new PoolActions();
