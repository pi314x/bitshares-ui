import React from "react";
import {Card, Input, Select, Button, Alert} from "bitshares-ui-style-guide";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import PoolActions from "actions/PoolActions";

/// Withdrawal modes. Proportional is what a withdrawal has always been; single is the
/// StableSwap addition and rides in the operation's typed extension.
const MODE_PROPORTIONAL = "proportional";
const MODE_SINGLE = "single";

/**
 * Withdraw from a liquidity pool by burning share tokens.
 *
 * Proportional withdrawal takes a slice of both assets and produces exactly the bytes it
 * always did. Naming one asset instead takes the whole payout in that asset -- the pool has
 * to travel along its own curve to get there, so the imbalance fee applies. For a two-asset
 * pool that is half the swap fee, because withdrawing one side is economically half a swap.
 *
 * The single-asset choice only appears for a stable pool. The chain rejects it on a
 * constant-product pool, where the payout would have no bounded price, so offering it there
 * would build an operation guaranteed to fail.
 */
class PoolWithdrawForm extends React.Component {
    state = {
        mode: MODE_PROPORTIONAL,
        amount: "",
        which_asset: "",
        min_a: "",
        min_b: "",
        busy: false,
        error: null,
        done: null
    };

    componentDidUpdate(prevProps) {
        // A different pool means a different share asset and different sides, so a value
        // typed for the previous one must not carry over into an operation for this one.
        if (prevProps.pool !== this.props.pool) {
            this.setState({
                mode: MODE_PROPORTIONAL,
                amount: "",
                which_asset: "",
                min_a: "",
                min_b: "",
                error: null,
                done: null
            });
        }
    }

    /**
     * Die Untergrenzen, die mitgeschickt werden.
     *
     * Bei einer einseitigen Auszahlung zahlt nur eine Seite etwas aus; eine Grenze auf der
     * anderen koennte nie erfuellt werden, und die Kette lehnt sie ausdruecklich ab. Also
     * wird der eingegebene Wert derjenigen Seite zugeordnet, die tatsaechlich ausgezahlt
     * wird, und die andere bleibt leer.
     */
    _floors(single) {
        const {pool} = this.props;
        const num = v => {
            const n = parseInt(v, 10);
            return Number.isFinite(n) && n > 0 ? n : null;
        };
        if (single) {
            const value = num(this.state.min_a);
            return this.state.which_asset === pool.asset_a
                ? {min_a: value, min_b: null}
                : {min_a: null, min_b: value};
        }
        return {min_a: num(this.state.min_a), min_b: num(this.state.min_b)};
    }

    _submit = () => {
        const {account, pool} = this.props;
        const amount = parseInt(this.state.amount, 10);
        if (!(amount > 0)) {
            this.setState({error: counterpart.translate("pools.err_amount")});
            return;
        }
        const single = this.state.mode === MODE_SINGLE;
        if (single && !/^1\.3\.\d+$/.test(this.state.which_asset)) {
            this.setState({
                error: counterpart.translate("pools.err_which_asset")
            });
            return;
        }

        this.setState({busy: true, error: null, done: null});
        PoolActions.withdraw_from_pool({
            account,
            pool: pool.id,
            share_amount: {
                amount: String(amount),
                asset_id: pool.share_asset
            },
            withdraw_one_asset: single ? this.state.which_asset : null,
            ...this._floors(single)
        })
            .then(() => {
                this.setState({
                    busy: false,
                    amount: "",
                    done: counterpart.translate("pools.withdrawn")
                });
                if (this.props.onWithdrawn) this.props.onWithdrawn();
            })
            .catch(err =>
                this.setState({
                    busy: false,
                    error: err && err.message ? err.message : String(err)
                })
            );
    };

    render() {
        const {account, pool} = this.props;
        const {mode, busy, error, done} = this.state;
        if (!account || !pool) return null;

        const single = mode === MODE_SINGLE;

        return (
            <Card
                className="pool-withdraw-form"
                title={counterpart.translate("pools.withdraw")}
            >
                <div className="futures-form-row">
                    <label>
                        <Translate content="pools.withdraw_mode" />
                    </label>
                    <Select
                        value={mode}
                        onChange={v => this.setState({mode: v, error: null})}
                        style={{minWidth: "16rem"}}
                    >
                        <Select.Option value={MODE_PROPORTIONAL}>
                            {counterpart.translate("pools.mode_proportional")}
                        </Select.Option>
                        {/* Stable pools only; see the class comment. */}
                        {pool.is_stable && (
                            <Select.Option value={MODE_SINGLE}>
                                {counterpart.translate("pools.mode_single")}
                            </Select.Option>
                        )}
                    </Select>
                </div>

                <div className="futures-form-row">
                    <label>
                        <Translate content="pools.share_amount" />
                    </label>
                    <Input
                        value={this.state.amount}
                        placeholder={counterpart.translate(
                            "pools.share_amount_hint"
                        )}
                        onChange={e =>
                            this.setState({
                                amount: e.target.value,
                                error: null
                            })
                        }
                    />
                </div>

                {single && (
                    <div className="futures-form-row">
                        <label>
                            <Translate content="pools.which_asset" />
                        </label>
                        <Select
                            value={this.state.which_asset || undefined}
                            placeholder={counterpart.translate(
                                "pools.which_asset_hint"
                            )}
                            onChange={v =>
                                this.setState({which_asset: v, error: null})
                            }
                            style={{minWidth: "16rem"}}
                        >
                            <Select.Option value={pool.asset_a}>
                                {pool.asset_a_str || pool.asset_a}
                            </Select.Option>
                            <Select.Option value={pool.asset_b}>
                                {pool.asset_b_str || pool.asset_b}
                            </Select.Option>
                        </Select>
                    </div>
                )}

                {/* Untergrenzen. Was eine Auszahlung ausgibt, haengt am Poolstand im
                    Augenblick der Ausfuehrung, und was unmittelbar davor geschieht,
                    bestimmt derjenige, der den Block baut. Leer lassen heisst: jeden Preis
                    hinnehmen -- was diese Wallet bisher als einzige Moeglichkeit anbot. */}
                <div className="futures-form-row">
                    <label>
                        <Translate
                            content={
                                single
                                    ? "pools.min_receive_single"
                                    : "pools.min_receive_a"
                            }
                        />
                    </label>
                    <Input
                        value={this.state.min_a}
                        placeholder={counterpart.translate(
                            "pools.min_receive_hint"
                        )}
                        onChange={e =>
                            this.setState({min_a: e.target.value, error: null})
                        }
                    />
                </div>

                {!single && (
                    <div className="futures-form-row">
                        <label>
                            <Translate content="pools.min_receive_b" />
                        </label>
                        <Input
                            value={this.state.min_b}
                            placeholder={counterpart.translate(
                                "pools.min_receive_hint"
                            )}
                            onChange={e =>
                                this.setState({
                                    min_b: e.target.value,
                                    error: null
                                })
                            }
                        />
                    </div>
                )}

                {single && (
                    <p className="pool-note">
                        <Translate
                            content="pools.single_fee_note"
                            pct={pool.taker_fee_percent_str}
                        />
                    </p>
                )}

                {error && <Alert type="error" message={error} />}
                {done && <Alert type="success" message={done} />}

                <Button type="primary" disabled={busy} onClick={this._submit}>
                    <Translate content="pools.withdraw" />
                </Button>
            </Card>
        );
    }
}

export default PoolWithdrawForm;
