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
// `useAltStore(AccountStore)` call purely for its re-render-on-change
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
import AccountStore from "stores/AccountStore";
import {Link} from "react-router-dom";
import Translate from "react-translate-component";
import TranslateWithLinks from "./Utility/TranslateWithLinks";
import SettingsActions from "actions/SettingsActions";
import WalletUnlockActions from "actions/WalletUnlockActions";
import SettingsStore from "stores/SettingsStore";
import IntlActions from "actions/IntlActions";
import CreateAccount from "./Account/CreateAccount";
import CreateAccountPassword from "./Account/CreateAccountPassword";
import {Routes, Route} from "react-router-dom";
import {getWalletName, getLogo, getAllowedLogins} from "branding";
import {Select} from "../design-system/Select";
import {Row} from "../design-system/Row";
import {Col} from "../design-system/Col";
import {Icon} from "../design-system/Icon";
import {useAltStore} from "../next/hooks/useAltStore";

const LinkAny = Link as any;
const RouteAny = Route as any;

const logo = (getLogo as any)();

interface LoginSelectorState {
    locales: any;
    currentLocale: any;
}

export default function LoginSelector() {
    useAltStore<any>(AccountStore);

    const [state, setState] = React.useState<LoginSelectorState>({
        locales: (SettingsStore as any).getState().defaults.locale,
        currentLocale: (SettingsStore as any).getState().settings.get(
            "locale"
        )
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
            style={{width: "123px", marginBottom: "16px"}}
        >
            {state.locales.map((locale: any) => (
                <Select.Option key={locale} value={locale}>
                    {counterpart.translate("languages." + locale)}
                </Select.Option>
            ))}
        </Select>
    );

    return (
        <div className="grid-block align-center" id="accountForm">
            <div className="grid-block shrink vertical">
                <div className="grid-content shrink text-center account-creation">
                    <div>
                        <img src={logo} />
                    </div>

                    <div>
                        <Translate
                            content="header.create_account"
                            component="h4"
                        />
                    </div>

                    <div>
                        <Translate
                            content="account.intro_text_title"
                            component="h4"
                            wallet_name={(getWalletName as any)()}
                        />
                        <Translate
                            unsafe
                            content="account.intro_text_1"
                            component="p"
                        />

                        <div className="shrink text-center">
                            <div className="grp-menu-item overflow-visible account-drop-down">
                                <div
                                    className="grp-menu-item overflow-visible login-selector--language-select"
                                    style={{margin: "0 auto"}}
                                    data-intro={counterpart.translate(
                                        "walkthrough.language_flag"
                                    )}
                                >
                                    <Row className="login-selector--language-select--wrapper">
                                        <Col span={4}>
                                            <Icon
                                                type="global"
                                                className="login-selector--language-select--icon"
                                            />
                                        </Col>
                                        <Col span={20}>{flagDropdown}</Col>
                                    </Row>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid-block account-login-options">
                        <LinkAny
                            id="account_login_button"
                            to={
                                (getAllowedLogins as any)().includes(
                                    "password"
                                )
                                    ? "/create-account/password"
                                    : "/create-account/wallet"
                            }
                            className="button primary"
                            data-intro={counterpart.translate(
                                "walkthrough.create_cloud_wallet"
                            )}
                        >
                            <Translate content="header.create_account" />
                        </LinkAny>

                        <span
                            className="button hollow primary"
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
                        </span>
                    </div>

                    {(getAllowedLogins as any)().includes("wallet") && (
                        <div className="additional-account-options">
                            <h5 style={{textAlign: "center"}}>
                                <TranslateWithLinks
                                    string="account.optional.formatter"
                                    keys={[
                                        {
                                            type: "link",
                                            value: "/wallet/backup/restore",
                                            translation:
                                                "account.optional.restore_link",
                                            dataIntro: counterpart.translate(
                                                "walkthrough.restore_account"
                                            ),
                                            arg: "restore_link"
                                        },
                                        {
                                            type: "link",
                                            value: "/create-account/wallet",
                                            translation:
                                                "account.optional.restore_form",
                                            dataIntro: counterpart.translate(
                                                "walkthrough.create_local_wallet"
                                            ),
                                            arg: "restore_form"
                                        }
                                    ]}
                                />
                            </h5>
                        </div>
                    )}
                    <Routes>
                        {(getAllowedLogins as any)().includes("wallet") && (
                            <RouteAny
                                path="wallet"
                                element={<CreateAccount />}
                            />
                        )}
                        {(getAllowedLogins as any)().includes("password") && (
                            <RouteAny
                                path="password"
                                element={<CreateAccountPassword />}
                            />
                        )}
                    </Routes>
                </div>
            </div>
        </div>
    );
}
