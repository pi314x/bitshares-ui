import alt from "alt-instance";
import WalletApi from "api/WalletApi";
import Signer from "../lib/common/Signer";

/**
 * Write paths for the futures market.
 *
 * Every operation here takes its authority from `owner` (or `liquidator`), which is why the
 * fee payer and the signer are the same account throughout -- there is no third party who
 * can move someone else's position.
 *
 * Prices are integer collateral per contract, never ratios. That is a deliberate choice on
 * the chain side, and it has to survive the trip through the UI: a price that becomes a
 * float here and an integer again on the way out is a rounding bug waiting to be found by
 * whoever is on the wrong side of it.
 */
class FuturesActions {
    _send(tr, options) {
        return dispatch =>
            Signer.process(tr, options)
                .then(res => {
                    dispatch({transaction: res});
                    return res;
                })
                .catch(error => {
                    // Rethrow: the caller drives the form's error state, and swallowing this
                    // would leave a failed order looking like it went through.
                    dispatch({transaction: null, error});
                    throw error;
                });
    }

    createOrder(
        {
            owner,
            market_id,
            is_long,
            price_per_contract,
            size,
            fill_or_kill = false,
            fee_asset = "1.3.0"
        },
        options
    ) {
        const tr = WalletApi.new_transaction();
        tr.add_type_operation("futures_order_create", {
            fee: {amount: 0, asset_id: fee_asset},
            owner,
            market_id,
            is_long: !!is_long,
            price_per_contract: String(price_per_contract),
            size: String(size),
            fill_or_kill: !!fill_or_kill,
            extensions: []
        });
        return this._send(tr, options);
    }

    cancelOrder({owner, order_id, fee_asset = "1.3.0"}, options) {
        const tr = WalletApi.new_transaction();
        tr.add_type_operation("futures_order_cancel", {
            fee: {amount: 0, asset_id: fee_asset},
            owner,
            order_id,
            extensions: []
        });
        return this._send(tr, options);
    }

    /**
     * Move collateral into (positive delta) or out of (negative delta) an open position.
     * The chain charges funding before applying the change, so the margin that lands is not
     * necessarily the margin asked for -- read it back rather than assuming.
     */
    adjustMargin({owner, position_id, delta, fee_asset = "1.3.0"}, options) {
        const tr = WalletApi.new_transaction();
        tr.add_type_operation("futures_position_adjust_margin", {
            fee: {amount: 0, asset_id: fee_asset},
            owner,
            position_id,
            delta: String(delta),
            extensions: []
        });
        return this._send(tr, options);
    }

    /// Settle a position on an expired dated market against the snapshotted oracle price.
    settle({owner, position_id, fee_asset = "1.3.0"}, options) {
        const tr = WalletApi.new_transaction();
        tr.add_type_operation("futures_settle", {
            fee: {amount: 0, asset_id: fee_asset},
            owner,
            position_id,
            extensions: []
        });
        return this._send(tr, options);
    }

    /**
     * Liquidation is permissionless: anyone may call it on a position below maintenance
     * margin, and the chain checks that condition rather than trusting the caller.
     */
    liquidate({liquidator, position_id, fee_asset = "1.3.0"}, options) {
        const tr = WalletApi.new_transaction();
        tr.add_type_operation("futures_liquidate", {
            fee: {amount: 0, asset_id: fee_asset},
            liquidator,
            position_id,
            extensions: []
        });
        return this._send(tr, options);
    }

    createMarket(
        {
            owner,
            symbol,
            description = "",
            oracle_id,
            collateral_asset = "1.3.0",
            contract_size = 1,
            expiry = null,
            options: marketOptions,
            fee_asset = "1.3.0"
        },
        options
    ) {
        const op = {
            fee: {amount: 0, asset_id: fee_asset},
            owner,
            symbol,
            description,
            oracle_id,
            collateral_asset,
            contract_size: String(contract_size),
            options: marketOptions,
            extensions: []
        };
        // Absent expiry means perpetual. Sending an explicit null would serialise as a
        // present-but-empty optional, which is a different contract entirely.
        if (expiry) op.expiry = expiry;

        const tr = WalletApi.new_transaction();
        tr.add_type_operation("futures_market_create", op);
        return this._send(tr, options);
    }

    updateMarket(
        {owner, market_id, new_description, new_options, fee_asset = "1.3.0"},
        options
    ) {
        const op = {
            fee: {amount: 0, asset_id: fee_asset},
            owner,
            market_id,
            extensions: []
        };
        if (new_description !== undefined && new_description !== null)
            op.new_description = new_description;
        if (new_options) op.new_options = new_options;

        const tr = WalletApi.new_transaction();
        tr.add_type_operation("futures_market_update", op);
        return this._send(tr, options);
    }
}

export default alt.createActions(FuturesActions);
