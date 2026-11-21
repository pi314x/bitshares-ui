// TypeScript/function-component port of the legacy Incognito.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Purely mechanical - no lifecycle, no state,
// no stores to translate. Its only caller anywhere in the app,
// `App.jsx`, passes a single `onClickIgnore` prop (its only undeclared-
// in-the-original prop, since the original had no `propTypes` at all);
// added to `IncognitoProps` below as an optional field.
import * as React from "react";
import Translate from "react-translate-component";

export interface IncognitoProps {
    onClickIgnore?: (event: React.MouseEvent) => void;
}

export default function Incognito(props: IncognitoProps) {
    return (
        <div id="incognito">
            <div className="dismiss" onClick={props.onClickIgnore}>
                &times;
            </div>
            <strong>
                <Translate content="incognito.mode" />{" "}
            </strong>
            <Translate content="incognito.warning" />
        </div>
    );
}
