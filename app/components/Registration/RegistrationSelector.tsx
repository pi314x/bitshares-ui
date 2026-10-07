// TypeScript/functional-component port of the legacy
// RegistrationSelector.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes.
//
// Not security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `ApplicationApi`, `.add_type_operation`, `process_transaction`
// - none appear; this component only toggles a local "which registration
// path is highlighted" UI state and delegates navigation to react-router.
//
// Rendered via `<Route path="/registration" exact
// component={RegistrationSelector} />` in `App.jsx` (react-router-dom v5),
// which injects `history`/`location`/`match` as props - `props.history
// .push(...)` is real, not dead.
//
// Dropped as confirmed dead (grepped): `static contextTypes = {router:
// PropTypes.object.isRequired}` - the legacy React context API - `this
// .context` is never read anywhere in the file. Has no hooks/functional
// equivalent need since it was never used.
//
// `props.children`'s early-return branch is never actually exercised by
// the one real call site above (`<Route component={...}>` never supplies
// `children`), but it's a real conditional gated on a real, explicitly
// typed prop (with its own default), so it's kept as-is rather than
// treated as dead code - unlike the `contextTypes` case, nothing here
// prevents `children` from someday being passed by a different caller.
import * as React from "react";
import Translate from "react-translate-component";
import WalletBlockSelection from "./WalletBlockSelection";
import WalletHeaderSelection from "./WalletHeaderSelection";
import AccountBlockSelection from "./AccountBlockSelection";
import AccountHeaderSelection from "./AccountHeaderSelection";

interface RegistrationSelectorProps {
    children?: React.ReactElement | null;
    history: {push: (path: string) => void};
}

export default function RegistrationSelector({
    children = null,
    history
}: RegistrationSelectorProps) {
    const [activeWalletModel, setActiveWalletModel] = React.useState(true);

    if (children) {
        return children;
    }

    const onSelect = (route: string) => {
        history.push(`/registration/${route}`);
    };

    const changeActiveModel = (isActiveWallet: boolean) => {
        setActiveWalletModel(isActiveWallet);
    };

    const renderHeader = (isWalletSection: boolean) => (
        <div className="small-horizontal small-only-block">
            <WalletHeaderSelection
                active={activeWalletModel}
                onChangeActive={() => changeActiveModel(true)}
                forSmall={!isWalletSection}
            />
            <AccountHeaderSelection
                active={!activeWalletModel}
                onChangeActive={() => changeActiveModel(false)}
                forSmall={isWalletSection}
            />
        </div>
    );

    return (
        <div className="grid-block align-center registration-layout">
            <div className="grid-block shrink vertical text-center registration-selector">
                <Translate
                    content="registration.title"
                    component="p"
                    className="registration-title"
                />
                <div className="registration-container">
                    <div className="v-align">
                        <div
                            className={`${
                                !activeWalletModel
                                    ? "inactive-model-block"
                                    : ""
                            } selection-block align-center plate`}
                        >
                            {renderHeader(true)}
                            <WalletBlockSelection
                                onSelect={() => onSelect("local")}
                                active={activeWalletModel}
                                onChangeActive={() => changeActiveModel(true)}
                            />
                        </div>
                        <div
                            className={`${
                                activeWalletModel
                                    ? "inactive-model-block"
                                    : ""
                            } selection-block align-center plate`}
                        >
                            {renderHeader(false)}
                            <AccountBlockSelection
                                onSelect={() => onSelect("cloud")}
                                active={!activeWalletModel}
                                onChangeActive={() =>
                                    changeActiveModel(false)
                                }
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
