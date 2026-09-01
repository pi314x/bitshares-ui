import React from "react";
import {Card, Input, Button, Alert} from "bitshares-ui-style-guide";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import PoolActions from "actions/PoolActions";

/**
 * Deposit into a liquidity pool from the pool view.
 *
 * The stake modal could already do this, but only from the account and poolmart pages --
 * not from the place where you are looking at a pool and deciding to join it. This form
 * sits next to the withdrawal form so both ends of the same decision are in one place.
 *
 * The minimum is optional and bounds the share units the deposit may mint. An imbalanced
 * deposit pays a fee that depends on the pool's state when it executes, and whoever builds
 * the block decides what happens immediately before that. Leaving it empty accepts any
 * price, which is what this wallet offered as the only option until the field existed.
 */
class PoolDepositForm extends React.Component {
    state = {
        amount_a: "",
        amount_b: "",
        min_shares: "",
        busy: false,
        error: null,
        done: null
    };

    componentDidUpdate(prevProps) {
        if (prevProps.pool !== this.props.pool) {
            this.setState({
                amount_a: "",
                amount_b: "",
                min_shares: "",
                error: null,
                done: null
            });
        }
    }

    /// Empty, non-numeric or non-positive means "no bound" -- and that must be null, not 0.
    /// A bound of zero is always satisfied and would read like protection while giving none.
    _floor() {
        const raw = String(this.state.min_shares).trim();
        if (raw === "") return null;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
    }

    _submit = () => {
        const {account, pool} = this.props;
        const a = parseInt(this.state.amount_a, 10);
        const b = parseInt(this.state.amount_b, 10);

        if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
            this.setState({
                error: counterpart.translate("pools.err_deposit_amounts")
            });
            return;
        }

        this.setState({busy: true, error: null, done: null});
        PoolActions.deposit_to_pool({
            account,
            pool: pool.id,
            amount_a: {amount: String(a), asset_id: pool.asset_a},
            amount_b: {amount: String(b), asset_id: pool.asset_b},
            min_to_receive: this._floor()
        })
            .then(() => {
                this.setState({
                    busy: false,
                    amount_a: "",
                    amount_b: "",
                    done: counterpart.translate("pools.deposited")
                });
                if (this.props.onDeposited) this.props.onDeposited();
            })
            .catch(err =>
                this.setState({
                    busy: false,
                    error: err && err.message ? err.message : String(err)
                })
            );
    };

    render() {
        const {pool} = this.props;
        if (!pool) return null;
        const {busy, error, done} = this.state;

        return (
            <Card
                className="pool-deposit-form"
                title={counterpart.translate("pools.deposit_title")}
            >
                <div className="futures-form-row">
                    <label>{pool.asset_a_str || pool.asset_a}</label>
                    <Input
                        value={this.state.amount_a}
                        placeholder={counterpart.translate("pools.amount_hint")}
                        onChange={e =>
                            this.setState({
                                amount_a: e.target.value,
                                error: null
                            })
                        }
                    />
                </div>

                <div className="futures-form-row">
                    <label>{pool.asset_b_str || pool.asset_b}</label>
                    <Input
                        value={this.state.amount_b}
                        placeholder={counterpart.translate("pools.amount_hint")}
                        onChange={e =>
                            this.setState({
                                amount_b: e.target.value,
                                error: null
                            })
                        }
                    />
                </div>

                <div className="futures-form-row">
                    <label>
                        <Translate content="pools.min_shares" />
                    </label>
                    <Input
                        value={this.state.min_shares}
                        placeholder={counterpart.translate(
                            "pools.min_receive_hint"
                        )}
                        onChange={e =>
                            this.setState({
                                min_shares: e.target.value,
                                error: null
                            })
                        }
                    />
                </div>

                {error && <Alert type="error" message={error} />}
                {done && <Alert type="success" message={done} />}

                <Button type="primary" disabled={busy} onClick={this._submit}>
                    <Translate content="pools.deposit" />
                </Button>
            </Card>
        );
    }
}

export default PoolDepositForm;
