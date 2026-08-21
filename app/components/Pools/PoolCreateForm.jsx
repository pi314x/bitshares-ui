import React from "react";
import {Card, Input, Select, Button, Alert} from "bitshares-ui-style-guide";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import PoolActions from "actions/PoolActions";

/// Matches the chain's pool_type enum: absent means constant product.
const POOL_CONSTANT_PRODUCT = 0;
const POOL_STABLE = 1;

/**
 * Create a liquidity pool, on either curve.
 *
 * The amplification field only appears for a stable pool because the chain requires it for,
 * and only for, that type -- offering it on a constant-product pool would produce an
 * operation that is guaranteed to be rejected.
 *
 * asset_a must be the lower asset id. The chain enforces a canonical ordering so a pair has
 * one pool rather than two, so rather than let someone discover that through a rejection,
 * the two ids get sorted here and the form says that is what it did.
 */
class PoolCreateForm extends React.Component {
    state = {
        asset_a: "",
        asset_b: "",
        share_asset: "",
        taker_fee_percent: "0",
        withdrawal_fee_percent: "0",
        pool_type: POOL_CONSTANT_PRODUCT,
        amplification: "100",
        busy: false,
        error: null,
        done: null
    };

    /// Sort by the numeric instance, not lexically: "1.3.10" sorts before "1.3.9" as text,
    /// which would silently produce the wrong canonical order.
    _ordered() {
        const instance = id => parseInt(String(id).split(".")[2], 10);
        const a = this.state.asset_a.trim();
        const b = this.state.asset_b.trim();
        if (!/^1\.3\.\d+$/.test(a) || !/^1\.3\.\d+$/.test(b)) return null;
        return instance(a) <= instance(b) ? [a, b] : [b, a];
    }

    _submit = () => {
        const {account} = this.props;
        const pair = this._ordered();
        if (!pair) {
            this.setState({
                error: counterpart.translate("pools.err_asset_ids")
            });
            return;
        }
        if (pair[0] === pair[1]) {
            this.setState({
                error: counterpart.translate("pools.err_same_asset")
            });
            return;
        }
        if (!/^1\.3\.\d+$/.test(this.state.share_asset.trim())) {
            this.setState({
                error: counterpart.translate("pools.err_share_asset")
            });
            return;
        }
        const stable = this.state.pool_type === POOL_STABLE;
        if (stable && !(parseInt(this.state.amplification, 10) > 0)) {
            this.setState({
                error: counterpart.translate("pools.err_amplification")
            });
            return;
        }

        this.setState({busy: true, error: null, done: null});
        PoolActions.create_liquidity_pool({
            account,
            asset_a: pair[0],
            asset_b: pair[1],
            share_asset: this.state.share_asset.trim(),
            taker_fee_percent: parseInt(this.state.taker_fee_percent, 10) || 0,
            withdrawal_fee_percent:
                parseInt(this.state.withdrawal_fee_percent, 10) || 0,
            pool_type: stable ? POOL_STABLE : null,
            amplification: stable
                ? parseInt(this.state.amplification, 10)
                : null
        })
            .then(() => {
                this.setState({
                    busy: false,
                    done: counterpart.translate("pools.created")
                });
                if (this.props.onCreated) this.props.onCreated();
            })
            .catch(err =>
                this.setState({
                    busy: false,
                    error: err && err.message ? err.message : String(err)
                })
            );
    };

    render() {
        const {account} = this.props;
        const {pool_type, busy, error, done} = this.state;
        if (!account) return null;

        const stable = pool_type === POOL_STABLE;
        const field = (key, placeholder) => (
            <Input
                value={this.state[key]}
                placeholder={placeholder}
                onChange={e =>
                    this.setState({[key]: e.target.value, error: null})
                }
            />
        );
        const pair = this._ordered();

        return (
            <Card
                className="pool-create-form"
                title={counterpart.translate("pools.create")}
            >
                <div className="futures-form-row">
                    <label>
                        <Translate content="pools.curve" />
                    </label>
                    <Select
                        value={pool_type}
                        onChange={v => this.setState({pool_type: v})}
                        style={{minWidth: "16rem"}}
                    >
                        <Select.Option value={POOL_CONSTANT_PRODUCT}>
                            {counterpart.translate("pools.constant_product")}
                        </Select.Option>
                        <Select.Option value={POOL_STABLE}>
                            {counterpart.translate("pools.stableswap")}
                        </Select.Option>
                    </Select>
                </div>
                <Translate
                    component="p"
                    className="oracle-hint"
                    content={
                        stable ? "pools.stable_hint" : "pools.constant_hint"
                    }
                />

                <div className="futures-form-row">
                    <label>
                        <Translate content="pools.asset_a" />
                    </label>
                    {field("asset_a", "1.3.0")}
                </div>
                <div className="futures-form-row">
                    <label>
                        <Translate content="pools.asset_b" />
                    </label>
                    {field("asset_b", "1.3.1")}
                </div>
                {pair && (
                    <p className="oracle-hint">
                        <Translate
                            content="pools.canonical_order"
                            a={pair[0]}
                            b={pair[1]}
                        />
                    </p>
                )}

                <div className="futures-form-row">
                    <label>
                        <Translate content="pools.share_asset" />
                    </label>
                    {field("share_asset", "1.3.2")}
                </div>

                {stable && (
                    <div className="futures-form-row">
                        <label>
                            <Translate content="pools.amplification" />
                        </label>
                        {field("amplification", "100")}
                    </div>
                )}

                <div className="futures-form-row">
                    <label>
                        <Translate content="pools.taker_fee" />
                    </label>
                    {field("taker_fee_percent", "0")}
                </div>
                <div className="futures-form-row">
                    <label>
                        <Translate content="pools.withdrawal_fee" />
                    </label>
                    {field("withdrawal_fee_percent", "0")}
                </div>

                {error && (
                    <Alert
                        type="error"
                        message={error}
                        className="futures-alert"
                    />
                )}
                {done && (
                    <Alert
                        type="success"
                        message={done}
                        className="futures-alert"
                    />
                )}

                <Button type="primary" disabled={busy} onClick={this._submit}>
                    <Translate
                        content={busy ? "pools.creating" : "pools.create"}
                    />
                </Button>
            </Card>
        );
    }
}

export default PoolCreateForm;
