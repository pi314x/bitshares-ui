// TypeScript/functional-component port of the legacy Login.jsx (Phase
// 8, docs/UI_MIGRATION_PLAN.md) - the last of the `Login/` directory's 4
// files, ported last since it imports both of the others (directory now
// complete, 4/4). Mechanical class-to-hooks translation, no logic
// changes.
//
// Not itself security-sensitive per AGENTS.md: this file holds no
// password/key logic of its own. It only toggles which of
// `WalletLogin`/`AccountLogin` (both ported in this same commit - see
// their own header comments for the actual wallet-unlock/password-
// handling logic and security notes) is the "active" model, and forwards
// `this.props.history` through to both.
//
// No Alt.js `connect`/`AltContainer` existed in the original - it never
// read an Alt store directly, so there's nothing to translate to
// `useAltStore` here.
//
// `this.state.activeWalletModel` becomes a plain `useState`;
// `changeActiveModel(isActiveWallet)` becomes a `setActiveWalletModel`
// call, invoked from the same four `onChangeActive`/`goTo*Model`
// closures as the original.
//
// `history` is read (`this.props.history`, forwarded to both
// `WalletLogin`/`AccountLogin`) but the original class declares no
// `propTypes` at all - added as a real, required `history: any` field
// on the new props interface, matching the sibling `Registration/
// WalletRegistration.tsx`/`AccountRegistration.tsx` convention for the
// same situation: this component is only ever rendered via `app/
// App.jsx`'s `<Route path="/login" component={Login} />`, which always
// injects it.
//
// TS-forced adjustment: all four `WalletHeaderSelection`/
// `AccountHeaderSelection` calls below pass a `loginPage` prop, as the
// original did. The already-ported, out-of-scope `Registration/
// WalletHeaderSelection.tsx`/`AccountHeaderSelection.tsx` (both ported
// in an earlier, separate commit, commit `cee7460`) declare no
// `loginPage` field on their props interfaces and never read it
// (grep-confirmed on both files: no match for `loginPage`) - and that
// was already true of the pre-TypeScript `.jsx` originals those two
// files were ported from (checked via `git show cee7460^:.../
// WalletHeaderSelection.jsx` - no `loginPage` there either), predating
// this migration entirely. Dropped at these four call sites, since
// TypeScript's structural prop checking rejects an unknown prop and the
// destination components were already ignoring it.
//
// Grepped app-wide for `Login/Login` and for any ref into this
// component: only `app/App.jsx` renders it (`component={Login}`), with
// no ref - no `forwardRef`/`useImperativeHandle` needed.
import * as React from "react";
import Translate from "react-translate-component";
import AccountLogin from "./AccountLogin";
import WalletLogin from "./WalletLogin";
import WalletHeaderSelection from "../Registration/WalletHeaderSelection";
import AccountHeaderSelection from "../Registration/AccountHeaderSelection";

interface LoginProps {
    history: any;
}

export default function Login({history}: LoginProps) {
    const [activeWalletModel, setActiveWalletModel] = React.useState(true);

    const changeActiveModel = (isActiveWallet: boolean) => {
        setActiveWalletModel(isActiveWallet);
    };

    return (
        <div className="grid-block align-center registration-layout">
            <div className="grid-block shrink vertical text-center registration-selector">
                <Translate
                    content="login.title"
                    component="p"
                    className="registration-title"
                />
                <div>
                    <div className="v-align login-page-selector">
                        <div
                            className={`${
                                !activeWalletModel ? "inactive-model-block" : ""
                            } selection-block align-center plate`}
                        >
                            <div className="small-horizontal small-only-block">
                                <WalletHeaderSelection
                                    active={activeWalletModel}
                                    onChangeActive={() =>
                                        changeActiveModel(true)
                                    }
                                />
                                <AccountHeaderSelection
                                    active={!activeWalletModel}
                                    onChangeActive={() =>
                                        changeActiveModel(false)
                                    }
                                    forSmall
                                />
                            </div>
                            <WalletLogin
                                active={activeWalletModel}
                                onChangeActive={() =>
                                    !activeWalletModel
                                        ? changeActiveModel(true)
                                        : null
                                }
                                goToAccountModel={() =>
                                    changeActiveModel(false)
                                }
                                history={history}
                            />
                        </div>
                        <div
                            className={`${
                                activeWalletModel ? "inactive-model-block" : ""
                            } selection-block align-center plate`}
                        >
                            <div className="small-horizontal small-only-block">
                                <WalletHeaderSelection
                                    active={activeWalletModel}
                                    onChangeActive={() =>
                                        changeActiveModel(true)
                                    }
                                    forSmall
                                />
                                <AccountHeaderSelection
                                    active={!activeWalletModel}
                                    onChangeActive={() =>
                                        changeActiveModel(false)
                                    }
                                />
                            </div>
                            <AccountLogin
                                active={!activeWalletModel}
                                history={history}
                                onChangeActive={() =>
                                    activeWalletModel
                                        ? changeActiveModel(false)
                                        : null
                                }
                                goToWalletModel={() => changeActiveModel(true)}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
