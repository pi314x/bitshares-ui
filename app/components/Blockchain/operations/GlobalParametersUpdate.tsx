// TypeScript port of the legacy GlobalParametersUpdate.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";

interface GlobalParametersUpdateProps {
    fromComponent?: string;
}

export const GlobalParametersUpdate = ({
    fromComponent
}: GlobalParametersUpdateProps) => {
    return (
        <span>
            <Translate
                component="span"
                content={
                    fromComponent === "proposed_operation"
                        ? "proposal.global_parameters_update"
                        : "transaction.global_parameters_update"
                }
            />
        </span>
    );
};
