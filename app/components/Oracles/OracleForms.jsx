import React from "react";
import {
    Card,
    Input,
    Select,
    Button,
    Alert,
    Modal
} from "bitshares-ui-style-guide";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import OracleActions, {
    AGGREGATION_MEDIAN_OF_LATEST,
    AGGREGATION_MEDIAN_OVER_WINDOW
} from "actions/OracleActions";

/**
 * Creating an oracle and publishing to one.
 *
 * These are two different authorities and the form keeps them apart on purpose. An oracle is
 * administered by its owner but written to by the accounts on its producer list, and the
 * chain enforces that separation: a publish signed by the owner is rejected outright unless
 * the owner also happens to be a producer. That exact mistake cost a devnet round trip here,
 * so the create form seeds the producer list with the creator and says so.
 */

const parseProducers = text =>
    text
        .split(/[\s,]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(entry => {
            // "1.2.17:2" weights that producer 2; a bare id weights it 1.
            const [id, weight] = entry.split(":");
            return [id, weight ? parseInt(weight, 10) : 1];
        });

export class OracleCreateForm extends React.Component {
    state = {
        name: "",
        description: "",
        base_asset: "",
        quote_asset: "",
        producers: "",
        minimum_producers: "1",
        value_lifetime_sec: "86400",
        aggregation: AGGREGATION_MEDIAN_OF_LATEST,
        window_sec: "3600",
        max_deviation_ppm: "100000",
        busy: false,
        error: null,
        done: null
    };

    _submit = () => {
        const {account} = this.props;
        const producers = parseProducers(
            this.state.producers || (account ? account : "")
        );
        const minimum = parseInt(this.state.minimum_producers, 10);

        if (!this.state.name) {
            this.setState({error: counterpart.translate("oracles.err_name")});
            return;
        }
        if (!producers.length) {
            this.setState({
                error: counterpart.translate("oracles.err_producers")
            });
            return;
        }
        // A quorum larger than the producer list can never be met, so the oracle would be
        // created already incapable of ever reporting a value. Refuse it here rather than
        // let someone pay a fee for a permanently silent oracle.
        if (!(minimum > 0) || minimum > producers.length) {
            this.setState({error: counterpart.translate("oracles.err_quorum")});
            return;
        }

        this.setState({busy: true, error: null, done: null});
        OracleActions.create({
            owner: account,
            name: this.state.name,
            description: this.state.description,
            base_asset: this.state.base_asset,
            quote_asset: this.state.quote_asset,
            options: {
                producers,
                minimum_producers: minimum,
                value_lifetime_sec: parseInt(this.state.value_lifetime_sec, 10),
                aggregation: this.state.aggregation,
                window_sec: parseInt(this.state.window_sec, 10),
                max_deviation_ppm: parseInt(this.state.max_deviation_ppm, 10),
                extensions: []
            }
        })
            .then(() => {
                this.setState({
                    busy: false,
                    done: counterpart.translate("oracles.created")
                });
                if (this.props.onChanged) this.props.onChanged();
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
        const {busy, error, done} = this.state;
        if (!account) return null;

        const field = (key, placeholder) => (
            <Input
                value={this.state[key]}
                placeholder={placeholder}
                onChange={e =>
                    this.setState({[key]: e.target.value, error: null})
                }
            />
        );

        return (
            <Card
                className="oracle-form"
                title={counterpart.translate("oracles.create")}
            >
                <div className="futures-form-row">
                    <label>
                        <Translate content="oracles.name" />
                    </label>
                    {field("name", "XBT.USD")}
                </div>
                <div className="futures-form-row">
                    <label>
                        <Translate content="oracles.description" />
                    </label>
                    {field("description", "")}
                </div>
                <div className="futures-form-row">
                    <label>
                        <Translate content="oracles.base_asset" />
                    </label>
                    {field("base_asset", "1.3.1")}
                </div>
                <div className="futures-form-row">
                    <label>
                        <Translate content="oracles.quote_asset" />
                    </label>
                    {field("quote_asset", "1.3.0")}
                </div>
                <div className="futures-form-row">
                    <label>
                        <Translate content="oracles.producers_field" />
                    </label>
                    {field("producers", account + " " + account + ":2")}
                </div>
                <Translate
                    component="p"
                    className="oracle-hint"
                    content="oracles.producers_hint"
                />
                <div className="futures-form-row">
                    <label>
                        <Translate content="oracles.min_producers" />
                    </label>
                    {field("minimum_producers", "1")}
                </div>
                <div className="futures-form-row">
                    <label>
                        <Translate content="oracles.aggregation" />
                    </label>
                    <Select
                        value={this.state.aggregation}
                        onChange={v => this.setState({aggregation: v})}
                        style={{minWidth: "14rem"}}
                    >
                        <Select.Option value={AGGREGATION_MEDIAN_OF_LATEST}>
                            {counterpart.translate("oracles.median_latest")}
                        </Select.Option>
                        <Select.Option value={AGGREGATION_MEDIAN_OVER_WINDOW}>
                            {counterpart.translate("oracles.median_window")}
                        </Select.Option>
                    </Select>
                </div>
                <div className="futures-form-row">
                    <label>
                        <Translate content="oracles.window_sec" />
                    </label>
                    {field("window_sec", "3600")}
                </div>
                <div className="futures-form-row">
                    <label>
                        <Translate content="oracles.lifetime_sec" />
                    </label>
                    {field("value_lifetime_sec", "86400")}
                </div>
                <div className="futures-form-row">
                    <label>
                        <Translate content="oracles.max_deviation" />
                    </label>
                    {field("max_deviation_ppm", "100000")}
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
                        content={busy ? "oracles.creating" : "oracles.create"}
                    />
                </Button>
            </Card>
        );
    }
}

/**
 * Publish a value to one oracle.
 *
 * The value is a price -- a ratio of two integer amounts -- so this asks for both amounts
 * rather than a decimal. Converting a typed decimal into a ratio here would introduce a
 * rounding step that the chain never performs, and the published price would differ from
 * the one the producer believed they were sending.
 */
export class OraclePublishModal extends React.Component {
    state = {base: "1", quote: "", busy: false, error: null};

    _submit = () => {
        const {oracle, account} = this.props;
        const {base, quote} = this.state;
        if (
            !/^\d+$/.test(base) ||
            !/^\d+$/.test(quote) ||
            +base <= 0 ||
            +quote <= 0
        ) {
            this.setState({
                error: counterpart.translate("oracles.err_amounts")
            });
            return;
        }
        this.setState({busy: true, error: null});
        OracleActions.publish({
            producer: account,
            oracle_id: oracle.id,
            value: {
                base: {amount: base, asset_id: oracle.base_asset},
                quote: {amount: quote, asset_id: oracle.quote_asset}
            }
        })
            .then(() => {
                this.setState({busy: false});
                this.props.onDone(true);
            })
            .catch(err =>
                this.setState({
                    busy: false,
                    error: err && err.message ? err.message : String(err)
                })
            );
    };

    render() {
        const {oracle, visible, onDone} = this.props;
        const {base, quote, busy, error} = this.state;
        if (!oracle) return null;
        return (
            <Modal
                visible={visible}
                title={counterpart.translate("oracles.publish_to", {
                    name: oracle.name
                })}
                onCancel={() => onDone(false)}
                onOk={this._submit}
                okButtonProps={{disabled: busy}}
            >
                <Translate component="p" content="oracles.publish_explain" />
                <div className="futures-form-row">
                    <label>
                        <Translate content="oracles.base_amount" />
                    </label>
                    <Input
                        value={base}
                        onChange={e =>
                            this.setState({base: e.target.value, error: null})
                        }
                    />
                </div>
                <div className="futures-form-row">
                    <label>
                        <Translate content="oracles.quote_amount" />
                    </label>
                    <Input
                        value={quote}
                        onChange={e =>
                            this.setState({quote: e.target.value, error: null})
                        }
                        placeholder="64500"
                    />
                </div>
                {error && (
                    <Alert
                        type="error"
                        message={error}
                        className="futures-alert"
                    />
                )}
            </Modal>
        );
    }
}
