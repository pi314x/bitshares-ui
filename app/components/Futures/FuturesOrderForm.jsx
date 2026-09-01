import React from "react";
import {
    Card,
    Input,
    Select,
    Button,
    Checkbox,
    Alert
} from "bitshares-ui-style-guide";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import FuturesActions from "actions/FuturesActions";
import Signer from "lib/common/Signer";

/**
 * Place an order on a futures market.
 *
 * Two things here are not cosmetic:
 *
 * Price is integer collateral per contract, so the input is validated as an integer and
 * passed through as a string. A decimal typed here would be silently truncated on the way
 * to the chain and the fill would happen at a price the trader did not choose.
 *
 * The margin figure shown before submitting is the chain's own arithmetic -- size * price *
 * initial_margin_ratio / 10000 -- and not an estimate. A trader deciding whether they can
 * afford an order needs the number the evaluator will actually charge, not one close to it.
 */
class FuturesOrderForm extends React.Component {
    constructor(props) {
        super(props);
        this.state = this._blank();
    }

    _blank() {
        return {
            marketId: null,
            isLong: true,
            price: "",
            size: "",
            fillOrKill: false,
            submitting: false,
            error: null,
            done: null
        };
    }

    _selectedMarket() {
        return (this.props.markets || []).find(
            m => m.id === this.state.marketId
        );
    }

    /// The initial margin the chain will require, in collateral units. Integer arithmetic
    /// throughout, matching the evaluator; a float here would disagree at the boundary.
    _requiredMargin() {
        const market = this._selectedMarket();
        const price = parseInt(this.state.price, 10);
        const size = parseInt(this.state.size, 10);
        if (!market || !(price > 0) || !(size > 0)) return null;
        const ratio = market.options.initial_margin_ratio;
        return Math.floor((price * size * ratio) / 10000);
    }

    _validate() {
        const {marketId, price, size} = this.state;
        if (!marketId) return "futures.err_no_market";
        if (!/^\d+$/.test(price) || parseInt(price, 10) <= 0)
            return "futures.err_price_integer";
        if (!/^\d+$/.test(size) || parseInt(size, 10) <= 0)
            return "futures.err_size_integer";
        return null;
    }

    _submit = () => {
        const problem = this._validate();
        if (problem) {
            this.setState({error: counterpart.translate(problem)});
            return;
        }
        this.setState({submitting: true, error: null, done: null});

        FuturesActions.createOrder({
            owner: this.props.account,
            market_id: this.state.marketId,
            is_long: this.state.isLong,
            price_per_contract: this.state.price,
            size: this.state.size,
            fill_or_kill: this.state.fillOrKill
        })
            .then(() => {
                this.setState(
                    Object.assign(this._blank(), {
                        done: counterpart.translate("futures.order_placed")
                    })
                );
                if (this.props.onPlaced) this.props.onPlaced();
            })
            .catch(err => {
                this.setState({
                    submitting: false,
                    error:
                        err && err.message
                            ? err.message
                            : counterpart.translate("futures.err_submit")
                });
            });
    };

    render() {
        const {markets, account} = this.props;
        const {
            isLong,
            price,
            size,
            fillOrKill,
            submitting,
            error,
            done
        } = this.state;

        if (!account) {
            return (
                <Card className="futures-order-form">
                    <Translate content="futures.login_to_trade" component="p" />
                </Card>
            );
        }

        const margin = this._requiredMargin();

        return (
            <Card
                className="futures-order-form"
                title={counterpart.translate("futures.place_order")}
            >
                <div className="futures-form-row">
                    <label>
                        <Translate content="futures.contract" />
                    </label>
                    <Select
                        value={this.state.marketId || undefined}
                        onChange={v =>
                            this.setState({marketId: v, error: null})
                        }
                        placeholder={counterpart.translate(
                            "futures.select_market"
                        )}
                        style={{minWidth: "14rem"}}
                    >
                        {(markets || [])
                            .filter(m => m.options.enabled && !m.settled)
                            .map(m => (
                                <Select.Option key={m.id} value={m.id}>
                                    {m.symbol}
                                </Select.Option>
                            ))}
                    </Select>
                </div>

                <div className="futures-form-row">
                    <label>
                        <Translate content="futures.side" />
                    </label>
                    <Select
                        value={isLong ? "long" : "short"}
                        onChange={v => this.setState({isLong: v === "long"})}
                        style={{minWidth: "14rem"}}
                    >
                        <Select.Option value="long">
                            {counterpart.translate("futures.long")}
                        </Select.Option>
                        <Select.Option value="short">
                            {counterpart.translate("futures.short")}
                        </Select.Option>
                    </Select>
                </div>

                <div className="futures-form-row">
                    <label>
                        <Translate content="futures.price_per_contract" />
                    </label>
                    <Input
                        value={price}
                        onChange={e =>
                            this.setState({price: e.target.value, error: null})
                        }
                        placeholder="64500"
                    />
                </div>

                <div className="futures-form-row">
                    <label>
                        <Translate content="futures.contracts" />
                    </label>
                    <Input
                        value={size}
                        onChange={e =>
                            this.setState({size: e.target.value, error: null})
                        }
                        placeholder="10"
                    />
                </div>

                <div className="futures-form-row">
                    <Checkbox
                        checked={fillOrKill}
                        onChange={e =>
                            this.setState({fillOrKill: e.target.checked})
                        }
                    >
                        <Translate content="futures.fill_or_kill" />
                    </Checkbox>
                </div>

                {margin !== null && (
                    <p className="futures-margin-hint">
                        <Translate
                            content="futures.margin_required"
                            margin={margin}
                        />
                    </p>
                )}

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

                <Button
                    type="primary"
                    disabled={submitting}
                    onClick={this._submit}
                >
                    <Translate
                        content={
                            submitting
                                ? "futures.submitting"
                                : "futures.submit_order"
                        }
                    />
                </Button>

                <p className="futures-signer-note">
                    <Translate
                        content={
                            Signer.preference() === "signer_extension"
                                ? "futures.signing_extension"
                                : "futures.signing_local"
                        }
                    />
                </p>
            </Card>
        );
    }
}

export default FuturesOrderForm;
