// TypeScript port of the legacy Custom.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";

interface CustomProps {
    fromComponent?: string;
}

export const Custom = ({fromComponent}: CustomProps) => {
    return (
        <span>
            <Translate
                component="span"
                content={
                    fromComponent === "proposed_operation"
                        ? "proposal.custom"
                        : "transaction.custom"
                }
            />
        </span>
    );
};
