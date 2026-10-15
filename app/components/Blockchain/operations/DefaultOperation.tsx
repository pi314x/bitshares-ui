// TypeScript port of the legacy DefaultOperation.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import counterpart from "counterpart";

interface DefaultOperationProps {
    op: any;
}

export const DefaultOperation = ({op}: DefaultOperationProps) => {
    console.log("unimplemented op:", op);
    return (
        <span>
            {counterpart.translate("operation.unknown_operation")} {op[0]}
        </span>
    );
};
