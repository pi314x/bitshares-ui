// TypeScript/functional-component port of the legacy DeletePoolModal.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Dropped as confirmed dead (grep-verified: each name appears only on
// its own `import` line, nowhere else in the file): the `Immutable`,
// `big` (bignumber.js), `AccountStore`, `AmountSelector`, `Icon`,
// `AccountBalance`, `connect` (alt-react), and `BindToChainState`
// imports, along with the `ChainTypes` import and the `static propTypes
// = {pool: ChainTypes.ChainLiquidityPool.isRequired}` declaration it
// fed - this file never actually applies `BindToChainState` or
// `connect` to the exported component (`export default DeletePoolModal;`,
// not `export default BindToChainState(...)`), so `pool` was always
// whatever raw value the caller passed (a plain share-asset symbol
// string, per `AccountPools.tsx`'s call site), never chain-resolved.
// Likely leftover copy-paste from a sibling modal file.
//
// `componentWillReceiveProps` (a pure `console.log("DeletePoolModal: ")`
// debug statement with no other effect) is kept, per this migration's
// established practice of preserving pre-existing debug logs - ported
// as a dependency-less `useEffect` (fires on every render including
// mount, unlike `componentWillReceiveProps`, which skips the initial
// mount; inconsequential here since the only effect is a console log).
//
// The original captured `props.isModalVisible` into `this.state
// .isModalVisible` in the constructor and rendered from state, never
// resyncing it (no `setState` call anywhere touches it again). This
// port reads the `isModalVisible` prop directly instead. Verified
// behaviorally identical for the one real caller
// (`AccountPools.tsx`'s `{state.isDeletePoolModalVisible && (
// <DeletePoolModal isModalVisible={state.isDeletePoolModalVisible}
// .../>)}` conditionally *mounts/unmounts* the whole component rather
// than updating an already-mounted one to `false` - `isModalVisible` is
// therefore always `true` for this component's entire mounted
// lifetime either way), so the state-capture indirection has no
// observable effect to preserve.
import * as React from "react";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import {Modal, Button, Row, Col} from "bitshares-ui-style-guide";

interface DeletePoolModalProps {
    isModalVisible: boolean;
    onHideModal: () => void;
    onDeletePool: (pool: any) => void;
    pool: any;
}

export default function DeletePoolModal({
    isModalVisible,
    onHideModal,
    onDeletePool,
    pool
}: DeletePoolModalProps) {
    React.useEffect(() => {
        console.log("DeletePoolModal: ");
    });

    const hideModal = () => {
        onHideModal();
    };

    const onSubmit = () => {
        onDeletePool(pool);
    };

    return (
        <Modal
            visible={isModalVisible}
            id="pool_delete_modal"
            overlay={true}
            onCancel={hideModal}
            footer={[
                <Button key={"send"} onClick={onSubmit}>
                    {counterpart.translate(
                        "poolmart.liquidity_pools.delete_pool"
                    )}
                </Button>,
                <Button
                    key={"Cancel"}
                    onClick={hideModal}
                    style={{marginLeft: "20px"}}
                >
                    <Translate component="span" content="transfer.cancel" />
                </Button>
            ]}
        >
            <div>
                <Row>
                    <Col span={24}>
                        {counterpart.translate(
                            "poolmart.liquidity_pools.confirm_delete_pool"
                        )}
                    </Col>
                </Row>
            </div>
        </Modal>
    );
}
