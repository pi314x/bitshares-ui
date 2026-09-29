// TypeScript/functional-component port of the legacy CreateLockModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: `onSubmit` submits an on-chain
// ticket-creation (lock) transaction via `ApplicationApi.createTicket` -
// transcribed verbatim.
//
// `AssetWrapper(Component, {propNames: ["asset"]})` kept as-is (shared
// HOC, out of scope). `UNSAFE_componentWillReceiveProps` (resets amount
// state when the resolved `asset`'s id changes) becomes a `useEffect`
// keyed on `asset.get("id")` - no mount-guard needed, same reasoning as
// `ReserveAssetModal.tsx` (previous Modal batch): the effect's first
// firing recomputes the same initial state the lazy `useState`
// initializer already computed.
//
// Dropped as confirmed dead (grepped, not assumed): `onAmountChanged`'s
// `state.asset` field (set, never read in `render()`, not part of
// `getInitialState` either - same dead field as in
// `ReserveAssetModal.tsx`); `onSubmit`'s `state.numberOfPeriods` (set
// once in the `.then()` callback, never initialized anywhere and never
// read anywhere else).
import * as React from "react";
import BalanceComponent from "../Utility/BalanceComponent";
import counterpart from "counterpart";
import AmountSelector from "../Utility/AmountSelectorStyleGuide";
import {ChainStore, ChainTypes} from "bitsharesjs";
import {Asset} from "common/MarketClasses";
import AssetWrapper from "../Utility/AssetWrapper";
import {
    Modal,
    Button,
    Form,
    Alert,
    Tooltip,
    Select
} from "bitshares-ui-style-guide";
import ApplicationApi from "../../api/ApplicationApi";

interface CreateLockModalState {
    targetType: any;
    amount: any;
    amountAsset: any;
}

interface CreateLockModalCoreProps {
    visible: boolean;
    hideModal: () => void;
    asset: any;
    account: any;
}

function CreateLockModal({
    visible,
    hideModal,
    asset,
    account
}: CreateLockModalCoreProps) {
    const getInitialState = (assetArg: any): CreateLockModalState => ({
        targetType: null,
        amount: 0,
        amountAsset: new (Asset as any)({
            amount: 0,
            asset_id: assetArg.get("id"),
            precision: assetArg.get("precision")
        })
    });

    const [state, setState] = React.useState<CreateLockModalState>(() =>
        getInitialState(asset)
    );

    const mergeState = (partial: Partial<CreateLockModalState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    React.useEffect(() => {
        setState(getInitialState(asset));
    }, [asset.get("id")]);

    const onAmountChanged = ({amount}: any) => {
        state.amountAsset.setAmount({real: amount});
        mergeState({amount});
    };

    const onTargetTypeChanged = (e: any) => {
        mergeState({targetType: e});
    };

    const canSubmit = () => {
        return state.targetType && state.amountAsset.hasAmount();
    };

    const onSubmit = () => {
        (ApplicationApi as any)
            .createTicket(
                account,
                state.amountAsset.asset_id,
                state.amountAsset.getAmount(),
                state.targetType
            )
            .then(() => {
                state.amountAsset.setAmount({sats: 0});
                mergeState({amount: 0});
            });
        hideModal();
    };

    const getUnlockPeriod = () => {
        if (!state.targetType) return 0;
        const unlockPeriods: any = {
            0: 0,
            1: 180,
            2: 360,
            3: 720,
            4: Infinity
        };
        return unlockPeriods[state.targetType];
    };

    const assetId = asset.get("id");

    let currentBalance: any =
        account &&
        account.get("balances", []).size &&
        !!account.getIn(["balances", assetId])
            ? ChainStore.getObject(account.getIn(["balances", assetId]))
            : null;
    if (!currentBalance) {
        currentBalance = 0;
    } else {
        currentBalance = currentBalance.get("balance");
    }

    return (
        <Modal
            visible={visible}
            onCancel={hideModal}
            title={counterpart.translate("modal.create_lock.title")}
            footer={[
                <Button
                    type="primary"
                    key="submit"
                    onClick={onSubmit}
                    disabled={!canSubmit()}
                >
                    {counterpart.translate("modal.create_lock.submit")}
                </Button>,
                <Button onClick={hideModal} key="cancel">
                    {counterpart.translate("cancel")}
                </Button>
            ]}
        >
            <Alert
                message={counterpart.translate(
                    "modal.create_lock.warning_message",
                    {lock_days: getUnlockPeriod()}
                )}
                type="warning"
                showIcon
                style={{marginBottom: "2em"}}
            />
            <Form layout="vertical">
                <AmountSelector
                    label="modal.create_lock.amount"
                    amount={state.amount}
                    onChange={onAmountChanged}
                    asset={assetId}
                    assets={[assetId]}
                    display_balance={
                        <div
                            onClick={() => {
                                state.amountAsset.setAmount({
                                    sats: currentBalance
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
                <Form.Item
                    label={counterpart.translate(
                        "modal.create_lock.targetType"
                    )}
                    validateStatus={!state.targetType ? "warning" : ""}
                    help={
                        !state.targetType
                            ? counterpart.translate(
                                  "modal.create_lock.type_warning"
                              )
                            : ""
                    }
                >
                    <Tooltip
                        placement="top"
                        title={counterpart.translate(
                            "tooltip.create_lock_periods"
                        )}
                    >
                        <Select
                            value={state.targetType}
                            onChange={onTargetTypeChanged}
                        >
                            {Object.keys((ChainTypes as any).ticket_type).map(
                                key =>
                                    (ChainTypes as any).ticket_type[key] !=
                                    0 ? (
                                        <Select.Option
                                            key={
                                                (ChainTypes as any)
                                                    .ticket_type[key]
                                            }
                                        >
                                            {(ChainTypes as any).ticket_type[
                                                key
                                            ] +
                                                ": " +
                                                counterpart.translate(
                                                    "operation.ticket_types." +
                                                        key
                                                )}
                                        </Select.Option>
                                    ) : null
                            )}
                        </Select>
                    </Tooltip>
                </Form.Item>
            </Form>
        </Modal>
    );
}

const WrappedCreateLockModal = AssetWrapper(CreateLockModal, {
    propNames: ["asset"]
} as any);

export default WrappedCreateLockModal;
