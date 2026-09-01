import alt from "alt-instance";
import {Apis} from "bitsharesjs-ws";
import utils from "common/utils";
import WalletApi from "api/WalletApi";
import WalletDb from "stores/WalletDb";
import Signer from "../lib/common/Signer";
import {ChainStore} from "bitsharesjs";
import big from "bignumber.js";
import {gatewayPrefixes} from "common/gateways";
import {price} from "bitsharesjs/es/serializer/src/operations";
let inProgress = {};

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
        return dispatch => {
            return WalletDb.process_transaction(tr, null, true)
                .then(result => {
                    // console.log("pool create result:", result);
                    dispatch(true);
                })
                .catch(error => {
                    console.log("----- createAsset error ----->", error);
                    dispatch(false);
                });
        };
    }

    /**
     * Create a liquidity pool.
     *
     * Two curves are possible. Leaving `pool_type` unset gives the original constant-product
     * pool and produces exactly the bytes it always did -- the StableSwap fields live in the
     * operation's typed extension for that reason, so old pools and old nodes are unaffected.
     *
     * A stable pool needs an amplification coefficient A, and it is required for and only
     * valid with pool_type = stable; the chain rejects either half without the other. A is
     * what sets how flat the curve is: small A behaves like constant product, large A holds
     * a near 1:1 peg until the pool runs badly out of balance.
     *
     * Note asset_a must be the LOWER asset id. The chain fixes the ordering so a pair has
     * one canonical pool rather than two, and swapping them here is rejected on chain.
     */
    create_liquidity_pool(
        {
            account,
            asset_a,
            asset_b,
            share_asset,
            taker_fee_percent = 0,
            withdrawal_fee_percent = 0,
            pool_type = null,
            amplification = null,
            fee_asset = "1.3.0"
        },
        options
    ) {
        const op = {
            fee: {amount: 0, asset_id: fee_asset},
            account,
            asset_a,
            asset_b,
            share_asset,
            taker_fee_percent,
            withdrawal_fee_percent,
            extensions: {}
        };
        if (pool_type !== null && pool_type !== undefined) {
            op.extensions.pool_type = pool_type;
            op.extensions.amplification = String(amplification);
        }

        const tr = WalletApi.new_transaction();
        tr.add_type_operation("liquidity_pool_create", op);
        return dispatch =>
            Signer.process(tr, options)
                .then(res => {
                    dispatch({transaction: res});
                    return res;
                })
                .catch(error => {
                    dispatch({transaction: null, error});
                    throw error;
                });
    }

    /**
     * Deposit into a liquidity pool.
     *
     * `min_to_receive` bounds the share units the deposit may mint. An imbalanced deposit
     * pays a fee that depends on how far it pushes the pool out of balance -- so on the
     * pool's state at the instant it executes, and whoever builds the block decides what
     * happens immediately before that. Leaving it unset accepts whatever comes back, which
     * is what this wallet did unconditionally until the field existed.
     */
    deposit_to_pool(
        {
            account,
            pool,
            amount_a,
            amount_b,
            min_to_receive = null,
            fee_asset = "1.3.0"
        },
        options
    ) {
        const op = {
            fee: {amount: 0, asset_id: fee_asset},
            account,
            pool,
            amount_a,
            amount_b,
            extensions: {}
        };
        if (min_to_receive !== null && min_to_receive !== undefined) {
            op.extensions.min_to_receive = min_to_receive;
        }

        const tr = WalletApi.new_transaction();
        tr.add_type_operation("liquidity_pool_deposit", op);
        return dispatch =>
            Signer.process(tr, options)
                .then(res => {
                    dispatch({transaction: res});
                    return res;
                })
                .catch(error => {
                    dispatch({transaction: null, error});
                    throw error;
                });
    }

    /**
     * Withdraw from a liquidity pool by burning share tokens.
     *
     * Leaving `withdraw_one_asset` unset takes a proportional slice of both assets, which is
     * what a withdrawal has always done, and produces exactly the bytes it always did.
     *
     * Naming an asset instead takes the whole payout in that one asset. The pool has to move
     * along its own curve to get there, so the imbalance fee applies -- for a two-asset pool
     * that is half the swap fee, because withdrawing one side is economically half a swap.
     * Stable pools only: the chain rejects a single-sided withdrawal on a constant-product
     * pool, where it would have no bounded price.
     */
    withdraw_from_pool(
        {
            account,
            pool,
            share_amount,
            withdraw_one_asset = null,
            min_a = null,
            min_b = null,
            fee_asset = "1.3.0"
        },
        options
    ) {
        const op = {
            fee: {amount: 0, asset_id: fee_asset},
            account,
            pool,
            share_amount,
            extensions: {}
        };
        if (withdraw_one_asset) {
            op.extensions.withdraw_one_asset = withdraw_one_asset;
        }
        // Untergrenzen je Seite. Eine Auszahlung preist an den Poolstaenden im Augenblick
        // der Ausfuehrung, und was unmittelbar davor geschieht, bestimmt derjenige, der den
        // Block baut. Ohne diese Felder konnte der Auszahlende nicht sagen, wieviel
        // Abweichung er hinnimmt -- die Kette liess es zu, diese Wallet fragte nie danach.
        if (min_a !== null && min_a !== undefined) {
            op.extensions.min_a = min_a;
        }
        if (min_b !== null && min_b !== undefined) {
            op.extensions.min_b = min_b;
        }

        const tr = WalletApi.new_transaction();
        tr.add_type_operation("liquidity_pool_withdraw", op);
        return dispatch =>
            Signer.process(tr, options)
                .then(res => {
                    dispatch({transaction: res});
                    return res;
                })
                .catch(error => {
                    dispatch({transaction: null, error});
                    throw error;
                });
    }
}

export default alt.createActions(PoolActions);
