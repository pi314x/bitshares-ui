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
// `useReduxState` here.
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
//
// The page's layout (a head, a switch between the two ways to sign in, one card with the form of
// the chosen way) is new; nothing the two forms do changed. Both forms stay mounted, the one that
// is not chosen is only hidden (as it was: `display-none`), so what was typed in it is kept when
// the switch is used. `WalletHeaderSelection`/`AccountHeaderSelection` (the two big pictures that
// were also the switch) are no longer used here; the Registration page still has them. The class
// `login-page-selector` stays on the page: the legacy sheet scopes the file drop area (the large
// one on a desktop, the small one on a phone) and the password block to it.
import * as React from "react";
import counterpart from "counterpart";
import AccountLogin from "./AccountLogin";
import WalletLogin from "./WalletLogin";
import {PageHead} from "../../design-system/PageHead";
import {SubMenu} from "../../design-system/SubMenu";
import styles from "./Login.module.scss";

interface LoginProps {
    history: any;
}

// a title that carries markup for the old selector (`<span class="hide-text-for-small">`)
const plain = (key: string) =>
    (counterpart.translate(key) as string).replace(/<[^>]*>/g, "");

export default function Login({history}: LoginProps) {
    const [activeWalletModel, setActiveWalletModel] = React.useState(true);

    const changeActiveModel = (isActiveWallet: boolean) => {
        setActiveWalletModel(isActiveWallet);
    };

    return (
        <div className={`${styles.page} login-page-selector`}>
            <PageHead flush title={counterpart.translate("login.title")} />
            <SubMenu
                toggle
                aria-label={counterpart.translate("login.title")}
                items={[
                    {
                        key: "wallet",
                        label: plain("registration.walletModelTitle")
                    },
                    {
                        key: "account",
                        label: plain("registration.accountModelTitle")
                    }
                ]}
                value={activeWalletModel ? "wallet" : "account"}
                onChange={key => changeActiveModel(key === "wallet")}
            />
            <div
                className={`${styles.plate} ${
                    activeWalletModel ? "" : styles.off
                }`}
            >
                <p className={styles.kind}>
                    {counterpart.translate("wallet.wallet_model")}
                </p>
                <WalletLogin
                    active={activeWalletModel}
                    onChangeActive={() =>
                        !activeWalletModel ? changeActiveModel(true) : null
                    }
                    goToAccountModel={() => changeActiveModel(false)}
                    history={history}
                />
            </div>
            <div
                className={`${styles.plate} ${
                    activeWalletModel ? styles.off : ""
                }`}
            >
                <p className={styles.kind}>
                    {counterpart.translate("wallet.password_model")}
                </p>
                <AccountLogin
                    active={!activeWalletModel}
                    history={history}
                    onChangeActive={() =>
                        activeWalletModel ? changeActiveModel(false) : null
                    }
                    goToWalletModel={() => changeActiveModel(true)}
                />
            </div>
        </div>
    );
}
