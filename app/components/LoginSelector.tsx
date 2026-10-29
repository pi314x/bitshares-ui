// TypeScript/functional-component port of the legacy LoginSelector.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not itself security-sensitive per AGENTS.md (grepped for `WalletApi`/
// `WalletDb`/`ApplicationApi`/`.add_type_operation`/`process_transaction` -
// none appear), but the "Unlock" button dispatches
// `WalletUnlockActions.unlock()` (the standard wallet-unlock flow used
// throughout the app) - kept unchanged, transcribed verbatim like every
// other `WalletUnlockActions.unlock()` call site in this migration.
//
// `connect(LoginSelector, {listenTo: [AccountStore], getProps})` -
// `currentAccount` (the only field `getProps()` returns) is only ever
// read inside the *already-commented-out* `componentDidUpdate` in the
// original (kept below as an inert comment, matching this migration's
// established treatment of commented-out blocks, e.g.
// `Account/CreateAccount.tsx`'s `RefcodeInput` block) - so it's never
// actually consumed by any live code. Replicated with a bare
// `useReduxState(selectAccountState)` call purely for its re-render-on-change
// side effect, matching this migration's established "connect wrap with
// an otherwise-unused store" treatment.
//
// Dropped as confirmed dead (grepped):
// - `state.step` - initialized to `1`, never read or changed anywhere.
// - `onSelect(route)` - never called anywhere in the file; its only
//   reference, `this.props.history`, becomes unused with it (this
//   component is rendered via `<Route path="/create-account"
//   component={LoginSelector} />`, which injects `history` regardless of
//   whether it's read).
// - `UNSAFE_componentWillMount`/`componentWillUnmount`/`this.unmounted`,
//   and the `isIncognito(...)` call they wrap: the whole point of that
//   effect was populating `state.incognito`, which is never read
//   anywhere in `render()` or elsewhere - dropped as a unit, taking the
//   now-unused `isIncognito` import from `feature_detect` with it.
// - `FlagImage` - a small helper component defined at module scope,
//   never referenced anywhere in `render()`.
// - `render()`'s `const translator = require("counterpart");` - the same
//   module already imported as `counterpart` at the top of the file
//   (`require("counterpart")` and the top-level `import counterpart from
//   "counterpart"` resolve to the same module object) - simplified to
//   use the existing `counterpart` import directly rather than a second,
//   redundant `require()` call, which also avoids relying on a bare
//   `require()` in a TypeScript file.
import * as React from "react";
import counterpart from "counterpart";
import Translate from "react-translate-component";
import SettingsActions from "actions/SettingsActions";
import WalletUnlockActions from "actions/WalletUnlockActions";
import SettingsStore from "stores/SettingsStore";
import IntlActions from "actions/IntlActions";
import CreateAccount from "./Account/CreateAccount";
import CreateAccountPassword from "./Account/CreateAccountPassword";
import {Routes, Route, Link, useNavigate} from "react-router-dom";
import {getWalletName, getAllowedLogins} from "branding";
import {Select} from "../design-system/Select";
import {Button} from "../design-system/Button";
import {OnboardingPage} from "./Wallet/OnboardingPage";
import styles from "./LoginSelector.module.scss";
import {Icon} from "../design-system/Icon";
import {useReduxState} from "../next/hooks/useReduxState";
import {selectAccountState} from "../store/slices/accountSlice";

const RouteAny = Route as any;

interface LoginSelectorState {
    locales: any;
    currentLocale: any;
}

export default function LoginSelector() {
    useReduxState<any>(selectAccountState);
    const navigate = useNavigate();

    const [state, setState] = React.useState<LoginSelectorState>({
        locales: (SettingsStore as any).getState().defaults.locale,
        currentLocale: (SettingsStore as any).getState().settings.get("locale")
    });

    // componentDidUpdate() {
    // const myAccounts = AccountStore.getMyAccounts();

    // use ChildCount to make sure user is on /create-account page except /create-account/*
    // to prevent redirect when user just registered and need to make backup of wallet or password
    // const childCount = React.Children.count(this.props.children);

    // do redirect to portfolio if user already logged in
    // if (
    //     this.props.history &&
    //     Array.isArray(myAccounts) &&
    //     myAccounts.length !== 0 &&
    //     childCount === 0
    // )
    //     this.props.history.push("/account/" + this.props.currentAccount);
    // }

    const handleLanguageSelect = (locale: any) => {
        (IntlActions as any).switchLocale(locale);
        setState(prev => ({...prev, currentLocale: locale}));
    };

    // Dropped: the original's custom `filterOption` read `option.props
    // .language` (a custom prop set on each `<Select.Option>` purely to
    // carry the translated language name for this filter to read) -
    // but that's the exact same string each option's `children` already
    // renders, so it's functionally identical to the design-system
    // `Select`'s own default filter (a case-insensitive substring match
    // against the option's rendered text). Relying on that default
    // instead, rather than reimplementing a custom `filterOption` with
    // no real behavior difference.

    const flagDropdown = (
        <Select
            showSearch
            value={state.currentLocale}
            onChange={handleLanguageSelect}
            style={{width: "160px"}}
        >
            {state.locales.map((locale: any) => (
                <Select.Option key={locale} value={locale}>
                    {counterpart.translate("languages." + locale)}
                </Select.Option>
            ))}
        </Select>
    );

    const allowed: string[] = (getAllowedLogins as any)();
    const createTo = allowed.includes("password")
        ? "/create-account/password"
        : "/create-account/wallet";

    // Only layout changed here (docs/UI_MIGRATION_PLAN.md §7.31): the same
    // handlers, the same routes and the same two forms, in the frame the other
    // onboarding pages use. Two tiles say what each way forward is for (create /
    // log in), the other ways are a list of rows, the language sits in the
    // card's foot, and the chosen form comes under them.
    const t = (key: string) =>
        counterpart.translate(`account.login_selector.${key}`) as string;

    return (
        <OnboardingPage
            title={<Translate content="header.create_account" />}
            subtitle={
                <Translate
                    content="account.intro_text_title"
                    wallet_name={(getWalletName as any)()}
                />
            }
            intro={<Translate unsafe content="account.intro_text_1" />}
            footer={
                <div
                    className={styles.language}
                    data-intro={counterpart.translate(
                        "walkthrough.language_flag"
                    )}
                >
                    <span className={styles.languageLabel}>
                        <Icon type="global" />
                        {t("language")}
                    </span>
                    {flagDropdown}
                </div>
            }
        >
            <div className={styles.tiles}>
                <div className={styles.tile}>
                    <h3 className={styles.tileTitle}>{t("create_title")}</h3>
                    <p className={styles.tileText}>{t("create_text")}</p>
                    <Button
                        id="account_login_button"
                        variant="accent"
                        onClick={() => navigate(createTo)}
                        data-intro={counterpart.translate(
                            "walkthrough.create_cloud_wallet"
                        )}
                    >
                        <Translate content="header.create_account" />
                    </Button>
                </div>
                <div className={styles.tile}>
                    <h3 className={styles.tileTitle}>{t("login_title")}</h3>
                    <p className={styles.tileText}>{t("login_text")}</p>
                    <Button
                        onClick={() => {
                            (SettingsActions as any).changeSetting.defer({
                                setting: "passwordLogin",
                                value: true
                            });
                            (WalletUnlockActions as any)
                                .unlock()
                                .catch(() => {});
                        }}
                    >
                        <Translate content="header.unlock_short" />
                    </Button>
                </div>
            </div>

            {allowed.includes("wallet") && (
                <div className={styles.other}>
                    <h3 className={styles.otherTitle}>{t("other_title")}</h3>
                    <ul className={styles.rows}>
                        <li>
                            <Link
                                to="/wallet/backup/restore"
                                className={styles.row}
                                data-intro={counterpart.translate(
                                    "walkthrough.restore_account"
                                )}
                            >
                                <Icon type="download" />
                                <span className={styles.rowText}>
                                    <span className={styles.rowTitle}>
                                        {t("restore_title")}
                                    </span>
                                    <span className={styles.rowSub}>
                                        {t("restore_text")}
                                    </span>
                                </span>
                                <Icon type="caret-right" />
                            </Link>
                        </li>
                        <li>
                            <Link
                                to="/create-account/wallet"
                                className={styles.row}
                                data-intro={counterpart.translate(
                                    "walkthrough.create_local_wallet"
                                )}
                            >
                                <Icon type="key" />
                                <span className={styles.rowText}>
                                    <span className={styles.rowTitle}>
                                        {t("advanced_title")}
                                    </span>
                                    <span className={styles.rowSub}>
                                        {t("advanced_text")}
                                    </span>
                                </span>
                                <Icon type="caret-right" />
                            </Link>
                        </li>
                    </ul>
                </div>
            )}

            {/* `id`: the forms scroll their first field into view inside it
                (react-scroll `containerId: "accountForm"`) */}
            <div className={styles.form} id="accountForm">
                <Routes>
                    {allowed.includes("wallet") && (
                        <RouteAny path="wallet" element={<CreateAccount />} />
                    )}
                    {allowed.includes("password") && (
                        <RouteAny
                            path="password"
                            element={<CreateAccountPassword />}
                        />
                    )}
                </Routes>
            </div>
        </OnboardingPage>
    );
}
