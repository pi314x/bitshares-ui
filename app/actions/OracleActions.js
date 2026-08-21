import alt from "alt-instance";
import WalletApi from "api/WalletApi";
import Signer from "../lib/common/Signer";

/// Aggregation modes, matching the chain's enum. The node serialises these BY NAME in its
/// JSON output but expects the NUMBER on the wire, which is a trap worth naming once here
/// rather than rediscovering at every call site.
export const AGGREGATION_MEDIAN_OF_LATEST = 0;
export const AGGREGATION_MEDIAN_OVER_WINDOW = 1;

/**
 * Write paths for oracles.
 *
 * An oracle is administered by its `owner` but published to by its `producers`, and those
 * are different authorities: create/update/delete are signed by the owner, publish by a
 * producer. Conflating them is the mistake that makes an oracle unusable -- the chain will
 * reject a publish from an account that is not on the producer list, however much it owns
 * the oracle.
 */
class OracleActions {
    _send(tr, options) {
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

    create(
        {
            owner,
            name,
            description = "",
            base_asset,
            quote_asset,
            options: oracleOptions,
            fee_asset = "1.3.0"
        },
        options
    ) {
        const tr = WalletApi.new_transaction();
        tr.add_type_operation("oracle_create", {
            fee: {amount: 0, asset_id: fee_asset},
            owner,
            name,
            description,
            base_asset,
            quote_asset,
            options: oracleOptions,
            extensions: []
        });
        return this._send(tr, options);
    }

    update(
        {owner, oracle_id, new_description, new_options, fee_asset = "1.3.0"},
        options
    ) {
        const op = {
            fee: {amount: 0, asset_id: fee_asset},
            owner,
            oracle_id,
            extensions: []
        };
        if (new_description !== undefined && new_description !== null)
            op.new_description = new_description;
        if (new_options) op.new_options = new_options;

        const tr = WalletApi.new_transaction();
        tr.add_type_operation("oracle_update", op);
        return this._send(tr, options);
    }

    delete({owner, oracle_id, fee_asset = "1.3.0"}, options) {
        const tr = WalletApi.new_transaction();
        tr.add_type_operation("oracle_delete", {
            fee: {amount: 0, asset_id: fee_asset},
            owner,
            oracle_id,
            extensions: []
        });
        return this._send(tr, options);
    }

    /**
     * Publish a value. Signed by a PRODUCER, not the owner.
     *
     * `value` is a price: {base: {amount, asset_id}, quote: {amount, asset_id}}. It is a
     * ratio of two integer amounts, so it carries no rounding of its own -- pass the two
     * amounts, never a computed decimal.
     */
    publish({producer, oracle_id, value, fee_asset = "1.3.0"}, options) {
        const tr = WalletApi.new_transaction();
        tr.add_type_operation("oracle_publish", {
            fee: {amount: 0, asset_id: fee_asset},
            producer,
            oracle_id,
            value,
            extensions: []
        });
        return this._send(tr, options);
    }
}

export default alt.createActions(OracleActions);
