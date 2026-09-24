// TypeScript/functional-component port of the legacy PriceAlert.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - the "set a price alert" modal.
// Purely local form-state management (an array of alert rules) plus
// `onSave`/`hideModal` callbacks out; no transaction submission here.
// Mechanical, line-for-line translation, no logic changes.
//
// Structural change (same substitution used throughout this migration):
// `AssetWrapper(PriceAlert, {propNames: ["quoteAsset", "baseAsset"]})`
// (both `ChainTypes.ChainAsset.isRequired`) replaced with a
// `PriceAlertContainer` + `PriceAlert` split resolving both via
// `ChainStore.getAsset` under `useChainStoreTick()`, gated behind the
// usual `<span />` placeholder. `render()`'s own inner
// `!quoteAsset || !quoteAsset.get || ...` guard is redundant with that
// gate (the wrapper never let an unresolved value through in the
// original either) but is kept anyway, exactly as written - it's cheap
// and this port isn't the place to start pruning defensive checks that
// are technically still reachable in principle.
//
// `componentDidUpdate`'s "did `visible` just transition from false to
// true" check becomes a `[visible]`-keyed effect, guarded to skip its
// first (mount) run - the standard substitution used throughout this
// migration for a `componentDidUpdate`/`componentWillReceiveProps` check
// that only ever cares about one specific prop transition.
import * as React from "react";
import {
    Modal,
    Form,
    Input,
    Button,
    Icon,
    Select
} from "bitshares-ui-style-guide";
import {Link, LinkProps} from "react-router-dom";
import AssetName from "../Utility/AssetName";
import {PRICE_ALERT_TYPES} from "../../services/Exchange";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const TypedLink = Link as React.ComponentType<LinkProps>;

interface PriceAlertProps {
    quoteAsset: any;
    baseAsset: any;
    visible: boolean;
    hideModal: () => void;
    onSave: (rules: any[]) => void;
    latestPrice?: any;
    rules: any[];
}

function PriceAlert({
    quoteAsset,
    baseAsset,
    visible,
    hideModal,
    onSave,
    latestPrice,
    rules: rulesProp
}: PriceAlertProps) {
    const [rules, setRules] = React.useState<any[]>([]);
    const openedPreviouslyRef = React.useRef(false);

    function validatePrice(type: any, price: number, latest: number) {
        if (type === PRICE_ALERT_TYPES.HIGHER_THAN && price < latest) {
            return {
                validateStatus: "error",
                help: "Price of Alert should be higher than current price"
            };
        }

        if (type === PRICE_ALERT_TYPES.LOWER_THAN && price > latest) {
            return {
                validateStatus: "error",
                help: "Price of Alert  should be lower than current price"
            };
        }

        return {
            validateStatus: "success",
            help: ""
        };
    }

    const isFirstRender = React.useRef(true);
    React.useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (visible) {
            const example = {
                type: PRICE_ALERT_TYPES.HIGHER_THAN,
                price: latestPrice ? Number(latestPrice) : null
            };

            let newRules: any[] = [];

            if (!rulesProp.length) {
                newRules = !openedPreviouslyRef.current ? [example] : [];
            } else {
                newRules = rulesProp;
            }

            setRules(newRules);
            openedPreviouslyRef.current = true;
        }
        // eslint-disable-next-line
    }, [visible]);

    function handleTypeChange(key: number) {
        return (value: any) => {
            const newRules = rules.map((rule, ruleKey) => {
                if (Number(key) !== Number(ruleKey)) return rule;

                const validate = validatePrice(
                    value,
                    Number(rule.price),
                    Number(latestPrice)
                );

                return {
                    ...rule,
                    ...validate,
                    type: String(value)
                };
            });

            setRules(newRules);
        };
    }

    function validatePriceFieldByKey(key: number) {
        const newRules = rules.map((rule, ruleKey) => {
            if (Number(key) !== Number(ruleKey)) return rule;

            const validate = validatePrice(
                rule.type,
                Number(rule.price),
                Number(latestPrice)
            );

            return {
                ...rule,
                validateStatus: validate.validateStatus,
                help: validate.help
            };
        });

        setRules(newRules);
    }

    function handlePriceFieldBlur(key: number) {
        return () => {
            validatePriceFieldByKey(key);
        };
    }

    function handlePriceChange(key: number) {
        return (event: any) => {
            const newRules = rules.map((rule, ruleKey) => {
                if (Number(key) !== Number(ruleKey)) return rule;

                let validate: any = {};

                // validate on a fly if field was touched previously
                if (rule.validateStatus) {
                    validate = validatePrice(
                        rule.type,
                        Number(event.target.value),
                        Number(latestPrice)
                    );
                }

                return {
                    ...rule,
                    ...validate,
                    price: event.target.value
                };
            });

            setRules(newRules);
        };
    }

    function handleAddRule() {
        const newRules = [...rules];

        newRules.push({
            type: PRICE_ALERT_TYPES.HIGHER_THAN,
            price: latestPrice ? Number(latestPrice) : null
        });

        setRules(newRules);
    }

    function handleDeleteRule(key: number) {
        return () => {
            const newRules = rules.filter(
                (item, ruleKey) => Number(ruleKey) !== Number(key)
            );

            setRules(newRules);
        };
    }

    function handleSave() {
        onSave(rules);
    }

    if (
        !quoteAsset ||
        !quoteAsset.get ||
        !baseAsset ||
        !baseAsset.get
    )
        return null;

    const footer = [
        <Button key="submit" type="primary" onClick={handleSave}>
            {counterpart.translate("modal.save")}
        </Button>,
        <Button key="cancel" onClick={hideModal}>
            {counterpart.translate("modal.cancel")}
        </Button>
    ];

    const baseAssetSymbol = baseAsset.get("symbol");
    const quoteAssetSymbol = quoteAsset.get("symbol");

    const linkToExchange = `${quoteAssetSymbol}_${baseAssetSymbol}`;

    return (
        <Modal
            visible={visible}
            onCancel={hideModal}
            title={counterpart.translate("exchange.price_alert.title")}
            footer={footer}
        >
            <div className="exchange--price-alert">
                <div className="exchange--price-alert--description">
                    {rules.length ? (
                        <div>
                            {counterpart.translate(
                                "exchange.price_alert.alert_when"
                            )}{" "}
                            <TypedLink to={linkToExchange}>
                                <AssetName name={quoteAssetSymbol} />/
                                <AssetName name={baseAssetSymbol} />
                            </TypedLink>{" "}
                            price:
                        </div>
                    ) : (
                        <div>
                            {counterpart.translate(
                                "exchange.price_alert.use_button"
                            )}
                            <TypedLink to={linkToExchange}>
                                <AssetName name={quoteAssetSymbol} />/
                                <AssetName name={baseAssetSymbol} />
                            </TypedLink>
                            :
                        </div>
                    )}

                    <Form layout="vertical">
                        <div className="exchange--price-alert--items">
                            {rules.map((rule, key) => (
                                <Form.Item
                                    key={key}
                                    validateStatus={
                                        rule.validateStatus || null
                                    }
                                    help={rule.help || null}
                                >
                                    <Input.Group
                                        className={
                                            "exchange--price-alert--item"
                                        }
                                        compact
                                    >
                                        <Select
                                            value={rule.type}
                                            style={{width: "200px"}}
                                            onChange={handleTypeChange(key)}
                                        >
                                            <Select.Option
                                                value={
                                                    PRICE_ALERT_TYPES.HIGHER_THAN
                                                }
                                                key={"1"}
                                            >
                                                {counterpart.translate(
                                                    "exchange.price_alert.higher_than"
                                                )}
                                            </Select.Option>
                                            <Select.Option
                                                value={
                                                    PRICE_ALERT_TYPES.LOWER_THAN
                                                }
                                                key={"2"}
                                            >
                                                {counterpart.translate(
                                                    "exchange.price_alert.lower_than"
                                                )}
                                            </Select.Option>
                                        </Select>

                                        <Input
                                            onBlur={handlePriceFieldBlur(key)}
                                            style={{
                                                width:
                                                    "calc(100% - 200px - 32px)",
                                                marginTop: "1px"
                                            }}
                                            onChange={handlePriceChange(key)}
                                            value={rule.price}
                                            className="exchange--price-alert--item--price"
                                            placeholder={counterpart.translate(
                                                "exchange.price_alert.price"
                                            )}
                                            addonAfter={
                                                <AssetName
                                                    name={baseAssetSymbol}
                                                />
                                            }
                                        />

                                        <Button
                                            style={{width: "32px"}}
                                            onClick={handleDeleteRule(key)}
                                            className="exchange--price-alert--item--control"
                                            type="icon"
                                            icon="delete"
                                        />
                                    </Input.Group>
                                </Form.Item>
                            ))}
                        </div>

                        <div className="exchange--price-alert--items--add">
                            <a
                                href="javascript:void(0)"
                                onClick={handleAddRule}
                            >
                                <Icon type="plus" />{" "}
                                {counterpart.translate(
                                    "exchange.price_alert.add_rule"
                                )}
                            </a>
                        </div>
                    </Form>
                </div>
            </div>
        </Modal>
    );
}

function PriceAlertContainer(props: any) {
    useChainStoreTick();
    const quoteAsset = (ChainStore as any).getAsset(props.quoteAsset);
    const baseAsset = (ChainStore as any).getAsset(props.baseAsset);

    if (!quoteAsset || !baseAsset) {
        return <span />;
    }

    return (
        <PriceAlert {...props} quoteAsset={quoteAsset} baseAsset={baseAsset} />
    );
}

export default PriceAlertContainer;
