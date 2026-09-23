// TypeScript/functional-component port of the legacy ConfirmOrderModal.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md - the first slice of the Exchange
// screen). Purely presentational confirmation dialog shown before
// submitting an order that would cancel/replace existing orders; no chain
// state, no store, just props in and two callbacks out
// (`onForce`/`hideModal`). Chosen as the lowest-risk possible on-ramp
// into this phase, given the scale of the rest of the Exchange directory
// (`Exchange.jsx` alone is 3,683 lines) - mechanical, line-for-line
// translation, no logic changes.
import * as React from "react";
import utils from "common/utils";
import Translate from "react-translate-component";
import {Modal, Button} from "bitshares-ui-style-guide";
import counterpart from "counterpart";

interface ConfirmOrderModalProps {
    type: string;
    diff: any;
    hasOrders: boolean;
    visible: boolean;
    hideModal: () => void;
    onForce: () => void;
}

export default function ConfirmOrderModal({
    type,
    diff,
    hasOrders,
    visible,
    hideModal,
    onForce
}: ConfirmOrderModalProps) {
    function onForceDecision(value: boolean, e: any) {
        e.preventDefault();

        hideModal();

        if (value) onForce();
    }

    function submit(e: any) {
        onForceDecision(true, e);
    }

    function cancel(e: any) {
        onForceDecision(false, e);
    }

    const footer = [
        <Button key="submit" onClick={submit}>
            {counterpart.translate("settings.yes")}
        </Button>,
        <Button key="cancel" type="primary" onClick={cancel}>
            {counterpart.translate("settings.no")}
        </Button>
    ];

    return (
        <Modal
            footer={footer}
            visible={visible}
            onCancel={cancel}
            title={counterpart.translate("transaction.confirm")}
        >
            <div className="grid-block vertical">
                {!hasOrders ? (
                    <Translate content={"exchange.confirm_no_orders_" + type} />
                ) : (
                    <Translate
                        content={"exchange.confirm_" + type}
                        diff={(utils as any).format_number(diff, 2)}
                    />
                )}
            </div>
        </Modal>
    );
}
