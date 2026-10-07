// TypeScript/functional-component port of the legacy
// ReserveAssetModal.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical,
// no logic changes.
//
// Security-sensitive per AGENTS.md: `onSubmit` submits an on-chain
// asset-reserve (burn) transaction via `AssetActions.reserveAsset` -
// transcribed verbatim, including that `hideModal()` is called
// unconditionally right after kicking off the async action, not after
// it resolves.
//
// `AssetWrapper(Component, {propNames: ["asset"]})` kept as-is (shared
// HOC, out of scope; resolves `asset` as a required chain type, so it's
// always present by the time this component renders/updates).
//
// `UNSAFE_componentWillReceiveProps` (resets `amount`/`amountAsset`
// whenever `asset`'s id actually changes, guarded on both the old and
// new `asset` being present) becomes a `useEffect` keyed on
// `asset.get("id")` - no mount-guard needed: the effect's first firing
// (on mount) recomputes the exact same initial state the `useState`
// lazy initializer already computed, which is harmless, and every
// firing after that corresponds exactly to the original's asset-id
// comparison.
//
// Dropped as confirmed dead: `onAmountChanged`'s `this.setState({
// amount, asset})` set a `state.asset` field that doesn't exist in
// `getInitialState` and is never read anywhere in `render()` (grepped) -
// only `amount` is kept.
import * as React from "react";
import BalanceComponent from "../Utility/BalanceComponent";
import counterpart from "counterpart";
import AmountSelector from "../Utility/AmountSelectorStyleGuide";
import AssetActions from "actions/AssetActions";
import {ChainStore} from "bitsharesjs";
import {Asset} from "common/MarketClasses";
import AssetWrapper from "../Utility/AssetWrapper";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import {Form} from "../../design-system/Form";
import {Alert} from "../../design-system/Alert";

interface ReserveAssetModalState {
    amount: any;
    amountAsset: any;
}

interface ReserveAssetModalCoreProps {
    visible: boolean;
    hideModal: () => void;
    asset: any;
    account: any;
}

function ReserveAssetModal({
    visible,
    hideModal,
    asset,
    account
}: ReserveAssetModalCoreProps) {
    const getInitialState = (assetArg: any): ReserveAssetModalState => ({
        amount: 0,
        amountAsset: new (Asset as any)({
            amount: 0,
            asset_id: assetArg.get("id"),
            precision: assetArg.get("precision")
        })
    });

    const [state, setState] = React.useState<ReserveAssetModalState>(() =>
        getInitialState(asset)
    );

    const mergeState = (partial: Partial<ReserveAssetModalState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    React.useEffect(() => {
        setState(getInitialState(asset));
    }, [asset.get("id")]);

    const onAmountChanged = ({amount}: any) => {
        state.amountAsset.setAmount({real: amount});
        mergeState({amount});
    };

    const onSubmit = () => {
        (AssetActions as any)
            .reserveAsset(
                state.amountAsset.getAmount(),
                asset.get("id"),
                account.get("id")
            )
            .then(() => {
                state.amountAsset.setAmount({sats: 0});
                mergeState({amount: 0});
            });
        hideModal();
    };

    const assetId = asset.get("id");

    const currentBalance =
        account &&
        account.get("balances", []).size &&
        !!account.getIn(["balances", assetId])
            ? ChainStore.getObject(account.getIn(["balances", assetId]))
            : null;
    if (!currentBalance) return null;

    return (
        <Modal
            visible={visible}
            onCancel={hideModal}
            title={counterpart.translate("modal.reserve.title")}
            footer={[
                <Button variant="accent" key="submit" onClick={onSubmit}>
                    {counterpart.translate("modal.reserve.submit")}
                </Button>,
                <Button onClick={hideModal} key="cancel">
                    {counterpart.translate("cancel")}
                </Button>
            ]}
        >
            <Alert
                message={counterpart.translate(
                    "modal.reserve.warning_message"
                )}
                type="warning"
                showIcon
                style={{marginBottom: "2em"}}
            />
            <Form layout="vertical">
                <AmountSelector
                    label="modal.reserve.amount"
                    amount={state.amount}
                    onChange={onAmountChanged}
                    asset={assetId}
                    assets={[assetId]}
                    display_balance={
                        <div
                            onClick={() => {
                                state.amountAsset.setAmount({
                                    sats: (currentBalance as any).get(
                                        "balance"
                                    )
                                });
                                mergeState({
                                    amount: state.amountAsset.getAmount({
                                        real: true
                                    })
                                });
                            }}
                        >
                            <BalanceComponent
                                balance={account.getIn(["balances", assetId])}
                            />
                        </div>
                    }
                    tabIndex={1}
                />
            </Form>
        </Modal>
    );
}

const WrappedReserveAssetModal = AssetWrapper(ReserveAssetModal, {
    propNames: ["asset"]
} as any);

export default WrappedReserveAssetModal;
