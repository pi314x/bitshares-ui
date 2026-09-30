// TypeScript/functional-component port of the legacy AddOpinionModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `createOrder` builds and submits
// on-chain order transactions via `MarketsActions.createLimitOrder2(...)`
// (the "yes" / buy path) and `MarketsActions.createPredictionShort(...)`
// (the "no" / short-and-sell path) - the `Asset`/`Price`/`LimitOrderCreate`
// construction and both `MarketsActions` calls (argument order, values,
// and the `bid`/`ask`/`current`/`collateral` computations feeding them)
// are transcribed verbatim, including pieces whose result is otherwise
// unread (see the `bid.price`/`ask.price` note below) - this is
// transaction-building logic, so nothing here was pruned as "unused"
// without confirming it doesn't affect what gets submitted. Nothing
// sensitive is logged (grepped: no `console.*` call anywhere in this
// file touches a key/password/brainkey).
//
// `class AddOpinionModal extends Modal` extended antd's `Modal` class
// component directly - `bitshares-ui-style-guide`'s `Modal` export is a
// bare re-export of `antd`'s `Modal` (verified via
// `node_modules/bitshares-ui-style-guide/app/bitshares-ui-style-guide
// /Modal/index.js`). Reading antd's own `Modal.js` confirms it defines no
// lifecycle method besides `render()` - since this file's own `render()`
// unconditionally overrides antd's, `extends Modal` here is behaviorally
// identical to `extends React.Component` (same reasoning as
// `CreateMarketModal.tsx`, this same batch) - ported as a plain function
// component rendering `<Modal>` as a child element, matching every other
// Modal-rendering file in this migration.
//
// `PropTypes`/`ChainTypes.ChainAccount.isRequired` replaced by the
// `AddOpinionModalProps` interface below - `currentAccount` is typed as
// the resolved Immutable account `Record` (`any`), matching what
// `ChainTypes.ChainAccount` resolved to and what the one real caller
// (`PredictionMarkets.jsx`, out of scope for this batch) actually passes
// (`this.props.currentAccount`, unresolved-via-`.get("id")` unlike
// `CreateMarketModal`'s `currentAccount`). `opinion` (declared in
// `propTypes`/`defaultProps` but grep-confirmed never read anywhere in
// this file, including `render()`) is dropped entirely, along with
// `ChainTypes`/`PropTypes` imports (both otherwise unused once the
// declarations they supported are gone).
//
// `componentDidMount` (calls `_updateStateFromProps()` unconditionally on
// mount) and `componentDidUpdate` (calls the same function, but only when
// `preselectedOpinion`/`preselectedAmount`/`preselectedProbability`
// changed) both invoke the exact same function with no other logic, so
// they collapse into a single `useEffect` keyed on those three props with
// *no* mount-skip guard: an ordinary `useEffect` already fires once on
// mount (reproducing `componentDidMount`) and again whenever a dependency
// changes (reproducing `componentDidUpdate`'s gating) - this is the
// deliberate exception to this migration's usual "componentDidUpdate
// needs an isMountRef guard" rule, used only because both lifecycle
// methods here delegate to the identical function.
//
// No `stateRef` mirror: every handler/effect below only reads state as of
// the most recently committed render (via the function component's own
// closure), and none of them need to observe a state change that
// happened without triggering a fresh render - same reasoning as
// `CreateMarketModal.tsx`/`SettleModal.tsx` (no `stateRef` in either).
//
// Preserved verbatim, not "fixed" - two real bugs in the original state
// keys:
// - `handleAmountChange`/`handleProbabilityChange` mutate
//   `state.newOpinionParameters` *in place* (`newOpinion` is the very
//   same object) and then call `this.setState({newOpinionParameter:
//   ...})` - misspelled, missing the trailing "s", so neither call
//   actually patches the real `newOpinionParameters` state key at all.
//   Since `setState` always triggers a re-render regardless of which
//   keys it patches, and the mutated object *is* (by reference)
//   `state.newOpinionParameters` already, the amount/probability shown
//   on screen still updates correctly - just via direct mutation, never
//   through an actual state merge of that key. This is reproduced
//   exactly: mutate the object referenced by `state.newOpinionParameters`
//   in place, then call `setState` with a patch that (like the original)
//   never actually needs to include `newOpinionParameters` for the
//   update to be visible - only `handleOpinionChange` (not affected by
//   this typo in the original) sets the real `newOpinionParameters` key.
// - The constructor's initial state has `wrongPropability: false`
//   (misspelled "Propability") - grep-confirmed dead, never read
//   anywhere. `handleProbabilityChange` instead sets `wrongProbability`
//   (correctly spelled - a *different* key, never given an initial value
//   in the original, so it starts as `undefined` until the first call),
//   and `render()`'s `has-error` check and its `wrongProbability`
//   destructure both read that correctly-spelled key. The dead
//   `wrongPropability` initializer is dropped (confirmed unread by grep);
//   the real `wrongProbability` field is kept, initialized to `false`
//   here (behaviorally identical to the original's implicit `undefined`,
//   since both are falsy in the `has-error`/render checks it feeds).
//
// TS-forced fix (an undeclared-identifier bug, same category as
// `Modal/DirectDebitModal.tsx`'s `balance_fee`/`Modal/JoinCommitteeModal
// .tsx`'s bare-identifier case): the `createPredictionShort(...).then()`
// error-notification branch references `buyAssetAmount`/`buyAsset.symbol`,
// neither ever declared anywhere in the file (grep-verified - not a prop,
// not state, not a local anywhere in `_createOrder`). In the original
// this is a real `ReferenceError` at the moment that branch runs (when
// `result.error` is truthy and its message isn't "wallet locked"),
// silently swallowed as an unhandled promise rejection (there's no
// `.catch` on this particular `.then()`, unlike the buy branch) - no
// notification is ever shown for a failed short-and-sell order, only a
// console error. TypeScript refuses to compile a reference to an
// undeclared identifier at all, so `buyAssetAmount`/`buyAsset` are
// declared as `let ...: any` (both `undefined`, exactly their original
// implicit value) immediately before use - `buyAsset.symbol` then still
// throws (a `TypeError` rather than the original's `ReferenceError`, but
// with the exact same observable outcome: the branch is broken, no
// notification ever appears, only a swallowed console error), which is
// the closest technically-possible reproduction of "this branch has
// always been dead/broken" rather than silently fixing it to show a
// working notification.
//
// Dropped as confirmed dead (grepped, not assumed): the `Switch` import
// from `bitshares-ui-style-guide` and the `ChainStore`/`FetchChain`
// imports from `bitsharesjs` - none of the three identifiers is
// referenced anywhere else in the original file.
import * as React from "react";
import {Modal, Input, Form, Button} from "bitshares-ui-style-guide";
import Translate from "react-translate-component";
import AmountSelector from "../Utility/AmountSelectorStyleGuide";
import counterpart from "counterpart";
import {Asset, Price, LimitOrderCreate} from "common/MarketClasses";
import MarketsActions from "actions/MarketsActions";
import {Notification, Radio} from "bitshares-ui-style-guide";
import ExchangeInput from "components/Exchange/ExchangeInput";
import utils from "common/utils";

interface NewOpinionParameters {
    opinionator: any;
    opinion: any;
    amount: any;
    probability: any;
    fee: any;
}

interface AddOpinionModalState {
    newOpinionParameters: NewOpinionParameters;
    showWarning: boolean;
    inProgress: boolean;
    selectedOpinion: any;
    selectedAsset: any;
    wrongProbability: boolean;
}

interface AddOpinionModalProps {
    visible?: boolean;
    onClose?: () => void;
    predictionMarket?: any;
    currentAccount: any;
    preselectedOpinion?: string;
    preselectedAmount?: number;
    preselectedProbability?: number;
    baseAsset?: any;
    quoteAsset?: any;
}

function AddOpinionModal({
    visible = false,
    onClose,
    predictionMarket = null,
    currentAccount,
    preselectedOpinion,
    preselectedAmount,
    preselectedProbability,
    baseAsset,
    quoteAsset
}: AddOpinionModalProps) {
    const getInitialState = (): AddOpinionModalState => ({
        newOpinionParameters: {
            opinionator: null,
            opinion: preselectedOpinion,
            amount:
                (preselectedAmount as any) /
                    Math.pow(10, baseAsset.get("precision")) || " ",
            probability: preselectedProbability || null,
            fee: null
        },
        showWarning: false,
        inProgress: false,
        selectedOpinion: preselectedOpinion,
        selectedAsset: null,
        wrongProbability: false
    });

    const [state, setState] = React.useState<AddOpinionModalState>(
        getInitialState
    );

    const mergeState = (partial: Partial<AddOpinionModalState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const createOrder = () => {
        mergeState({inProgress: true});
        const type =
            state.newOpinionParameters.opinion === "yes"
                ? "buy"
                : "shortAndSell";
        const feeID = baseAsset.get("id");

        const date = new Date();
        date.setFullYear(date.getFullYear() + 1);
        const bid: any = {
            for_sale: new (Asset as any)({
                asset_id: baseAsset.get("id"),
                precision: baseAsset.get("precision"),
                amount:
                    state.newOpinionParameters.amount *
                    Math.pow(10, quoteAsset.get("precision")) *
                    state.newOpinionParameters.probability
            }),
            to_receive: new (Asset as any)({
                asset_id: quoteAsset.get("id"),
                precision: quoteAsset.get("precision"),
                amount:
                    state.newOpinionParameters.amount *
                    Math.pow(10, quoteAsset.get("precision"))
            })
        };
        bid.price = new (Price as any)({base: bid.for_sale, quote: bid.to_receive});
        const ask: any = {
            for_sale: new (Asset as any)({
                asset_id: quoteAsset.get("id"),
                precision: quoteAsset.get("precision"),
                amount:
                    state.newOpinionParameters.amount *
                    Math.pow(10, quoteAsset.get("precision"))
            }),
            to_receive: new (Asset as any)({
                asset_id: baseAsset.get("id"),
                precision: baseAsset.get("precision"),
                amount:
                    state.newOpinionParameters.amount *
                    Math.pow(10, quoteAsset.get("precision")) *
                    state.newOpinionParameters.probability
            })
        };
        ask.price = new (Price as any)({base: ask.for_sale, quote: ask.to_receive});

        const current = type === "buy" ? ask : bid;

        if (type === "buy") {
            const buy = new (LimitOrderCreate as any)({
                for_sale: new (Asset as any)({
                    asset_id: baseAsset.get("id"),
                    precision: baseAsset.get("precision"),
                    amount: (utils as any).convert_typed_to_satoshi(
                        state.newOpinionParameters.amount,
                        baseAsset
                    )
                }),
                expiration: null,
                to_receive: new (Asset as any)({
                    asset_id: quoteAsset.get("id"),
                    precision: quoteAsset.get("precision"),
                    amount:
                        (utils as any).convert_typed_to_satoshi(
                            state.newOpinionParameters.amount,
                            quoteAsset
                        ) / parseFloat(state.newOpinionParameters.probability)
                }),
                seller: currentAccount.get("id"),
                fee: {
                    asset_id: feeID,
                    amount: 0
                }
            });

            return (MarketsActions as any)
                .createLimitOrder2(buy)
                .then((result: any) => {
                    mergeState({inProgress: false});
                    if (result.error) {
                        if (result.error.message !== "wallet locked")
                            (Notification as any).error({
                                message: counterpart.translate(
                                    "notifications.exchange_unknown_error_place_order",
                                    {
                                        amount: current.to_receive.getAmount({
                                            real: true
                                        }),
                                        symbol: current.to_receive.asset_id
                                    }
                                )
                            });
                    }
                })
                .catch((e: any) => {
                    console.error("order failed:", e);
                });
        }

        if (type === "shortAndSell") {
            const sell = new (LimitOrderCreate as any)({
                for_sale: new (Asset as any)({
                    asset_id: quoteAsset.get("id"),
                    precision: quoteAsset.get("precision"),
                    amount: (utils as any).convert_typed_to_satoshi(
                        state.newOpinionParameters.amount,
                        quoteAsset
                    )
                }),
                expiration: null,
                to_receive: new (Asset as any)({
                    asset_id: baseAsset.get("id"),
                    precision: baseAsset.get("precision"),
                    amount:
                        (utils as any).convert_typed_to_satoshi(
                            state.newOpinionParameters.amount,
                            baseAsset
                        ) * parseFloat(state.newOpinionParameters.probability)
                }),
                seller: currentAccount.get("id"),
                fee: {
                    asset_id: feeID,
                    amount: 0
                }
            });
            const collateral = new (Asset as any)({
                amount: sell.amount_for_sale.getAmount(),
                asset_id: baseAsset.get("id"),
                precision: baseAsset.get("precision")
            });
            (MarketsActions as any)
                .createPredictionShort(sell, collateral)
                .then((result: any) => {
                    mergeState({inProgress: false});
                    if (result.error) {
                        if (result.error.message !== "wallet locked") {
                            let buyAssetAmount: any;
                            let buyAsset: any;
                            (Notification as any).error({
                                message: counterpart.translate(
                                    "notifications.exchange_unknown_error_place_order",
                                    {
                                        amount: buyAssetAmount,
                                        symbol: buyAsset.symbol
                                    }
                                )
                            });
                        }
                    }
                });
        }
    };

    const updateStateFromProps = () => {
        let newOpinionParameters = state.newOpinionParameters;
        newOpinionParameters = Object.assign({}, newOpinionParameters);
        newOpinionParameters.opinion = preselectedOpinion;
        newOpinionParameters.amount =
            (preselectedAmount as any) /
                Math.pow(10, baseAsset.get("precision")) || " ";
        newOpinionParameters.probability = preselectedProbability || null;
        mergeState({
            newOpinionParameters,
            selectedOpinion: preselectedOpinion
        });
    };

    React.useEffect(() => {
        updateStateFromProps();
    }, [preselectedOpinion, preselectedAmount, preselectedProbability]);

    const handleOpinionChange = () => {
        const newOpinion = state.newOpinionParameters;
        newOpinion.opinion = newOpinion.opinion === "no" ? "yes" : "no";
        newOpinion.opinionator = currentAccount.get("id");
        mergeState({
            newOpinionParameters: newOpinion,
            selectedOpinion: newOpinion.opinion
        });
    };

    const handleAmountChange = ({amount, asset}: any) => {
        const newOpinion = state.newOpinionParameters;
        newOpinion.amount = amount;
        newOpinion.opinionator = currentAccount.get("id");
        setState(prev => ({...prev}));

        if (typeof asset === "string") {
            mergeState({selectedAsset: asset});
        }
    };

    const handleProbabilityChange = (e: any) => {
        const newOpinion = state.newOpinionParameters;
        newOpinion.probability = e.target.value;
        setState(prev => ({
            ...prev,
            wrongProbability: !isProbabilityValid(newOpinion)
        }));
    };

    const isProbabilityValid = (newOpinion: any = null): boolean => {
        if (newOpinion == null) {
            newOpinion = state.newOpinionParameters;
        }
        if (
            !newOpinion.probability ||
            newOpinion.probability <= 0.01 ||
            newOpinion.probability >= 0.99
        ) {
            return false;
        } else {
            return true;
        }
    };

    const isFormValid = (): boolean => {
        return (
            isProbabilityValid() &&
            parseFloat(state.newOpinionParameters.amount) > 0
        );
    };

    const getPotentialWinnings = () => {
        if (
            state.newOpinionParameters.probability &&
            state.newOpinionParameters.amount
        ) {
            if (state.newOpinionParameters.opinion === "yes") {
                return (utils as any).format_number(
                    state.newOpinionParameters.amount /
                        parseFloat(state.newOpinionParameters.probability),
                    baseAsset.get("precision"),
                    false
                );
            } else {
                return (utils as any).format_number(
                    state.newOpinionParameters.amount *
                        (1 +
                            (state.newOpinionParameters.probability
                                ? parseFloat(
                                      state.newOpinionParameters.probability
                                  )
                                : 0)),
                    baseAsset.get("precision"),
                    false
                );
            }
        } else {
            return 0;
        }
    };

    const onSubmit = () => {
        if (isFormValid()) {
            createOrder();
        } else {
            mergeState({showWarning: true});
        }
    };

    const {showWarning, newOpinionParameters, wrongProbability} = state;

    const footer = [
        <Button
            type="primary"
            key="submit"
            onClick={onSubmit}
            disabled={state.inProgress}
        >
            {counterpart.translate("global.confirm")}
        </Button>,
        <Button key="cancel" onClick={onClose} disabled={state.inProgress}>
            {counterpart.translate("global.cancel")}
        </Button>
    ];

    return (
        <Modal
            title={<Translate content="prediction.add_opinion_modal.title" />}
            visible={visible}
            onCancel={onClose}
            overlay={true}
            closable={!state.inProgress}
            footer={footer}
        >
            <div className="prediction-markets--add-prediction-offer">
                <Form className="full-width" layout="vertical">
                    <Form.Item>
                        <label className="left-label">
                            <Translate content="prediction.add_opinion_modal.symbol" />
                            <Input
                                type="text"
                                disabled={true}
                                tabIndex={1}
                                value={predictionMarket.symbol}
                            />
                        </label>
                    </Form.Item>
                    <Form.Item>
                        <label className="left-label">
                            <Translate content="prediction.details.prediction" />
                            <Input
                                type="text"
                                disabled={true}
                                tabIndex={2}
                                value={predictionMarket.condition}
                            />
                        </label>
                    </Form.Item>
                    <Form.Item>
                        <span
                            className={
                                (!newOpinionParameters.probability &&
                                    showWarning) ||
                                wrongProbability
                                    ? "has-error"
                                    : ""
                            }
                        >
                            <label className="left-label">
                                <Translate content="prediction.details.predicated_likelihood" />
                                <ExchangeInput
                                    placeholder="0.0"
                                    onChange={handleProbabilityChange}
                                    value={state.newOpinionParameters.probability}
                                />
                            </label>
                        </span>
                    </Form.Item>
                    <Form.Item style={{marginBottom: "1rem"}}>
                        <span>
                            <label className="left-label">
                                <Translate content="prediction.details.i_think_that" />
                            </label>
                        </span>
                        <Radio.Group
                            value={state.selectedOpinion}
                            onChange={handleOpinionChange}
                        >
                            <Radio value={"yes"}>
                                {counterpart.translate(
                                    "prediction.details.proves_true"
                                )}
                            </Radio>
                            <Radio value={"no"}>
                                {counterpart.translate(
                                    "prediction.details.incorrect"
                                )}
                            </Radio>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item>
                        <span>
                            <label className="left-label">
                                <Translate content="prediction.details.premium" />
                                <AmountSelector
                                    onChange={handleAmountChange}
                                    placeholder="0.0"
                                    tabIndex={6}
                                    amount={state.newOpinionParameters.amount}
                                    asset={baseAsset.get("id")}
                                />
                            </label>
                        </span>
                    </Form.Item>
                    <Form.Item>
                        <label className="left-label">
                            <Translate content="prediction.details.commission" />
                            <AmountSelector
                                disabled
                                amount={Math.min(
                                    predictionMarket.max_market_fee,
                                    (state.newOpinionParameters.amount *
                                        predictionMarket.market_fee) /
                                        10000
                                )}
                                asset={baseAsset.get("id")}
                            />
                        </label>
                    </Form.Item>
                    <Form.Item>
                        <label className="left-label">
                            <Translate content="prediction.details.potential_profit" />
                            <AmountSelector
                                disabled
                                amount={getPotentialWinnings()}
                                asset={baseAsset.get("id")}
                            />
                        </label>
                    </Form.Item>
                    {state.inProgress ? (
                        <Translate content="footer.loading" />
                    ) : null}
                </Form>
            </div>
        </Modal>
    );
}

export default AddOpinionModal;
