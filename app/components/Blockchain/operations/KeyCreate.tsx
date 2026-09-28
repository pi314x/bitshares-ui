// TypeScript port of the legacy KeyCreate.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";

export const KeyCreate = () => {
    return (
        <span>
            <Translate component="span" content="transaction.create_key" />
        </span>
    );
};
