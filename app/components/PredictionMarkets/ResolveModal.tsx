// TypeScript/functional-component port of the legacy ResolveModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive check per AGENTS.md: grepped this file for
// `Actions\.`/`Api\.`/`WalletApi`/`WalletDb`/`ApplicationApi`/
// `add_type_operation`/`process_transaction` - none appear anywhere in
// it. This component only builds a `resolveParameters` object and hands
// it to the `onResolveMarket` prop callback on submit; it never builds,
// signs or submits a transaction itself (the real caller,
// `PredictionMarkets.jsx`'s `onResolveMarket`, does that - out of scope,
// not touched by this batch). No wallet-unlock/key/password/brainkey
// handling anywhere in this file either.
//
// Structural change: the original class declaration is
// `class ResolveModal extends Modal` where `Modal` is antd's `Modal`
// (re-exported by `bitshares-ui-style-guide`, see that package's
// `Modal/index.js`) - i.e. it inherits from a third-party class
// component purely to get a `React.Component` base; the constructor only
// calls `super(props)` and `render()` is fully overridden to return a
// `<Modal>` *element* (a different, ordinary *usage* of the same
// import, not `this` in JSX). No method inherited from `Modal` is ever
// called (no `this.someModalMethod()` appears anywhere in the file), so
// dropping the inheritance and rendering `<Modal>` as a plain child
// element from a function component is behavior-preserving.
//
// Preserved as a real bug (not "fixed"): `this.state.inProgress` is read
// in `render()` (`disabled={this.state.inProgress}` on both footer
// buttons, `closable={!this.state.inProgress}` on the `<Modal>`) but is
// never included in the constructor's initial state object and never
// set anywhere else in the file (grepped for `inProgress` - the only
// two hits are these two reads) - so it was always `undefined` for the
// component's entire lifetime (buttons never actually disabled,
// `closable` always `true`). Replicated verbatim as a literal
// `undefined` constant rather than inventing a `useState` for a value
// that is provably never written.
//
// Preserved as a real bug: `resolveParameters.asset_id` is captured once
// in the constructor from the initial `predictionMarket` prop and never
// re-synced if `predictionMarket` changes later (no
// `componentWillReceiveProps`/effect updates it) - replicated with a
// `useState` lazy initializer, which has the same "computed once, never
// re-derived" semantics.
//
// `predictionMarket` is declared `PropTypes.any.isRequired` but also has
// `defaultProps.predictionMarket = null` - a contradiction already
// present in the original (TypeScript can't express "required but also
// null by default" any more cleanly than PropTypes could); kept as `any`
// with the same `= null` default value in the destructure, for identical
// runtime behavior.
import * as React from "react";
import {Modal, Input, Form, Button, Radio} from "bitshares-ui-style-guide";
import Translate from "react-translate-component";
import counterpart from "counterpart";

interface ResolveParameters {
    asset_id: any;
    result: string;
}

interface ResolveModalProps {
    predictionMarket?: any;
    onResolveMarket: (resolveParameters: ResolveParameters) => void;
    visible?: boolean;
    onClose?: () => void;
}

export default function ResolveModal({
    predictionMarket = null,
    onResolveMarket,
    visible = false,
    onClose
}: ResolveModalProps) {
    const [resolveParameters, setResolveParameters] = React.useState<
        ResolveParameters
    >(() => ({
        asset_id: predictionMarket ? predictionMarket.asset_id : undefined,
        result: "yes"
    }));
    const [result, setResult] = React.useState("yes");

    // Always undefined - see header comment.
    const inProgress = undefined;

    const handleResultChange = (event: any) => {
        const newResult = event.target.value;
        setResolveParameters(prev => ({
            ...prev,
            result: newResult
        }));
        setResult(newResult);
    };

    const footer = [
        <Button
            type="primary"
            key="submit"
            onClick={() => onResolveMarket(resolveParameters)}
            disabled={inProgress}
        >
            {counterpart.translate("global.confirm")}
        </Button>,
        <Button key="cancel" onClick={onClose} disabled={inProgress}>
            {counterpart.translate("global.cancel")}
        </Button>
    ];

    return (
        <Modal
            title={<Translate content="prediction.resolve_modal.title" />}
            visible={visible}
            onCancel={onClose}
            overlay={true}
            closable={!inProgress}
            footer={footer}
        >
            <div className="prediction-markets--resolve-prediction-market-asset">
                <Form className="full-width" layout="vertical">
                    <Form.Item>
                        <label className="left-label">
                            <Translate content="prediction.resolve_modal.symbol" />
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
                            <Translate content="prediction.resolve_modal.prediction" />
                            <Input
                                type="text"
                                disabled={true}
                                tabIndex={2}
                                value={predictionMarket.condition}
                            />
                        </label>
                    </Form.Item>
                    <Form.Item>
                        <label className="left-label">
                            <Translate content="prediction.resolve_modal.the_prediction_has" />
                        </label>
                        <Radio.Group value={result} onChange={handleResultChange}>
                            <Radio value={"yes"}>
                                {counterpart.translate(
                                    "prediction.resolve_modal.proven_true"
                                )}
                            </Radio>
                            <Radio value={"no"}>
                                {counterpart.translate(
                                    "prediction.resolve_modal.was_incorrect"
                                )}
                            </Radio>
                        </Radio.Group>
                    </Form.Item>
                </Form>
            </div>
        </Modal>
    );
}
