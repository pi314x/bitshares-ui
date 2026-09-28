// TypeScript port of the legacy ShortOrderCancel.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";

interface ShortOrderCancelProps {
    op: any;
    changeColor: (color: string) => void;
}

export const ShortOrderCancel = ({op, changeColor}: ShortOrderCancelProps) => {
    changeColor("cancel");

    return (
        <span>
            <Translate component="span" content="proposal.short_order_cancel" />
            &nbsp;
            {op[1].order}
        </span>
    );
};
