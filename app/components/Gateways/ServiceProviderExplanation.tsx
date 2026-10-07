// TypeScript/functional-component port of the legacy
// ServiceProviderExplanation.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md). Pure,
// stateless explainer block shown as the first page of
// `GatewaySelectorModal` (see that file, ported alongside this one in the
// same commit - it is this component's only caller/importer, confirmed via
// `grep -rn "ServiceProviderExplanation" app`).
//
// Not security-sensitive per AGENTS.md: no WalletDb/WalletApi/
// ApplicationApi calls, no state, no store access - just translated copy.
//
// Mechanical class-to-function translation: a plain `React.Component` with
// no lifecycle methods and no local state becomes a plain function
// component. `static defaultProps = {showSalutation: false}` becomes a
// default parameter value on the destructured prop.
//
// Dropped as confirmed dead (grep-verified against the original - every
// name below appears only in its own `import` line, never referenced
// anywhere else in the file):
// - `PropTypes` (the import existed, but `static propTypes` used plain
//   `PropTypes.bool` so this is folded into the new `ServiceProviderExplanation
//   Props` interface's `showSalutation?: boolean` instead).
// - `counterpart` - never called (`counterpart.translate(...)`) in this
//   file; all copy goes through `<Translate content="..." />` instead.
// - `Table`, `Button`, `Radio`, `Modal`, `Checkbox`, `Collapse` from
//   "bitshares-ui-style-guide" - none of these components are rendered
//   anywhere in the original's `render()`.
// - `ChainTypes` from "../Utility/ChainTypes" - imported but never
//   referenced (no chain-type prop validation was ever actually used
//   here).
import * as React from "react";
import Translate from "react-translate-component";

interface ServiceProviderExplanationProps {
    showSalutation?: boolean;
}

export default function ServiceProviderExplanation({
    showSalutation = false
}: ServiceProviderExplanationProps) {
    return (
        <React.Fragment>
            {showSalutation && (
                <Translate
                    content="external_service_provider.welcome.hello"
                    component="h2"
                />
            )}
            {showSalutation && (
                <Translate
                    content="external_service_provider.welcome.first_line"
                    component="p"
                />
            )}
            <p>
                <Translate content="external_service_provider.welcome.explanation_dex" />
                <Translate content="external_service_provider.welcome.explanation_service_providers" />
            </p>
            <p>
                <Translate content="external_service_provider.welcome.explanation_what_to_do" />
                <Translate content="external_service_provider.welcome.explanation_later" />
            </p>
        </React.Fragment>
    );
}
