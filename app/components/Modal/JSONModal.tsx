// TypeScript port of the legacy JSONModal.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Already a plain functional component in
// the original - this is a pure type-annotation conversion (PropTypes ->
// a TS interface with the same required/optional/default shape), no
// logic changes.
import * as React from "react";
import counterpart from "counterpart";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import Inspector from "react-json-inspector";

interface JSONModalProps {
    visible: boolean;
    hideModal: () => void;
    operation?: any;
    title?: string | null;
}

export default function JSONModal({
    operation = [],
    visible,
    hideModal,
    title = null
}: JSONModalProps) {
    return (
        <Modal
            title={title || counterpart.translate("explorer.block.op")}
            onCancel={hideModal}
            footer={[
                <Button key="cancel" onClick={hideModal}>
                    {counterpart.translate("modal.close")}
                </Button>
            ]}
            visible={visible}
        >
            <Inspector data={operation} search={false} />
        </Modal>
    );
}
