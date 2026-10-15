// TypeScript port of the legacy FileWrite.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";

export const FileWrite = () => {
    return (
        <span>
            <Translate component="span" content="proposal.file_write" />
        </span>
    );
};
